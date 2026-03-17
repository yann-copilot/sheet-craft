interface ElectronAPI {
  scanDirectory: (dirPath: string) => Promise<{ success: boolean; files: string[]; dirPath: string; error?: string }>
  readImage: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; size?: number; error?: string }>
  pickDirectory: () => Promise<string | null>
}

declare interface Window {
  electronAPI: ElectronAPI
}
