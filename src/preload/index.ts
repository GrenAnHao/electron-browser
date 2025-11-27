import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

// Custom APIs for renderer
const api = {
  // 窗口控制 API
  window: {
    // 最小化窗口
    minimize: () => {
      ipcRenderer.send('window-minimize')
    },
    // 最大化/还原窗口
    maximize: () => {
      ipcRenderer.send('window-maximize')
    },
    // 关闭窗口
    close: () => {
      ipcRenderer.send('window-close')
    },
    // 检查窗口是否最大化
    isMaximized: (): Promise<boolean> => {
      return ipcRenderer.invoke('window-is-maximized')
    },
    // 监听窗口最大化状态变化
    onMaximize: (callback: (isMaximized: boolean) => void) => {
      ipcRenderer.on('window-maximize-changed', (_event, isMaximized: boolean) => {
        callback(isMaximized)
      })
    },
    // 移除监听器
    removeMaximizeListener: () => {
      ipcRenderer.removeAllListeners('window-maximize-changed')
    }
  },
  // 收藏夹 API
  favorites: {
    // 获取所有收藏夹
    getAll: async (): Promise<{ success: boolean; favorites: Favorite[]; message?: string }> => {
      return await ipcRenderer.invoke('FAVORITE_GET_ALL')
    },
    // 添加收藏夹
    add: async (
      favorite: Omit<Favorite, 'id' | 'createdAt'>
    ): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('FAVORITE_ADD', favorite)
    },
    // 删除收藏夹
    delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('FAVORITE_DELETE', id)
    },
    // 更新收藏夹
    update: async (
      id: string,
      updates: Partial<Omit<Favorite, 'id' | 'createdAt'>>
    ): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('FAVORITE_UPDATE', id, updates)
    },
    // 检查 URL 是否已收藏
    check: async (
      url: string
    ): Promise<{
      success: boolean
      isFavorite: boolean
      favorite?: Favorite
      message?: string
    }> => {
      return await ipcRenderer.invoke('FAVORITE_CHECK', url)
    }
  },
  // 历史记录 API
  history: {
    // 获取所有历史记录
    getAll: async (
      limit?: number
    ): Promise<{ success: boolean; history: HistoryRecord[]; message?: string }> => {
      return await ipcRenderer.invoke('HISTORY_GET_ALL', limit)
    },
    // 添加历史记录
    add: async (
      record: Omit<HistoryRecord, 'id' | 'visitedAt' | 'visitCount'>
    ): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('HISTORY_ADD', record)
    },
    // 删除历史记录
    delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('HISTORY_DELETE', id)
    },
    // 清空历史记录
    clear: async (): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('HISTORY_CLEAR')
    },
    // 搜索历史记录
    search: async (
      keyword: string,
      limit?: number
    ): Promise<{ success: boolean; history: HistoryRecord[]; message?: string }> => {
      return await ipcRenderer.invoke('HISTORY_SEARCH', keyword, limit)
    }
  },
  // 下载管理 API
  downloads: {
    // 获取所有下载记录
    getAll: async (): Promise<{
      success: boolean
      downloads: DownloadRecord[]
      message?: string
    }> => {
      return await ipcRenderer.invoke('DOWNLOAD_GET_ALL')
    },
    // 删除下载记录
    delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('DOWNLOAD_DELETE', id)
    },
    // 清空下载记录
    clear: async (): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('DOWNLOAD_CLEAR')
    },
    // 打开下载文件
    open: async (savePath: string): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('DOWNLOAD_OPEN', savePath)
    },
    // 打开下载文件夹
    openFolder: async (savePath: string): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('DOWNLOAD_OPEN_FOLDER', savePath)
    },
    // 取消下载
    cancel: async (id: string): Promise<{ success: boolean; message?: string }> => {
      return await ipcRenderer.invoke('DOWNLOAD_CANCEL', id)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
