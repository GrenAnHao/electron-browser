import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerNativeWebViewManager } from '../customModel/WebView/main/NativeWebViewManager'
import { cacheManager } from './tools/cacheManager'

const logPrefix = '[main]'
const logError = (...args: unknown[]) => {
  console.error(logPrefix, ...args)
}

process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error)
})

process.on('unhandledRejection', (reason) => {
  logError('Unhandled rejection', reason)
})

function createWindow(): BrowserWindow {
  // Create the browser window.
  const window = new BrowserWindow({
    minWidth: 1000,
    minHeight: 670,
    width: 1000,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

registerNativeWebViewManager()

// 窗口控制 IPC 处理器
function registerWindowHandlers() {
  // 最小化窗口
  ipcMain.on('window-minimize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      window.minimize()
    }
  })

  // 最大化/还原窗口
  ipcMain.on('window-maximize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
      // 通知渲染进程窗口状态变化
      window.webContents.send('window-maximize-changed', window.isMaximized())
    }
  })

  // 关闭窗口
  ipcMain.on('window-close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      window.close()
    }
  })

  // 检查窗口是否最大化
  ipcMain.handle('window-is-maximized', () => {
    const window = BrowserWindow.getFocusedWindow()
    return window ? window.isMaximized() : false
  })

  // 监听窗口最大化状态变化
  app.on('browser-window-created', (_, window) => {
    window.on('maximize', () => {
      window.webContents.send('window-maximize-changed', true)
    })
    window.on('unmaximize', () => {
      window.webContents.send('window-maximize-changed', false)
    })
  })
}

function registerAutoUpdater() {
  autoUpdater.on('error', (error) => {
    logError('Auto updater error', error)
  })

  autoUpdater.on('update-available', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    mainWindow?.webContents.send('update-available')
  })

  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('CHECK_FOR_UPDATES', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logError('Check for updates failed', error)
      return { success: false, message: errorMessage }
    }
  })
}

registerWindowHandlers()

// 收藏夹数据结构
interface Favorite {
  id: string
  url: string
  title: string
  favicon?: string
  createdAt: number
}

const FAVORITES_KEY = 'favorites'

// 注册收藏夹 IPC 处理器
function registerFavoriteHandlers() {
  // 获取所有收藏夹
  ipcMain.handle('FAVORITE_GET_ALL', async () => {
    try {
      const favorites = cacheManager.get(FAVORITES_KEY) as Favorite[] | undefined
      return { success: true, favorites: favorites || [] }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `获取收藏夹失败: ${errorMessage}`, favorites: [] }
    }
  })

  // 添加收藏夹
  ipcMain.handle('FAVORITE_ADD', async (_event, favorite: Omit<Favorite, 'id' | 'createdAt'>) => {
    try {
      const favorites = (cacheManager.get(FAVORITES_KEY) as Favorite[] | undefined) || []
      // 检查是否已存在相同 URL
      const existingIndex = favorites.findIndex((f) => f.url === favorite.url)
      if (existingIndex >= 0) {
        // 如果已存在，更新它
        favorites[existingIndex] = {
          ...favorites[existingIndex],
          ...favorite,
          createdAt: favorites[existingIndex].createdAt // 保持原有创建时间
        }
      } else {
        // 添加新的收藏夹
        const newFavorite: Favorite = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          ...favorite,
          createdAt: Date.now()
        }
        favorites.push(newFavorite)
      }
      cacheManager.set(FAVORITES_KEY, favorites)
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `添加收藏夹失败: ${errorMessage}` }
    }
  })

  // 删除收藏夹
  ipcMain.handle('FAVORITE_DELETE', async (_event, id: string) => {
    try {
      const favorites = (cacheManager.get(FAVORITES_KEY) as Favorite[] | undefined) || []
      const filteredFavorites = favorites.filter((f) => f.id !== id)
      cacheManager.set(FAVORITES_KEY, filteredFavorites)
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `删除收藏夹失败: ${errorMessage}` }
    }
  })

  // 更新收藏夹
  ipcMain.handle(
    'FAVORITE_UPDATE',
    async (_event, id: string, updates: Partial<Omit<Favorite, 'id' | 'createdAt'>>) => {
      try {
        const favorites = (cacheManager.get(FAVORITES_KEY) as Favorite[] | undefined) || []
        const index = favorites.findIndex((f) => f.id === id)

        if (index >= 0) {
          favorites[index] = { ...favorites[index], ...updates }
          cacheManager.set(FAVORITES_KEY, favorites)
          return { success: true }
        } else {
          return { success: false, message: '收藏夹不存在' }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, message: `更新收藏夹失败: ${errorMessage}` }
      }
    }
  )

  // 检查 URL 是否已收藏
  ipcMain.handle('FAVORITE_CHECK', async (_event, url: string) => {
    try {
      const favorites = (cacheManager.get(FAVORITES_KEY) as Favorite[] | undefined) || []
      const favorite = favorites.find((f) => f.url === url)
      return { success: true, isFavorite: !!favorite, favorite }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `检查收藏夹失败: ${errorMessage}`, isFavorite: false }
    }
  })
}

// 历史记录数据结构
interface HistoryRecord {
  id: string
  url: string
  title: string
  favicon?: string
  visitedAt: number
  visitCount: number
}

const HISTORY_KEY = 'history'
const MAX_HISTORY_COUNT = 1000 // 最大历史记录数量

// 注册历史记录 IPC 处理器
function registerHistoryHandlers() {
  // 获取所有历史记录
  ipcMain.handle('HISTORY_GET_ALL', async (_event, limit?: number) => {
    try {
      const history = (cacheManager.get(HISTORY_KEY) as HistoryRecord[] | undefined) || []
      // 按访问时间倒序排列，最新的在前
      const sortedHistory = history.sort((a, b) => b.visitedAt - a.visitedAt)
      const limitedHistory = limit ? sortedHistory.slice(0, limit) : sortedHistory
      return { success: true, history: limitedHistory }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `获取历史记录失败: ${errorMessage}`, history: [] }
    }
  })

  // 添加历史记录
  ipcMain.handle(
    'HISTORY_ADD',
    async (_event, record: Omit<HistoryRecord, 'id' | 'visitedAt' | 'visitCount'>) => {
      try {
        const history = (cacheManager.get(HISTORY_KEY) as HistoryRecord[] | undefined) || []

        // 检查是否已存在相同 URL
        const existingIndex = history.findIndex((h) => h.url === record.url)

        if (existingIndex >= 0) {
          // 如果已存在，更新访问时间和访问次数
          history[existingIndex] = {
            ...history[existingIndex],
            ...record,
            visitedAt: Date.now(),
            visitCount: history[existingIndex].visitCount + 1
          }
        } else {
          // 添加新的历史记录
          const newRecord: HistoryRecord = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            ...record,
            visitedAt: Date.now(),
            visitCount: 1
          }
          history.push(newRecord)

          // 限制历史记录数量
          if (history.length > MAX_HISTORY_COUNT) {
            // 按访问时间排序，删除最旧的记录
            history.sort((a, b) => b.visitedAt - a.visitedAt)
            history.splice(MAX_HISTORY_COUNT)
          }
        }

        cacheManager.set(HISTORY_KEY, history)
        return { success: true }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, message: `添加历史记录失败: ${errorMessage}` }
      }
    }
  )

  // 删除历史记录
  ipcMain.handle('HISTORY_DELETE', async (_event, id: string) => {
    try {
      const history = (cacheManager.get(HISTORY_KEY) as HistoryRecord[] | undefined) || []
      const filteredHistory = history.filter((h) => h.id !== id)
      cacheManager.set(HISTORY_KEY, filteredHistory)
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `删除历史记录失败: ${errorMessage}` }
    }
  })

  // 清空历史记录
  ipcMain.handle('HISTORY_CLEAR', async () => {
    try {
      cacheManager.set(HISTORY_KEY, [])
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `清空历史记录失败: ${errorMessage}` }
    }
  })

  // 搜索历史记录
  ipcMain.handle('HISTORY_SEARCH', async (_event, keyword: string, limit: number = 50) => {
    try {
      const history = (cacheManager.get(HISTORY_KEY) as HistoryRecord[] | undefined) || []
      const lowerKeyword = keyword.toLowerCase()
      const filteredHistory = history
        .filter(
          (h) =>
            h.title.toLowerCase().includes(lowerKeyword) ||
            h.url.toLowerCase().includes(lowerKeyword)
        )
        .sort((a, b) => b.visitedAt - a.visitedAt)
        .slice(0, limit)
      return { success: true, history: filteredHistory }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `搜索历史记录失败: ${errorMessage}`, history: [] }
    }
  })
}

// 下载记录数据结构
interface DownloadRecord {
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

const DOWNLOADS_KEY = 'downloads'
const activeDownloads = new Map<number, DownloadRecord>() // key: downloadId

// 注册下载管理 IPC 处理器
function registerDownloadHandlers() {
  // 获取所有下载记录
  ipcMain.handle('DOWNLOAD_GET_ALL', async () => {
    try {
      const downloads = (cacheManager.get(DOWNLOADS_KEY) as DownloadRecord[] | undefined) || []
      // 合并活跃的下载记录
      const activeDownloadList = Array.from(activeDownloads.values())
      // 合并并去重（优先使用活跃的）
      const allDownloads = [...activeDownloadList]
      downloads.forEach((download) => {
        if (!activeDownloads.has(parseInt(download.id))) {
          allDownloads.push(download)
        }
      })
      // 按开始时间倒序排列
      allDownloads.sort((a, b) => b.startTime - a.startTime)
      return { success: true, downloads: allDownloads }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `获取下载记录失败: ${errorMessage}`, downloads: [] }
    }
  })

  // 删除下载记录
  ipcMain.handle('DOWNLOAD_DELETE', async (_event, id: string) => {
    try {
      const downloads = (cacheManager.get(DOWNLOADS_KEY) as DownloadRecord[] | undefined) || []
      const filteredDownloads = downloads.filter((d) => d.id !== id)
      cacheManager.set(DOWNLOADS_KEY, filteredDownloads)
      activeDownloads.delete(parseInt(id))
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `删除下载记录失败: ${errorMessage}` }
    }
  })

  // 清空下载记录
  ipcMain.handle('DOWNLOAD_CLEAR', async () => {
    try {
      cacheManager.set(DOWNLOADS_KEY, [])
      activeDownloads.clear()
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `清空下载记录失败: ${errorMessage}` }
    }
  })

  // 打开下载文件
  ipcMain.handle('DOWNLOAD_OPEN', async (_event, savePath: string) => {
    try {
      shell.openPath(savePath)
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `打开文件失败: ${errorMessage}` }
    }
  })

  // 打开下载文件夹
  ipcMain.handle('DOWNLOAD_OPEN_FOLDER', async (_event, savePath: string) => {
    try {
      shell.showItemInFolder(savePath)
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `打开文件夹失败: ${errorMessage}` }
    }
  })

  // 取消下载
  ipcMain.handle('DOWNLOAD_CANCEL', async (_event, id: string) => {
    try {
      const downloadId = parseInt(id)
      const downloadItem = downloadItems.get(downloadId)
      if (downloadItem) {
        downloadItem.cancel()
        // 更新记录状态
        const record = activeDownloads.get(downloadId)
        if (record) {
          record.state = 'cancelled'
          record.endTime = Date.now()
        }
        activeDownloads.delete(downloadId)
        downloadItems.delete(downloadId)
        return { success: true }
      }
      return { success: false, message: '下载项不存在或已完成' }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `取消下载失败: ${errorMessage}` }
    }
  })
}

// 存储下载项引用，用于取消下载
const downloadItems = new Map<number, Electron.DownloadItem>()
let downloadIdCounter = 0
const downloadSessions = new WeakSet<Electron.Session>()

// 监听所有 WebContents 的下载事件
function setupDownloadListeners() {
  app.on('web-contents-created', (_event, contents) => {
    const session = contents.session

    if (downloadSessions.has(session)) {
      return
    }

    downloadSessions.add(session)

    session.on('will-download', (_event, item) => {
      const url = item.getURL()
      const filename = item.getFilename()

      // 自动设置保存路径到系统下载目录
      const downloadsPath = app.getPath('downloads')
      let savePath = join(downloadsPath, filename)

      // 处理文件名冲突：如果文件已存在，添加数字后缀
      let counter = 1
      const lastDotIndex = filename.lastIndexOf('.')
      const fileExtension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : ''
      const fileNameWithoutExt = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename

      while (existsSync(savePath)) {
        const newFilename = `${fileNameWithoutExt} (${counter})${fileExtension}`
        savePath = join(downloadsPath, newFilename)
        counter++
      }

      // 设置保存路径，这样就不会弹出保存对话框
      item.setSavePath(savePath)

      // 使用递增计数器和时间戳生成唯一 ID
      downloadIdCounter++
      const downloadId = Date.now() * 10000 + downloadIdCounter

      // 检查是否已存在相同的下载（通过 URL 判断，因为文件名可能因冲突而不同）
      const existingDownload = Array.from(activeDownloads.values()).find(
        (d) => d.url === url && d.state === 'progressing'
      )

      if (existingDownload) {
        // 如果已存在相同的下载，不创建新记录
        console.log('下载已存在，跳过重复记录:', url, filename)
        return
      }

      // 存储下载项引用
      downloadItems.set(downloadId, item)

      // 获取实际保存的文件名（可能包含数字后缀）
      const actualFilename = savePath.split(/[/\\]/).pop() || filename

      // 创建下载记录
      const downloadRecord: DownloadRecord = {
        id: downloadId.toString(),
        url,
        filename: actualFilename, // 使用实际保存的文件名（可能包含数字后缀）
        savePath,
        totalBytes: item.getTotalBytes(),
        receivedBytes: item.getReceivedBytes(),
        state: 'progressing',
        startTime: Date.now()
      }

      activeDownloads.set(downloadId, downloadRecord)

      // 获取主窗口以发送消息
      const mainWindow = BrowserWindow.getAllWindows()[0]

      // 通知渲染进程开始下载
      mainWindow?.webContents.send('download-started', downloadRecord)

      // 下载进度更新
      item.on('updated', (_event, state) => {
        const record = activeDownloads.get(downloadId)
        if (record) {
          record.receivedBytes = item.getReceivedBytes()
          record.totalBytes = item.getTotalBytes()
          record.state = state

          if (state === 'progressing') {
            mainWindow?.webContents.send('download-progress', {
              id: downloadId.toString(),
              receivedBytes: record.receivedBytes,
              totalBytes: record.totalBytes,
              state: record.state
            })
          }
        }
      })

      // 下载完成
      item.once('done', (_event, state) => {
        const record = activeDownloads.get(downloadId)
        if (record) {
          record.state = state
          record.endTime = Date.now()
          record.savePath = item.getSavePath() || ''

          if (state === 'completed') {
            // 保存到持久化存储
            const downloads =
              (cacheManager.get(DOWNLOADS_KEY) as DownloadRecord[] | undefined) || []
            downloads.push(record)
            cacheManager.set(DOWNLOADS_KEY, downloads)

            mainWindow?.webContents.send('download-completed', record)
          } else if (state === 'cancelled') {
            mainWindow?.webContents.send('download-cancelled', {
              id: downloadId.toString()
            })
          } else if (state === 'interrupted') {
            record.error = item.getState() === 'interrupted' ? '下载被中断' : '未知错误'
            mainWindow?.webContents.send('download-interrupted', record)
          }

          // 从活跃下载中移除
          activeDownloads.delete(downloadId)
          downloadItems.delete(downloadId)
        }
      })
    })
  })
}

registerFavoriteHandlers()
registerHistoryHandlers()
registerDownloadHandlers()
setupDownloadListeners()

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.guanren.xonlinebrowser')
  // 设置应用名称
  app.setName('X Online Browser')
  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()

  registerAutoUpdater()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
