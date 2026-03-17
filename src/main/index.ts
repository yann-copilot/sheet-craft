import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
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

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'])

function walkDir(dir: string): string[] {
  let results: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath))
    } else if (entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath)
    }
  }
  return results
}

ipcMain.handle('scan-directory', async (_event, dirPath: string) => {
  try {
    const stat = fs.statSync(dirPath)
    const scanPath = stat.isDirectory() ? dirPath : path.dirname(dirPath)
    const files = walkDir(scanPath)
    return { success: true, files, dirPath: scanPath }
  } catch (err: any) {
    return { success: false, error: err.message, files: [], dirPath }
  }
})

ipcMain.handle('read-image', async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath)
    const rawExt = path.extname(filePath).toLowerCase().replace('.', '')
    const mime = rawExt === 'svg' ? 'image/svg+xml' : `image/${rawExt === 'jpg' ? 'jpeg' : rawExt}`
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
