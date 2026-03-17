interface TagsGroups {
  [itemNumber: number]: string[]
}

interface ExportItem {
  itemNumber: string
  articles: string[]
  notes: string
  tags: string[]
  imagePaths: Record<string, string>
}

interface ElectronAPI {
  scanDirectory: (dirPath: string) => Promise<{ success: boolean; files: string[]; dirPath: string; error?: string }>
  readImage: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; size?: number; error?: string }>
  pickDirectory: () => Promise<string | null>
  pickFile: (opts?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
  parseTagsFile: (filePath: string) => Promise<{ success: boolean; groups: TagsGroups; error?: string }>
  exportExcel: (items: ExportItem[], outputPath?: string) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>
}

declare interface Window {
  electronAPI: ElectronAPI
}
