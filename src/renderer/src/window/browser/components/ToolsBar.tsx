import {
  Button,
  ButtonGroup,
  Dropdown,
  Input,
  Layout,
  Image,
  Toast,
  Progress,
  List
} from '@douyinfe/semi-ui'
import {
  IconAlignBottom,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconFavoriteList,
  IconHistory,
  IconRefresh,
  IconStar,
  IconStarStroked,
  IconDelete
} from '@douyinfe/semi-icons'
import { useEffect, useState, useCallback, useRef } from 'react'
import './ToolsBar.css'

// 收藏夹数据结构
interface Favorite {
  id: string
  url: string
  title: string
  favicon?: string
  createdAt: number
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

const { Header } = Layout

interface ToolsBarProps {
  event: (method: string, args?: string) => any
  url: string
  title?: string
  favicon?: string
}

const ToolsBar = (props: ToolsBarProps) => {
  const { event, url, title, favicon } = props
  const [thisUrl, setThisUrl] = useState(url)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isCurrentFavorite, setIsCurrentFavorite] = useState(false)
  const [currentFavoriteId, setCurrentFavoriteId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [historySearchKeyword, setHistorySearchKeyword] = useState('')
  const [downloads, setDownloads] = useState<DownloadRecord[]>([])
  const [historyMenuVisible, setHistoryMenuVisible] = useState(false)
  // 用于跟踪下载速度的数据
  const downloadSpeedRef = useRef<
    Map<string, { lastBytes: number; lastTime: number; lastSpeed: number }>
  >(new Map())

  // 加载收藏夹列表
  const loadFavorites = useCallback(async () => {
    try {
      const result = await window.api.favorites.getAll()
      if (result.success) {
        setFavorites(result.favorites)
      }
    } catch (error) {
      console.error('加载收藏夹失败:', error)
    }
  }, [])

  // 检查当前页面是否已收藏
  const checkCurrentFavorite = useCallback(async () => {
    if (!url || url === 'about:blank' || url === 'about:home') {
      setIsCurrentFavorite(false)
      setCurrentFavoriteId(null)
      return
    }
    try {
      const result = await window.api.favorites.check(url)
      if (result.success) {
        setIsCurrentFavorite(result.isFavorite)
        setCurrentFavoriteId(result.favorite?.id || null)
      }
    } catch (error) {
      console.error('检查收藏状态失败:', error)
    }
  }, [url])

  // 添加收藏夹
  const handleAddFavorite = useCallback(async () => {
    if (!url || url === 'about:blank' || url === 'about:home') {
      Toast.warning('无法收藏当前页面')
      return
    }
    try {
      const result = await window.api.favorites.add({
        url,
        title: title || url,
        favicon: favicon
      })
      if (result.success) {
        Toast.success('已添加到收藏夹')
        await loadFavorites()
        await checkCurrentFavorite()
      } else {
        Toast.error(result.message || '添加收藏夹失败')
      }
    } catch (error) {
      console.error('添加收藏夹失败:', error)
      Toast.error('添加收藏夹失败')
    }
  }, [url, title, favicon, loadFavorites, checkCurrentFavorite])

  // 删除收藏夹
  const handleDeleteFavorite = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }
      try {
        const result = await window.api.favorites.delete(id)
        if (result.success) {
          Toast.success('已从收藏夹删除')
          await loadFavorites()
          await checkCurrentFavorite()
        } else {
          Toast.error(result.message || '删除收藏夹失败')
        }
      } catch (error) {
        console.error('删除收藏夹失败:', error)
        Toast.error('删除收藏夹失败')
      }
    },
    [loadFavorites, checkCurrentFavorite]
  )

  // 打开收藏夹链接
  const handleOpenFavorite = useCallback(
    (favoriteUrl: string) => {
      event('loadUrl', favoriteUrl)
    },
    [event]
  )

  useEffect(() => {
    console.log('ToolsBar received URL:', url)
    setThisUrl(url === 'about:home' ? '' : url)
  }, [url])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  useEffect(() => {
    checkCurrentFavorite()
  }, [checkCurrentFavorite])

  // 加载历史记录列表
  const loadHistory = useCallback(async (limit: number = 50) => {
    try {
      const result = await window.api.history.getAll(limit)
      if (result.success) {
        setHistory(result.history)
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }, [])

  // 搜索历史记录
  const searchHistory = useCallback(
    async (keyword: string) => {
      if (!keyword.trim()) {
        await loadHistory()
        return
      }
      try {
        const result = await window.api.history.search(keyword, 50)
        if (result.success) {
          setHistory(result.history)
        }
      } catch (error) {
        console.error('搜索历史记录失败:', error)
      }
    },
    [loadHistory]
  )

  // 删除历史记录
  const handleDeleteHistory = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const result = await window.api.history.delete(id)
        if (result.success) {
          Toast.success('已删除历史记录')
          await loadHistory()
        } else {
          Toast.error(result.message || '删除历史记录失败')
        }
      } catch (error) {
        console.error('删除历史记录失败:', error)
        Toast.error('删除历史记录失败')
      }
    },
    [loadHistory]
  )

  // 清空历史记录
  const handleClearHistory = useCallback(async () => {
    try {
      const result = await window.api.history.clear()
      if (result.success) {
        Toast.success('已清空历史记录')
        setHistory([])
      } else {
        Toast.error(result.message || '清空历史记录失败')
      }
    } catch (error) {
      console.error('清空历史记录失败:', error)
      Toast.error('清空历史记录失败')
    }
  }, [])

  // 打开历史记录链接
  const handleOpenHistory = useCallback(
    (historyUrl: string) => {
      event('loadUrl', historyUrl)
    },
    [event]
  )

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 当历史记录菜单打开时，刷新历史记录列表
  useEffect(() => {
    if (historyMenuVisible && !historySearchKeyword) {
      loadHistory()
    }
  }, [historyMenuVisible, historySearchKeyword, loadHistory])

  // 加载下载列表
  const loadDownloads = useCallback(async () => {
    try {
      const result = await window.api.downloads.getAll()
      if (result.success) {
        setDownloads(result.downloads)
      }
    } catch (error) {
      console.error('加载下载记录失败:', error)
    }
  }, [])

  // 删除下载记录
  const handleDeleteDownload = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const result = await window.api.downloads.delete(id)
        if (result.success) {
          Toast.success('已删除下载记录')
          await loadDownloads()
        } else {
          Toast.error(result.message || '删除下载记录失败')
        }
      } catch (error) {
        console.error('删除下载记录失败:', error)
        Toast.error('删除下载记录失败')
      }
    },
    [loadDownloads]
  )

  // 清空下载记录
  const handleClearDownloads = useCallback(async () => {
    try {
      const result = await window.api.downloads.clear()
      if (result.success) {
        Toast.success('已清空下载记录')
        setDownloads([])
      } else {
        Toast.error(result.message || '清空下载记录失败')
      }
    } catch (error) {
      console.error('清空下载记录失败:', error)
      Toast.error('清空下载记录失败')
    }
  }, [])

  // 打开下载文件
  const handleOpenDownload = useCallback(async (savePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await window.api.downloads.open(savePath)
      if (!result.success) {
        Toast.error(result.message || '打开文件失败')
      }
    } catch (error) {
      console.error('打开文件失败:', error)
      Toast.error('打开文件失败')
    }
  }, [])

  // 打开下载文件夹
  const handleOpenDownloadFolder = useCallback(async (savePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await window.api.downloads.openFolder(savePath)
      if (!result.success) {
        Toast.error(result.message || '打开文件夹失败')
      }
    } catch (error) {
      console.error('打开文件夹失败:', error)
      Toast.error('打开文件夹失败')
    }
  }, [])

  // 取消下载
  const handleCancelDownload = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const result = await window.api.downloads.cancel(id)
        if (result.success) {
          Toast.success('已取消下载')
          await loadDownloads()
        } else {
          Toast.error(result.message || '取消下载失败')
        }
      } catch (error) {
        console.error('取消下载失败:', error)
        Toast.error('取消下载失败')
      }
    },
    [loadDownloads]
  )

  // 格式化文件大小（智能换算：3位数显示当前单位，超过3位数自动换算）
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

    // 从 B 开始计算
    let value = bytes
    let unitIndex = 0

    // 逐步换算单位，直到值小于1000（3位数）或到达最大单位
    while (value >= 1000 && unitIndex < sizes.length - 1) {
      value = value / k
      unitIndex++
    }

    // 格式化显示，保留最多2位小数
    const formattedValue = value >= 100 ? Math.round(value) : Math.round(value * 100) / 100
    return `${formattedValue} ${sizes[unitIndex]}`
  }, [])

  // 格式化下载时间
  const formatDownloadTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }, [])

  // 计算下载速度
  const calculateDownloadSpeed = useCallback((download: DownloadRecord): number => {
    if (download.state !== 'progressing' || download.receivedBytes === 0) {
      return 0
    }

    const now = Date.now()
    const lastData = downloadSpeedRef.current.get(download.id)

    if (!lastData) {
      // 第一次记录
      downloadSpeedRef.current.set(download.id, {
        lastBytes: download.receivedBytes,
        lastTime: now,
        lastSpeed: 0
      })
      return 0
    }

    const timeDiff = (now - lastData.lastTime) / 1000 // 转换为秒
    const bytesDiff = download.receivedBytes - lastData.lastBytes

    // 如果时间间隔太短（小于0.5秒），返回上次计算的速度
    if (timeDiff < 0.5) {
      return lastData.lastSpeed
    }

    const speed = bytesDiff / timeDiff // 字节/秒

    // 更新记录（只在时间间隔足够长时更新）
    downloadSpeedRef.current.set(download.id, {
      lastBytes: download.receivedBytes,
      lastTime: now,
      lastSpeed: speed
    })

    return speed
  }, [])

  // 格式化下载速度
  const formatDownloadSpeed = useCallback(
    (speed: number) => {
      if (speed === 0) return ''
      return `${formatFileSize(speed)}/s`
    },
    [formatFileSize]
  )

  useEffect(() => {
    loadDownloads()
  }, [loadDownloads])

  // 定期更新下载速度显示（每秒更新一次）
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloads((prev) => {
        const hasProgressing = prev.some((d) => d.state === 'progressing')
        if (hasProgressing) {
          // 触发重新渲染以更新速度显示
          return [...prev]
        }
        return prev
      })
    }, 1000) // 每秒更新一次

    return () => clearInterval(interval)
  }, [])

  // 监听下载事件
  useEffect(() => {
    const handleDownloadStarted = (_event: any, record: DownloadRecord) => {
      // 检查是否已存在相同的下载记录（通过 URL 和文件名）
      setDownloads((prev) => {
        // 通过 URL 判断是否已存在相同的下载（文件名可能因冲突而不同）
        const exists = prev.some((d) => d.url === record.url && d.state === 'progressing')
        if (exists) {
          console.log('下载记录已存在，跳过重复:', record.url, record.filename)
          return prev
        }
        return [record, ...prev.filter((d) => d.id !== record.id)]
      })
    }

    const handleDownloadProgress = (
      _event: any,
      progress: { id: string; receivedBytes: number; totalBytes: number }
    ) => {
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === progress.id
            ? { ...d, receivedBytes: progress.receivedBytes, totalBytes: progress.totalBytes }
            : d
        )
      )
    }

    const handleDownloadCompleted = (_event: any, record: DownloadRecord) => {
      // 清理速度跟踪数据
      downloadSpeedRef.current.delete(record.id)
      setDownloads((prev) => {
        // 更新现有记录，如果不存在则添加
        const exists = prev.some((d) => d.id === record.id)
        if (exists) {
          return prev.map((d) => (d.id === record.id ? record : d))
        }
        // 如果不存在，检查是否有相同 URL 的进行中记录（文件名可能因冲突而不同）
        const existingIndex = prev.findIndex(
          (d) => d.url === record.url && d.state === 'progressing'
        )
        if (existingIndex >= 0) {
          // 替换现有记录
          const newDownloads = [...prev]
          newDownloads[existingIndex] = record
          return newDownloads
        }
        // 添加新记录
        return [record, ...prev]
      })
    }

    const handleDownloadCancelled = (_event: any, data: { id: string }) => {
      // 清理速度跟踪数据
      downloadSpeedRef.current.delete(data.id)
      setDownloads((prev) =>
        prev.map((d) => (d.id === data.id ? { ...d, state: 'cancelled' as const } : d))
      )
    }

    const handleDownloadInterrupted = (_event: any, record: DownloadRecord) => {
      setDownloads((prev) => prev.map((d) => (d.id === record.id ? record : d)))
    }

    window.electron.ipcRenderer.on('download-started', handleDownloadStarted)
    window.electron.ipcRenderer.on('download-progress', handleDownloadProgress)
    window.electron.ipcRenderer.on('download-completed', handleDownloadCompleted)
    window.electron.ipcRenderer.on('download-cancelled', handleDownloadCancelled)
    window.electron.ipcRenderer.on('download-interrupted', handleDownloadInterrupted)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('download-started')
      window.electron.ipcRenderer.removeAllListeners('download-progress')
      window.electron.ipcRenderer.removeAllListeners('download-completed')
      window.electron.ipcRenderer.removeAllListeners('download-cancelled')
      window.electron.ipcRenderer.removeAllListeners('download-interrupted')
    }
  }, [])

  // 格式化时间显示
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }, [])

  // 构建历史记录菜单
  const historyMenuContent = (
    <Dropdown.Menu
      style={{
        maxHeight: '400px',
        overflow: 'hidden',
        minWidth: '380px',
        maxWidth: '380px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ padding: '8px', flexShrink: 0 }}>
        <Input
          placeholder="搜索历史记录"
          value={historySearchKeyword}
          onChange={(value) => {
            setHistorySearchKeyword(value)
            searchHistory(value)
          }}
          style={{ width: '100%' }}
          showClear
        />
      </div>
      <Dropdown.Divider />
      {history.length > 0 && (
        <>
          <div
            style={{
              padding: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--semi-color-text-2)' }}>
              最近访问 ({history.length})
            </span>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              onClick={handleClearHistory}
              style={{ fontSize: '12px' }}
            >
              清空
            </Button>
          </div>
          <List
            dataSource={history}
            className="component-list-demo-booklist"
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: 1,
              minHeight: 0
            }}
            renderItem={(record) => (
              <List.Item
                key={record.id}
                onClick={() => handleOpenHistory(record.url)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    minWidth: 0
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden'
                    }}
                  >
                    {record.favicon && (
                      <Image width={16} height={16} src={record.favicon} preview={false} />
                    )}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden'
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '13px'
                        }}
                        title={record.title}
                      >
                        {record.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--semi-color-text-2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={record.url}
                      >
                        {record.url}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--semi-color-text-2)',
                        marginLeft: '8px',
                        flexShrink: 0
                      }}
                    >
                      {formatTime(record.visitedAt)}
                    </span>
                  </div>
                  <Button
                    theme="borderless"
                    type="tertiary"
                    icon={<IconDelete size="small" />}
                    size="small"
                    onClick={(e) => handleDeleteHistory(record.id, e)}
                    style={{ marginLeft: '8px', flexShrink: 0 }}
                  />
                </div>
              </List.Item>
            )}
          />
        </>
      )}
      {history.length === 0 && (
        <Dropdown.Item disabled style={{ textAlign: 'center', width: '100%' }}>
          暂无历史记录
        </Dropdown.Item>
      )}
    </Dropdown.Menu>
  )

  // 构建下载菜单
  const downloadsMenuContent = (
    <Dropdown.Menu
      style={{
        maxHeight: '400px',
        overflowY: 'auto',
        overflowX: 'hidden',
        minWidth: '380px',
        maxWidth: '380px'
      }}
    >
      {downloads.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--semi-color-text-2)' }}>
              下载 ({downloads.length})
            </span>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              onClick={handleClearDownloads}
              style={{ fontSize: '12px' }}
            >
              清空
            </Button>
          </div>
          <Dropdown.Divider />
          <List
            dataSource={downloads}
            className="component-list-demo-booklist"
            style={{ maxHeight: '340px', overflowY: 'auto', overflowX: 'hidden' }}
            renderItem={(download) => {
              const progress =
                download.totalBytes > 0
                  ? Math.round((download.receivedBytes / download.totalBytes) * 100)
                  : 0
              const isCompleted = download.state === 'completed'
              const isProgressing = download.state === 'progressing'
              const isCancelled = download.state === 'cancelled'
              const isInterrupted = download.state === 'interrupted'

              return (
                <List.Item
                  key={download.id}
                  onClick={() => {
                    if (isCompleted && download.savePath) {
                      handleOpenDownload(download.savePath, {} as React.MouseEvent)
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: isCompleted ? 'pointer' : 'default',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      minWidth: 0,
                      gap: '6px'
                    }}
                  >
                    {/* 文件名和操作按钮行 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '8px',
                        width: '100%'
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '13px',
                          flex: 1,
                          minWidth: 0,
                          lineHeight: '20px'
                        }}
                        title={download.filename}
                      >
                        {download.filename}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isProgressing && (
                          <Button
                            theme="borderless"
                            type="tertiary"
                            size="small"
                            onClick={(e) => handleCancelDownload(download.id, e)}
                            style={{ fontSize: '11px', padding: '2px 6px', height: '20px' }}
                          >
                            取消
                          </Button>
                        )}
                        {isCompleted && download.savePath && (
                          <Button
                            theme="borderless"
                            type="tertiary"
                            size="small"
                            onClick={(e) => handleOpenDownloadFolder(download.savePath, e)}
                            style={{ fontSize: '11px', padding: '2px 6px', height: '20px' }}
                          >
                            打开文件夹
                          </Button>
                        )}
                        <Button
                          theme="borderless"
                          type="tertiary"
                          icon={<IconDelete size="small" />}
                          size="small"
                          onClick={(e) => handleDeleteDownload(download.id, e)}
                          style={{ flexShrink: 0, width: '20px', height: '20px', padding: 0 }}
                        />
                      </div>
                    </div>
                    {/* 进度条或状态信息 */}
                    {isProgressing && (
                      <div style={{ width: '100%', marginTop: '2px' }}>
                        {(() => {
                          const speed = calculateDownloadSpeed(download)
                          const speedText = formatDownloadSpeed(speed)
                          return (
                            <>
                              <Progress
                                percent={progress}
                                size="small"
                                showInfo={false}
                                style={{ marginBottom: '4px' }}
                              />
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--semi-color-text-2)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
                                <span>
                                  {formatFileSize(download.receivedBytes)} /{' '}
                                  {formatFileSize(download.totalBytes)}
                                </span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {speedText && <span>{speedText}</span>}
                                  <span>{progress}%</span>
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {isCompleted && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--semi-color-text-2)',
                          display: 'flex',
                          gap: '8px',
                          justifyContent: 'flex-start',
                          alignItems: 'center'
                        }}
                      >
                        <span>{formatFileSize(download.totalBytes)}</span>
                        <span>•</span>
                        <span>{formatDownloadTime(download.startTime)}</span>
                      </div>
                    )}
                    {isCancelled && (
                      <div style={{ fontSize: '11px', color: 'var(--semi-color-warning)' }}>
                        已取消
                      </div>
                    )}
                    {isInterrupted && (
                      <div style={{ fontSize: '11px', color: 'var(--semi-color-danger)' }}>
                        {download.error || '下载中断'}
                      </div>
                    )}
                  </div>
                </List.Item>
              )
            }}
          />
        </>
      )}
      {downloads.length === 0 && (
        <Dropdown.Item disabled style={{ textAlign: 'center', padding: '20px', width: '100%' }}>
          暂无下载记录
        </Dropdown.Item>
      )}
    </Dropdown.Menu>
  )

  // 构建收藏夹菜单
  const favoriteMenuContent = (
    <Dropdown.Menu
      style={{
        minWidth: '320px',
        maxWidth: '320px',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Dropdown.Item
        icon={isCurrentFavorite ? <IconStar /> : <IconStarStroked />}
        onClick={async (e) => {
          if (isCurrentFavorite && currentFavoriteId) {
            await handleDeleteFavorite(currentFavoriteId, e)
          } else {
            await handleAddFavorite()
          }
        }}
        style={{ width: '100%' }}
      >
        {isCurrentFavorite ? '取消收藏' : '添加收藏'}
      </Dropdown.Item>
      {favorites.length > 0 && (
        <>
          <Dropdown.Divider />
          <Dropdown.Title>收藏夹</Dropdown.Title>
          <List
            dataSource={favorites}
            className="component-list-demo-booklist"
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: 1,
              minHeight: 0
            }}
            renderItem={(favorite) => (
              <List.Item
                key={favorite.id}
                onClick={() => handleOpenFavorite(favorite.url)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    minWidth: 0
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden'
                    }}
                  >
                    {favorite.favicon && (
                      <Image width={16} height={16} src={favorite.favicon} preview={false} />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={favorite.title}
                    >
                      {favorite.title}
                    </span>
                  </div>
                  <Button
                    theme="borderless"
                    type="tertiary"
                    icon={<IconDelete size="small" />}
                    size="small"
                    onClick={(e) => handleDeleteFavorite(favorite.id, e)}
                    style={{ marginLeft: '8px', flexShrink: 0 }}
                  />
                </div>
              </List.Item>
            )}
          />
        </>
      )}
      {favorites.length === 0 && (
        <Dropdown.Item disabled style={{ width: '100%' }}>
          暂无收藏
        </Dropdown.Item>
      )}
    </Dropdown.Menu>
  )
  return (
    <Header
      style={{
        borderBottom: '1px solid var(--semi-color-border)',
        paddingLeft: '5px',
        paddingRight: '5px',
        height: '40px'
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '5px',
          alignItems: 'center'
        }}
      >
        <ButtonGroup theme={'borderless'}>
          <Button icon={<IconArrowLeft />} onClick={() => event('goBack')} />
          <Button icon={<IconArrowRight />} onClick={() => event('goForward')} />
          <Button icon={<IconRefresh />} onClick={() => event('reload')} />
        </ButtonGroup>
        <Input
          style={{
            flex: 1,
            minWidth: 0,
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text'
          }}
          showClear
          suffix={
            <Button
              theme={'borderless'}
              icon={<IconArrowUp />}
              onClick={() => event('loadUrl', thisUrl)}
            />
          }
          onEnterPress={() => {
            if (
              thisUrl.startsWith('http://') ||
              thisUrl.startsWith('https://') ||
              thisUrl.startsWith('file://')
            ) {
              event('loadUrl', thisUrl)
            } else if (thisUrl.includes('.') && !thisUrl.includes(' ')) {
              // 如果包含点号且不包含空格，认为是网址
              event('loadUrl', `http://${thisUrl}`)
            } else {
              // 否则作为搜索关键词处理
              event('loadUrl', `https://www.bing.com/search?q=${encodeURIComponent(thisUrl)}`)
            }
          }}
          value={thisUrl}
          onChange={(value) => {
            console.log('Input value changed to:', value)
            setThisUrl(value)
          }}
        />
        <Dropdown trigger={'click'} position={'bottomRight'} render={favoriteMenuContent}>
          <Button
            key={'favorite'}
            theme={'borderless'}
            icon={isCurrentFavorite ? <IconStar /> : <IconFavoriteList />}
          />
        </Dropdown>
        <Dropdown trigger={'click'} position={'bottomRight'} render={downloadsMenuContent}>
          <Button key={'downloads'} theme={'borderless'} icon={<IconAlignBottom />} />
        </Dropdown>
        <Dropdown
          trigger={'click'}
          position={'bottomRight'}
          render={historyMenuContent}
          visible={historyMenuVisible}
          onVisibleChange={(visible) => {
            setHistoryMenuVisible(visible)
          }}
        >
          <Button key={'historical_records'} theme={'borderless'} icon={<IconHistory />} />
        </Dropdown>
      </div>
    </Header>
  )
}

export default ToolsBar
