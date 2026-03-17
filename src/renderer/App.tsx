import React, { useState, useCallback, useRef } from 'react'
import styled, { createGlobalStyle, keyframes } from 'styled-components'

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
`

/* ─── Types ─────────────────────────────────────────── */
interface ImageFile {
  path: string
  name: string
  ext: string
  size: number
  dataUrl?: string
  loading?: boolean
  error?: boolean
}

interface ScanResult {
  success: boolean
  files: string[]
  dirPath: string
  error?: string
}

/* ─── Styled Components ─────────────────────────────── */

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
`

const TitleBar = styled.div`
  height: 38px;
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  padding: 0 80px 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
`

const AppTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.4px;
`

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
  gap: 20px;
`

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`

const DropZone = styled.div<{ $active: boolean; $hasFiles: boolean }>`
  border: 2px dashed ${p => p.$active ? 'var(--accent)' : p.$hasFiles ? 'var(--border)' : 'var(--border)'};
  border-radius: var(--radius);
  padding: ${p => p.$hasFiles ? '16px 24px' : '48px 24px'};
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  background: ${p => p.$active ? 'rgba(99,102,241,0.08)' : 'var(--surface)'};
  transition: all 0.2s ease;
  flex-shrink: 0;
  
  &:hover {
    border-color: var(--accent);
    background: rgba(99,102,241,0.05);
  }
`

const DropIcon = styled.div<{ $hasFiles: boolean }>`
  font-size: ${p => p.$hasFiles ? '28px' : '44px'};
  line-height: 1;
  flex-shrink: 0;
  transition: font-size 0.2s;
`

const DropText = styled.div`
  flex: 1;
`

const DropTitle = styled.div<{ $hasFiles: boolean }>`
  font-size: ${p => p.$hasFiles ? '14px' : '18px'};
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
  transition: font-size 0.2s;
`

const DropSub = styled.div`
  font-size: 13px;
  color: var(--text-muted);
`

const BrowseBtn = styled.button`
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  padding: 8px 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
  -webkit-app-region: no-drag;
  
  &:hover { background: var(--border); }
`

const StatsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
`

const Stat = styled.span`
  color: var(--text);
  font-weight: 500;
`

const Grid = styled.div`
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  padding-right: 4px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`

const Card = styled.div<{ $loading?: boolean }>`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: ${p => p.$loading ? pulse : 'none'} 1.5s infinite;
  transition: transform 0.15s, border-color 0.15s;
  
  &:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
  }
`

const ImageWrap = styled.div`
  width: 100%;
  aspect-ratio: 1;
  background: var(--surface2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
`

const Img = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const ImagePlaceholder = styled.div`
  font-size: 32px;
`

const CardInfo = styled.div`
  padding: 8px 10px;
`

const CardName = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
`

const CardMeta = styled.div`
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`

const CreateBtn = styled.button<{ $disabled: boolean }>`
  background: ${p => p.$disabled ? 'var(--surface2)' : 'var(--accent)'};
  color: ${p => p.$disabled ? 'var(--text-muted)' : '#fff'};
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 24px;
  cursor: ${p => p.$disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.15s, transform 0.1s;
  
  &:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
`

const ClearBtn = styled.button`
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  padding: 10px 16px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  
  &:hover { color: var(--text); border-color: var(--text-muted); }
`

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 8px;
  font-size: 14px;
`

/* ─── Helpers ────────────────────────────────────────── */
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function basename(p: string) {
  return p.split(/[/\\]/).pop() || p
}

function ext(p: string) {
  const m = p.match(/\.([^.]+)$/)
  return m ? m[1].toUpperCase() : '?'
}

/* ─── Component ──────────────────────────────────────── */
export default function App() {
  const [images, setImages] = useState<ImageFile[]>([])
  const [dirPath, setDirPath] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const processDirectory = useCallback(async (path: string) => {
    setScanning(true)
    setImages([])
    setDirPath(path)

    const result: ScanResult = await window.electronAPI.scanDirectory(path)
    if (!result.success || result.files.length === 0) {
      setScanning(false)
      setImages([])
      return
    }

    // Init all cards immediately
    const initial: ImageFile[] = result.files.map(fp => ({
      path: fp,
      name: basename(fp),
      ext: ext(fp),
      size: 0,
      loading: true,
    }))
    setImages(initial)
    setScanning(false)

    // Load previews in batches of 8
    const BATCH = 8
    for (let i = 0; i < result.files.length; i += BATCH) {
      const batch = result.files.slice(i, i + BATCH)
      const loaded = await Promise.all(
        batch.map(fp => window.electronAPI.readImage(fp))
      )
      setImages(prev =>
        prev.map((img, idx) => {
          const batchIdx = idx - i
          if (batchIdx < 0 || batchIdx >= batch.length) return img
          const res = loaded[batchIdx]
          return {
            ...img,
            dataUrl: res.success ? res.dataUrl : undefined,
            size: res.size || 0,
            loading: false,
            error: !res.success,
          }
        })
      )
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const item = e.dataTransfer.items?.[0]
    if (!item) return
    const entry = item.webkitGetAsEntry?.()
    if (entry?.isDirectory) {
      // @ts-ignore
      processDirectory(e.dataTransfer.files[0].path)
    } else if (item.kind === 'file') {
      const file = item.getAsFile()
      // @ts-ignore
      if (file?.path) processDirectory(file.path)
    }
  }, [processDirectory])

  const handleBrowse = useCallback(async () => {
    const path = await window.electronAPI.pickDirectory()
    if (path) processDirectory(path)
  }, [processDirectory])

  const totalSize = images.reduce((a, b) => a + b.size, 0)
  const hasFiles = images.length > 0

  return (
    <Root>
      <TitleBar>
        <AppTitle>SheetCraft</AppTitle>
      </TitleBar>

      <Content>
        {/* Drop zone */}
        <DropZone
          ref={dropRef}
          $active={isDragging}
          $hasFiles={hasFiles}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
        >
          <DropIcon $hasFiles={hasFiles}>
            {isDragging ? '📂' : hasFiles ? '🖼️' : '📁'}
          </DropIcon>
          <DropText>
            <DropTitle $hasFiles={hasFiles}>
              {isDragging
                ? 'Release to scan'
                : hasFiles
                ? dirPath?.split('/').slice(-2).join('/')
                : 'Drop a folder here'}
            </DropTitle>
            <DropSub>
              {hasFiles
                ? `${images.length} images found`
                : 'or click to browse — scans all subfolders'}
            </DropSub>
          </DropText>
          <BrowseBtn onClick={e => { e.stopPropagation(); handleBrowse() }}>
            Browse…
          </BrowseBtn>
        </DropZone>

        {/* Stats + actions */}
        {hasFiles && (
          <Toolbar>
            <StatsBar>
              <span>
                <Stat>{images.length}</Stat> images
              </span>
              <span>·</span>
              <span>
                <Stat>{formatBytes(totalSize)}</Stat> total
              </span>
              {scanning && <span style={{ color: 'var(--accent)' }}>Scanning…</span>}
            </StatsBar>
            <div style={{ display: 'flex', gap: 10 }}>
              <ClearBtn onClick={() => { setImages([]); setDirPath(null) }}>
                Clear
              </ClearBtn>
              <CreateBtn
                $disabled={images.length === 0}
                disabled={images.length === 0}
                onClick={() => alert('Excel export coming soon!')}
              >
                Create Excel Sheet →
              </CreateBtn>
            </div>
          </Toolbar>
        )}

        {/* Image grid */}
        {hasFiles ? (
          <Grid>
            {images.map(img => (
              <Card key={img.path} $loading={img.loading}>
                <ImageWrap>
                  {img.loading ? (
                    <ImagePlaceholder>⏳</ImagePlaceholder>
                  ) : img.error || !img.dataUrl ? (
                    <ImagePlaceholder>⚠️</ImagePlaceholder>
                  ) : (
                    <Img src={img.dataUrl} alt={img.name} />
                  )}
                </ImageWrap>
                <CardInfo>
                  <CardName title={img.name}>{img.name}</CardName>
                  <CardMeta>
                    {img.ext} {img.size ? `· ${formatBytes(img.size)}` : ''}
                  </CardMeta>
                </CardInfo>
              </Card>
            ))}
          </Grid>
        ) : (
          <EmptyState>
            <span style={{ fontSize: 48 }}>🗂️</span>
            <span>Drop or browse a folder to see your images</span>
            <span style={{ fontSize: 12 }}>Supports JPG, PNG, GIF, WebP, SVG, BMP, TIFF</span>
          </EmptyState>
        )}
      </Content>
    </Root>
  )
}
