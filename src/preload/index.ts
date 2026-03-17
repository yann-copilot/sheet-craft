import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
  readImage: (filePath: string) => ipcRenderer.invoke('read-image', filePath),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  pickFile: (opts?: { filters?: { name: string; extensions: string[] }[] }) => ipcRenderer.invoke('pick-file', opts),
  parseTagsFile: (filePath: string) => ipcRenderer.invoke('parse-tags-file', filePath),
  exportExcel: (items: any[], outputPath?: string) => ipcRenderer.invoke('export-excel', items, outputPath),
})
