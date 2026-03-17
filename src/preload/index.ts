import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
  readImage: (filePath: string) => ipcRenderer.invoke('read-image', filePath),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
})
