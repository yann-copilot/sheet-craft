import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import ExcelJS from 'exceljs'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f11',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/* ── Directory scanner ── */
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'])

function walkDir(dir: string): string[] {
  let results: string[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return results }
  for (const e of entries) {
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) results = results.concat(walkDir(fp))
    else if (e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) results.push(fp)
  }
  return results
}

ipcMain.handle('scan-directory', async (_e, dirPath: string) => {
  try {
    const stat = fs.statSync(dirPath)
    const scanPath = stat.isDirectory() ? dirPath : path.dirname(dirPath)
    const files = walkDir(scanPath)
    return { success: true, files, dirPath: scanPath }
  } catch (err: any) {
    return { success: false, error: err.message, files: [], dirPath }
  }
})

ipcMain.handle('read-image', async (_e, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath)
    const rawExt = path.extname(filePath).toLowerCase().replace('.', '')
    const mime = `image/${rawExt === 'jpg' ? 'jpeg' : rawExt}`
    return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}`, size: data.length }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('pick-directory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('pick-file', async (event, opts: { filters?: { name: string; extensions: string[] }[] }) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: opts?.filters })
  return result.canceled ? null : result.filePaths[0]
})

/* ── Tags file parser ── */
function parseTagLine(body: string): string[] {
  // body: '-Most-Loved Details-New Arrivals-Soft & Cosy'
  // Tags are dash-separated, but some tags have internal hyphens ('Most-Loved')
  // Heuristic: split on '-' followed by Uppercase, then re-merge if the split
  // produced a fragment whose first word is ≤6 chars and previous had no space
  const normalized = body.startsWith('-') ? body : '-' + body
  const raw = normalized.split(/-(?=[A-Z\u{1F300}-\u{1FFFF}0-9])/u)
  const merged: string[] = []
  for (const part of raw) {
    const clean = part.replace(/^-+/, '').trim()
    if (!clean) continue
    const last = merged[merged.length - 1]
    if (last && !last.includes(' ')) {
      // previous fragment was single-word — could be first half of compound
      const firstWord = clean.split(' ')[0]
      if (firstWord.length <= 7 && /^[A-Z]/.test(firstWord)) {
        merged[merged.length - 1] = last + '-' + clean
        continue
      }
    }
    merged.push(clean)
  }
  return merged.filter(t => t.length > 1)
}

ipcMain.handle('parse-tags-file', async (_e, filePath: string) => {
  try {
    const ext = path.extname(filePath).toLowerCase()
    let text = ''
    if (ext === '.docx') {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      text = result.value
    } else {
      text = fs.readFileSync(filePath, 'utf-8')
    }

    const groups: Record<number, string[]> = {}
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    for (const line of lines) {
      // Normalise "N) and M)" → single multi-group token
      const normalizedLine = line.replace(/(\d+)\)\s*and\s*(\d+)\)/g, '__MULTI_$1_$2__')
      const segRegex = /(\d+)\)\s*|__MULTI_(\d+)_(\d+)__\s*/g
      const positions: Array<{ end: number; nums: number[] }> = []
      let m: RegExpExecArray | null
      while ((m = segRegex.exec(normalizedLine)) !== null) {
        const nums = m[2] ? [parseInt(m[2]), parseInt(m[3])] : [parseInt(m[1])]
        positions.push({ end: m.index + m[0].length, nums })
      }

      for (let pi = 0; pi < positions.length; pi++) {
        const { end, nums } = positions[pi]
        const nextStart = positions[pi + 1]?.end
          ? normalizedLine.lastIndexOf(positions[pi + 1].nums[0].toString() + ')', positions[pi + 1].end)
          : normalizedLine.length
        // Recalculate nextStart properly
        const nextSegEnd = pi + 1 < positions.length
          ? normalizedLine.indexOf(
              positions[pi + 1].nums[0] + ')',
              end
            )
          : normalizedLine.length
        const body = normalizedLine.slice(end, nextSegEnd === -1 ? normalizedLine.length : nextSegEnd).trim()
        const tags = parseTagLine(body)
        for (const n of nums) groups[n] = tags
      }
    }

    return { success: true, groups }
  } catch (err: any) {
    return { success: false, error: err.message, groups: {} }
  }
})

/* ── Excel export with embedded images ── */
interface ExportItem {
  itemNumber: string
  articles: string[]
  notes: string
  tags: string[]
  imagePaths: Record<string, string>
}

ipcMain.handle('export-excel', async (event, items: ExportItem[], outputPath?: string) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)!
    let savePath = outputPath
    if (!savePath) {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: 'banner-selection.xlsx',
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      })
      if (result.canceled) return { success: false, canceled: true }
      savePath = result.filePath
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SheetCraft'
    const sheet = wb.addWorksheet('BANNER SELECTION')

    const MAX_PHOTOS = Math.max(...items.map(i => i.articles.length), 7)
    const IMG_ROW_HEIGHT = 90

    sheet.getColumn(1).width = 18
    sheet.getColumn(2).width = 48
    for (let c = 3; c <= MAX_PHOTOS + 2; c++) sheet.getColumn(c).width = 16

    const photoCols = Array.from({ length: MAX_PHOTOS }, (_, i) => `PHOTO ${i + 1}`)
    const headerRow = sheet.addRow(['PHOTO USE', 'TITLES/TAG LINES', ...photoCols])
    headerRow.height = 22
    headerRow.eachCell((cell, cn) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle', horizontal: cn === 2 ? 'left' : 'center' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF374151' } }, right: { style: 'thin', color: { argb: 'FF374151' } } }
    })

    const BG_A = 'FFFAFAFA'
    const BG_B = 'FFF3F4F6'
    const BG_LABEL = 'FFE5E7EB'

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      const bg = idx % 2 === 0 ? BG_A : BG_B

      const tagsText = item.tags.map(t => `- ${t}`).join('\n')
      const photoRow = sheet.addRow([item.itemNumber, tagsText, ...Array(MAX_PHOTOS).fill(null)])
      photoRow.height = IMG_ROW_HEIGHT

      photoRow.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cn === 1 ? BG_LABEL : bg } }
        cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
        if (cn === 1) {
          cell.font = { bold: true, size: 14, name: 'Calibri', color: { argb: 'FF1F2937' } }
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (cn === 2) {
          cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF374151' } }
          cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        }
      })

      // Embed images
      const photoRowIndex = photoRow.number - 1
      for (let ai = 0; ai < item.articles.length; ai++) {
        const article = item.articles[ai]
        const imgPath = item.imagePaths?.[article]
        if (imgPath && fs.existsSync(imgPath)) {
          try {
            const rawBuf = fs.readFileSync(imgPath)
            const buf = Buffer.from(rawBuf) as any
            const rawExt = path.extname(imgPath).toLowerCase().replace('.', '')
            const ext = (rawExt === 'jpg' ? 'jpeg' : rawExt) as 'jpeg' | 'png' | 'gif'
            const imageId = wb.addImage({ buffer: buf, extension: ext })
            const col = ai + 2
            sheet.addImage(imageId, {
              tl: { col: col + 0.05, row: photoRowIndex + 0.05 } as any,
              br: { col: col + 0.95, row: photoRowIndex + 0.95 } as any,
              editAs: 'oneCell',
            })
          } catch (_) { /* skip broken image */ }
        }
      }

      const articleRow = sheet.addRow(['ARTICLE NUMBER', null, ...item.articles, ...Array(MAX_PHOTOS - item.articles.length).fill(null)])
      articleRow.height = 18
      articleRow.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cn === 1 ? BG_LABEL : bg } }
        cell.font = { size: 10, name: 'Calibri', color: { argb: cn === 1 ? 'FF6B7280' : 'FF374151' }, bold: cn === 1 }
        cell.alignment = { vertical: 'middle', horizontal: cn === 1 ? 'left' : 'center' }
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
      })

      const notesRow = sheet.addRow(['NOTES', null, item.notes || null])
      notesRow.height = 18
      notesRow.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cn === 1 ? BG_LABEL : bg } }
        cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF9CA3AF' }, italic: cn !== 1, bold: cn === 1 }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
        cell.border = { bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
      })
    }

    await wb.xlsx.writeFile(savePath!)
    return { success: true, path: savePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
