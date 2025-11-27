import { ElectronAPI } from '@electron-toolkit/preload'

// 收藏夹数据结构
export interface Favorite {
  id: string
  url: string
  title: string
  favicon?: string
  createdAt: number
}

// 历史记录数据结构
export interface HistoryRecord {
  id: string
  url: string
  title: string
  favicon?: string
  visitedAt: number
  visitCount: number
}

// 下载记录数据结构
export interface DownloadRecord {
  id: string
  url: string
  filename: string
  savePath: string
  totalBytes: number
  receivedBytes: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  startTime: number
  endTime?: number
  error?: string
}

// API 接口定义
interface FavoritesAPI {
  getAll: () => Promise<{ success: boolean; favorites: Favorite[]; message?: string }>
  add: (
    favorite: Omit<Favorite, 'id' | 'createdAt'>
  ) => Promise<{ success: boolean; message?: string }>
  delete: (id: string) => Promise<{ success: boolean; message?: string }>
  update: (
    id: string,
    updates: Partial<Omit<Favorite, 'id' | 'createdAt'>>
  ) => Promise<{ success: boolean; message?: string }>
  check: (
    url: string
  ) => Promise<{ success: boolean; isFavorite: boolean; favorite?: Favorite; message?: string }>
}

interface HistoryAPI {
  getAll: (
    limit?: number
  ) => Promise<{ success: boolean; history: HistoryRecord[]; message?: string }>
  add: (
    record: Omit<HistoryRecord, 'id' | 'visitedAt' | 'visitCount'>
  ) => Promise<{ success: boolean; message?: string }>
  delete: (id: string) => Promise<{ success: boolean; message?: string }>
  clear: () => Promise<{ success: boolean; message?: string }>
  search: (
    keyword: string,
    limit?: number
  ) => Promise<{ success: boolean; history: HistoryRecord[]; message?: string }>
}

interface DownloadsAPI {
  getAll: () => Promise<{ success: boolean; downloads: DownloadRecord[]; message?: string }>
  delete: (id: string) => Promise<{ success: boolean; message?: string }>
  clear: () => Promise<{ success: boolean; message?: string }>
  open: (savePath: string) => Promise<{ success: boolean; message?: string }>
  openFolder: (savePath: string) => Promise<{ success: boolean; message?: string }>
  cancel: (id: string) => Promise<{ success: boolean; message?: string }>
}

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximize: (callback: (isMaximized: boolean) => void) => void
  removeMaximizeListener: () => void
}

interface CustomAPI {
  window: WindowAPI
  favorites: FavoritesAPI
  history: HistoryAPI
  downloads: DownloadsAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
