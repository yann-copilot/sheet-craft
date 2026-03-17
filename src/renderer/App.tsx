import React, { useState, useCallback } from 'react'

/* ─── Types ─────────────────────────────────────── */
interface ImageFile {
  path: string
  name: string
  article: string
  itemNumber: string
  dataUrl?: string
  loading: boolean
}

interface SheetItem {
  itemNumber: string
  articles: string[]
  tags: string[]
  notes: string
  imagePreviews: Record<string, string>  // article → data URL (UI preview)
  imagePaths: Record<string, string>        // article → file path (Excel embed)
}

type Step = 'setup' | 'preview' | 'exporting' | 'done'

/* ─── Helpers ───────────────────────────────────── */
function parseFilename(filename: string): { itemNumber: string; article: string } | null {
  // Format: 01_102543-004A.jpg — item_article.ext
  // Also allow: 01_102543-004A_extra.jpg (take first two parts)
  const base = filename.replace(/\.[^.]+$/, '')
  const match = base.match(/^(\d+)_(.+)$/)
  if (!match) return null
  return { itemNumber: match[1].replace(/^0+/, '') || '0', article: match[2] }
}

function basename(p: string) { return p.split(/[/\\]/).pop() || p }
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

/* ─── Styles (inline for zero deps) ────────────── */
const S = {
  root: { display:'flex', flexDirection:'column' as const, height:'100vh', background:'#0f0f11', color:'#f4f4f5', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontSize:14, overflow:'hidden' },
  titleBar: { height:38, WebkitAppRegion:'drag' as any, background:'#141417', borderBottom:'1px solid #2a2a30', display:'flex', alignItems:'center', padding:'0 80px 0 16px', flexShrink:0 },
  titleText: { fontSize:13, fontWeight:600, color:'#71717a', letterSpacing:'0.4px' },
  body: { flex:1, display:'flex', overflow:'hidden' },

  // Sidebar
  sidebar: { width:280, flexShrink:0, background:'#141417', borderRight:'1px solid #2a2a30', display:'flex', flexDirection:'column' as const, padding:20, gap:16, overflow:'auto' },
  sideSection: { display:'flex', flexDirection:'column' as const, gap:8 },
  sideLabel: { fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'0.8px' },
  
  // Drop zones
  dropZone: (active: boolean, filled: boolean) => ({
    border: `2px dashed ${active ? '#6366f1' : filled ? '#22c55e' : '#2e2e35'}`,
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    background: active ? 'rgba(99,102,241,0.08)' : filled ? 'rgba(34,197,94,0.05)' : '#1a1a1f',
    transition: 'all 0.2s',
    display:'flex', alignItems:'center', gap:10,
  }),
  dropIcon: { fontSize:20, flexShrink:0 },
  dropInfo: { flex:1, minWidth:0 },
  dropTitle: (filled: boolean) => ({ fontSize:12, fontWeight:600, color: filled ? '#22c55e' : '#f4f4f5', whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' }),
  dropSub: { fontSize:11, color:'#6b7280', marginTop:2 },

  // Buttons
  btn: (variant: 'primary'|'ghost'|'danger' = 'primary', disabled = false) => ({
    background: disabled ? '#1f1f26' : variant === 'primary' ? '#6366f1' : variant === 'ghost' ? 'transparent' : '#dc2626',
    color: disabled ? '#4b5563' : '#fff',
    border: variant === 'ghost' ? '1px solid #2e2e35' : 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
    WebkitAppRegion: 'no-drag',
  }),

  // Main content
  main: { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden' },
  toolbar: { padding:'14px 20px', borderBottom:'1px solid #2a2a30', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'#141417' },
  stats: { flex:1, fontSize:12, color:'#6b7280', display:'flex', gap:16 },
  statVal: { color:'#e5e7eb', fontWeight:600 },

  // Table
  tableWrap: { flex:1, overflow:'auto', padding:'0 0 20px 0' },
  table: { width:'100%', borderCollapse:'collapse' as const, minWidth:800 },
  th: { padding:'10px 14px', fontSize:11, fontWeight:600, color:'#9ca3af', textAlign:'left' as const, background:'#141417', borderBottom:'1px solid #2a2a30', position:'sticky' as const, top:0, zIndex:1, whiteSpace:'nowrap' as const },
  itemRow: (alt: boolean) => ({ background: alt ? '#1a1a1f' : '#161619', borderBottom:'1px solid #22222a' }),
  td: { padding:'10px 14px', verticalAlign:'top' as const, fontSize:13, color:'#e5e7eb', lineHeight:1.4 },
  tdNum: { padding:'10px 14px', verticalAlign:'middle' as const, fontSize:18, fontWeight:700, color:'#6366f1', textAlign:'center' as const, width:60 },
  
  // Tag badges
  tagBadge: { display:'inline-block', background:'rgba(99,102,241,0.12)', color:'#818cf8', borderRadius:4, padding:'2px 6px', fontSize:11, marginRight:4, marginBottom:3 },
  
  // Image thumbs
  thumbRow: { display:'flex', gap:6, flexWrap:'wrap' as const },
  thumb: { width:52, height:52, borderRadius:6, objectFit:'cover' as const, border:'1px solid #2e2e35', background:'#1f1f26', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, overflow:'hidden' },
  
  // Empty state
  empty: { flex:1, display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', color:'#4b5563', gap:12 },
  emptyIcon: { fontSize:56 },
  emptyTitle: { fontSize:16, fontWeight:600, color:'#6b7280' },
  emptyDesc: { fontSize:13, color:'#4b5563', maxWidth:340, textAlign:'center' as const, lineHeight:1.6 },

  // Notes input
  notesInput: { background:'#1a1a1f', border:'1px solid #2e2e35', borderRadius:6, color:'#e5e7eb', fontSize:12, padding:'4px 8px', width:'100%', fontFamily:'inherit', resize:'vertical' as const },

  // Status badge
  badge: (ok: boolean) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:999, fontSize:11, fontWeight:600, background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: ok ? '#22c55e' : '#ef4444' }),
}

/* ─── Component ─────────────────────────────────── */
export default function App() {
  const [dirPath, setDirPath] = useState<string | null>(null)
  const [tagsPath, setTagsPath] = useState<string | null>(null)
  const [tagsGroups, setTagsGroups] = useState<Record<number, string[]>>({})
  const [images, setImages] = useState<ImageFile[]>([])
  const [items, setItems] = useState<SheetItem[]>([])
  const [step, setStep] = useState<Step>('setup')
  const [draggingDir, setDraggingDir] = useState(false)
  const [draggingTags, setDraggingTags] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [totalSize, setTotalSize] = useState(0)

  const buildSheetItems = useCallback((imgs: ImageFile[], groups: Record<number, string[]>): SheetItem[] => {
    const map: Record<string, { articles: string[]; imagePreviews: Record<string, string>; imagePaths: Record<string, string> }> = {}
    for (const img of imgs) {
      if (!map[img.itemNumber]) map[img.itemNumber] = { articles: [], imagePreviews: {}, imagePaths: {} }
      if (!map[img.itemNumber].articles.includes(img.article)) {
        map[img.itemNumber].articles.push(img.article)
      }
      if (img.dataUrl) map[img.itemNumber].imagePreviews[img.article] = img.dataUrl
      map[img.itemNumber].imagePaths[img.article] = img.path
      map[img.itemNumber].imagePaths[img.article] = img.path
    }
    return Object.keys(map)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(num => ({
        itemNumber: num,
        articles: map[num].articles,
        tags: groups[parseInt(num)] || [],
        notes: '',
        imagePreviews: map[num].imagePreviews,
        imagePaths: map[num].imagePaths,
      }))
  }, [])

  const loadDirectory = useCallback(async (dirPathIn: string) => {
    setScanning(true)
    setImages([])
    setItems([])
    setDirPath(dirPathIn)
    
    const result = await window.electronAPI.scanDirectory(dirPathIn)
    if (!result.success) { setScanning(false); return }

    const parsed: ImageFile[] = result.files
      .map(fp => {
        const parsed = parseFilename(basename(fp))
        if (!parsed) return null
        return { path: fp, name: basename(fp), article: parsed.article, itemNumber: parsed.itemNumber, loading: true }
      })
      .filter(Boolean) as ImageFile[]

    setImages(parsed)
    setScanning(false)

    // Load images in background
    let size = 0
    const BATCH = 6
    const loaded = [...parsed]
    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(img => window.electronAPI.readImage(img.path)))
      results.forEach((r, bi) => {
        const idx = i + bi
        loaded[idx] = { ...loaded[idx], dataUrl: r.dataUrl, loading: false }
        if (r.size) size += r.size
      })
      setImages([...loaded])
      setTotalSize(size)
    }
    
    setItems(prev => {
      const si = buildSheetItems(loaded, tagsGroups)
      // Preserve any notes already typed
      return si.map(item => {
        const existing = prev.find(p => p.itemNumber === item.itemNumber)
        return { ...item, notes: existing?.notes || '' }
      })
    })
    if (loaded.length > 0) setStep('preview')
  }, [tagsGroups, buildSheetItems])

  const loadTagsFile = useCallback(async (fp: string) => {
    setTagsPath(fp)
    const result = await window.electronAPI.parseTagsFile(fp)
    if (result.success) {
      setTagsGroups(result.groups)
      // Re-build items with new tags if we already have images
      if (images.length > 0) {
        setItems(prev => {
          const si = buildSheetItems(images, result.groups)
          return si.map(item => {
            const existing = prev.find(p => p.itemNumber === item.itemNumber)
            return { ...item, notes: existing?.notes || '', imagePaths: item.imagePaths }
          })
        })
      }
    }
  }, [images, buildSheetItems])

  const handleDirDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDraggingDir(false)
    const file = e.dataTransfer.files[0]
    if (file) loadDirectory((file as any).path)
  }, [loadDirectory])

  const handleTagsDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDraggingTags(false)
    const file = e.dataTransfer.files[0]
    if (file) loadTagsFile((file as any).path)
  }, [loadTagsFile])

  const handleExport = useCallback(async () => {
    setStep('exporting')
    setExportMsg(null)
    const exportItems = items.map(item => ({
      itemNumber: item.itemNumber,
      articles: item.articles,
      tags: item.tags,
      notes: item.notes,
      imagePaths: item.imagePaths,
    }))
    const result = await window.electronAPI.exportExcel(exportItems)
    if (result.canceled) { setStep('preview'); return }
    if (result.success) {
      setExportMsg(`✅ Saved: ${result.path?.split('/').pop()}`)
      setStep('done')
    } else {
      setExportMsg(`❌ Error: ${result.error}`)
      setStep('preview')
    }
  }, [items])

  const updateNotes = (itemNumber: string, notes: string) => {
    setItems(prev => prev.map(i => i.itemNumber === itemNumber ? { ...i, notes } : i))
  }

  const tagsLoaded = Object.keys(tagsGroups).length > 0
  const canExport = items.length > 0

  return (
    <div style={S.root}>
      <div style={S.titleBar}>
        <span style={S.titleText}>SheetCraft</span>
      </div>
      <div style={S.body}>

        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.sideSection}>
            <div style={S.sideLabel}>1. Image Folder</div>
            <div
              style={S.dropZone(draggingDir, !!dirPath)}
              onDragOver={e => { e.preventDefault(); setDraggingDir(true) }}
              onDragLeave={() => setDraggingDir(false)}
              onDrop={handleDirDrop}
              onClick={async () => {
                const p = await window.electronAPI.pickDirectory()
                if (p) loadDirectory(p)
              }}
            >
              <span style={S.dropIcon}>{draggingDir ? '📂' : dirPath ? '✅' : '📁'}</span>
              <div style={S.dropInfo}>
                <div style={S.dropTitle(!!dirPath)}>
                  {dirPath ? dirPath.split('/').slice(-2).join('/') : 'Drop folder…'}
                </div>
                <div style={S.dropSub}>
                  {scanning ? 'Scanning…' : images.length > 0 ? `${images.length} images · ${formatBytes(totalSize)}` : 'click or drag'}
                </div>
              </div>
            </div>
          </div>

          <div style={S.sideSection}>
            <div style={S.sideLabel}>2. Tags File</div>
            <div
              style={S.dropZone(draggingTags, !!tagsPath)}
              onDragOver={e => { e.preventDefault(); setDraggingTags(true) }}
              onDragLeave={() => setDraggingTags(false)}
              onDrop={handleTagsDrop}
              onClick={async () => {
                const p = await window.electronAPI.pickFile({ filters: [{ name: 'Tags file', extensions: ['docx','txt'] }] })
                if (p) loadTagsFile(p)
              }}
            >
              <span style={S.dropIcon}>{draggingTags ? '📝' : tagsPath ? '✅' : '🏷️'}</span>
              <div style={S.dropInfo}>
                <div style={S.dropTitle(!!tagsPath)}>
                  {tagsPath ? basename(tagsPath) : 'Drop tags file…'}
                </div>
                <div style={S.dropSub}>
                  {tagsLoaded ? `${Object.keys(tagsGroups).length} item groups loaded` : '.docx or .txt'}
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          {items.length > 0 && (
            <div style={S.sideSection}>
              <div style={S.sideLabel}>Status</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div style={S.badge(true)}>✓ {items.length} items detected</div>
                <div style={S.badge(tagsLoaded)}>
                  {tagsLoaded ? `✓ Tags loaded` : '⚠ No tags file'}
                </div>
                {items.filter(i => i.tags.length === 0).length > 0 && (
                  <div style={S.badge(false)}>
                    {items.filter(i => i.tags.length === 0).length} items missing tags
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export button */}
          <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:8 }}>
            {exportMsg && (
              <div style={{ fontSize:12, color: exportMsg.startsWith('✅') ? '#22c55e' : '#ef4444', background: exportMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', padding:'8px 10px', borderRadius:8, lineHeight:1.4 }}>
                {exportMsg}
              </div>
            )}
            <button
              style={S.btn('primary', !canExport || step === 'exporting')}
              disabled={!canExport || step === 'exporting'}
              onClick={handleExport}
            >
              {step === 'exporting' ? '⏳ Exporting…' : '📊 Export Excel Sheet'}
            </button>
            {(dirPath || tagsPath) && (
              <button style={S.btn('ghost')} onClick={() => {
                setDirPath(null); setTagsPath(null); setTagsGroups({}); setImages([]); setItems([]); setStep('setup'); setExportMsg(null); setTotalSize(0)
              }}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={S.main}>
          {items.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}>🗂️</div>
              <div style={S.emptyTitle}>No items yet</div>
              <div style={S.emptyDesc}>
                Drop an image folder and a tags file in the sidebar.<br/>
                Images should be named like <code style={{ background:'#1f1f26', padding:'1px 5px', borderRadius:4 }}>01_102543-004A.jpg</code>
              </div>
            </div>
          ) : (
            <>
              <div style={S.toolbar}>
                <div style={S.stats}>
                  <span><span style={S.statVal}>{items.length}</span> items</span>
                  <span><span style={S.statVal}>{images.length}</span> images</span>
                  <span><span style={S.statVal}>{items.reduce((a,i) => a + i.articles.length, 0)}</span> articles</span>
                  {tagsLoaded && <span><span style={S.statVal}>{items.filter(i => i.tags.length > 0).length}</span> with tags</span>}
                </div>
              </div>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Tags / Taglines</th>
                      <th style={S.th}>Articles</th>
                      <th style={S.th}>Photos</th>
                      <th style={S.th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.itemNumber} style={S.itemRow(idx % 2 === 1)}>
                        <td style={S.tdNum}>{item.itemNumber}</td>
                        <td style={S.td}>
                          {item.tags.length > 0 ? (
                            <div style={{ display:'flex', flexWrap:'wrap' }}>
                              {item.tags.map((t, i) => (
                                <span key={i} style={S.tagBadge}>{t}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color:'#4b5563', fontSize:12 }}>—</span>
                          )}
                        </td>
                        <td style={S.td}>
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {item.articles.map((a, i) => (
                              <span key={a} style={{ fontSize:12, color:'#d1d5db' }}>
                                <span style={{ color:'#6b7280', marginRight:6 }}>P{i+1}</span>{a}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={S.td}>
                          <div style={S.thumbRow}>
                            {item.articles.map(a => (
                              <div key={a} style={S.thumb}>
                                {item.imagePreviews[a] ? (
                                  <img src={item.imagePreviews[a]} alt={a} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                ) : (
                                  '🖼️'
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={S.td}>
                          <textarea
                            style={S.notesInput}
                            rows={2}
                            placeholder="Notes…"
                            value={item.notes}
                            onChange={e => updateNotes(item.itemNumber, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
