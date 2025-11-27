import React, { useCallback, useEffect, useRef } from 'react'
import { WebAction } from './shared'
// Cookie 接口定义
interface Cookie {
  name: string
  value: string
  domain?: string
  hostOnly?: boolean
  httpOnly?: boolean
  path?: string
  secure?: boolean
  url?: string
  expirationDate?: number
}

// 缓存类型枚举
type CacheType = 'default' | 'persistent' | 'memory' | 'isolated'

// WebView组件属性接口
interface NativeWebViewProps {
  /** 要加载的URL */
  url: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** CSS类名 */
  className?: string
  /** 分区标识 */
  partition?: string
  /** 缓存标签，用于区分不同的缓存策略 */
  tag?: string
  /** 缓存类型 */
  cacheType?: CacheType
  /** 页面加载完成回调 */
  onDidFinishLoad?: (url: string) => void
  /** 页面加载失败回调 */
  onDidFailLoad?: (errorCode: number, errorDescription: string) => void
  /** 页面标题更新回调 */
  onPageTitleUpdated?: (title: string) => void
  /** 页面图标更新回调 */
  onPageFaviconUpdated?: (favicon: string[]) => void
  /** URL变化回调 */
  onUrlChange?: (url: string) => void
  /** 是否可见 */
  visible?: boolean
  /** 用户代理字符串 */
  useragent?: string
  /** 缩放因子 */
  zoom?: number
}

// Electron IPC渲染器
const ipcRenderer = window.electron.ipcRenderer

/**
 * Cookie 管理器
 * 提供对 WebView 会话 Cookie 的管理功能
 */
export class CookieManager {
  private partitionId: string

  public constructor(partitionId: string) {
    this.partitionId = partitionId
  }

  /**
   * 设置 Cookie
   * @param cookie Cookie 对象
   */
  public async setCookie(cookie: Cookie): Promise<{ success: boolean; message?: string }> {
    try {
      // 创建可序列化的 cookie 对象副本
      const serializableCookie = {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        hostOnly: cookie.hostOnly,
        httpOnly: cookie.httpOnly,
        path: cookie.path,
        secure: cookie.secure,
        url: cookie.url,
        expirationDate: cookie.expirationDate
      }

      return await ipcRenderer.invoke('NATIVE_WEBVIEW_COOKIE_SET', {
        partition: this.partitionId,
        cookie: serializableCookie
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `IPC 调用失败: ${errorMessage}` }
    }
  }

  /**
   * 获取 Cookie
   * @param filter 过滤条件
   */
  public async getCookie(
    filter?: Electron.CookiesGetFilter
  ): Promise<{ success: boolean; cookies?: Electron.Cookie[]; message?: string }> {
    try {
      return await ipcRenderer.invoke('NATIVE_WEBVIEW_COOKIE_GET', {
        partition: this.partitionId,
        filter
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `IPC 调用失败: ${errorMessage}` }
    }
  }

  /**
   * 删除 Cookie
   * @param url URL
   * @param name Cookie 名称
   */
  public async removeCookie(
    url: string,
    name: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await ipcRenderer.invoke('NATIVE_WEBVIEW_COOKIE_REMOVE', {
        partition: this.partitionId,
        url,
        name
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `IPC 调用失败: ${errorMessage}` }
    }
  }
}

/**
 * NativeWebView组件
 * 提供对Electron WebView标签的封装，支持各种WebView操作
 */
const NativeWebView = React.forwardRef<WebAction, NativeWebViewProps>(
  (
    {
      url,
      style,
      className,
      partition,
      tag,
      cacheType = 'default',
      onDidFinishLoad,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      onUrlChange,
      visible = true,
      useragent,
      zoom
    },
    ref
  ) => {
    // WebView引用
    const webviewRef = useRef<Electron.WebviewTag>(null)
    // WebView ID引用
    const viewIdRef = useRef<number>(-1)
    // 页面加载完成回调引用
    const onDidFinishLoadRef = useRef(onDidFinishLoad)
    // 页面加载失败回调引用
    const onDidFailLoadRef = useRef(onDidFailLoad)
    // 页面标题更新回调引用
    const onPageTitleUpdatedRef = useRef(onPageTitleUpdated)
    // 页面图标更新回调引用
    const onPageFaviconUpdatedRef = useRef(onPageFaviconUpdated)
    // URL变化回调引用
    const onUrlChangeRef = useRef(onUrlChange)
    // Cookie 管理器引用
    const cookieManagerRef = useRef<CookieManager | null>(null)
    // 缓存生成的 partition ID（特别是对于 isolated 类型）
    const partitionIdRef = useRef<string | null>(null)

    const domReady = useRef(false)

    //
    // 更新回调引用当回调改变时
    useEffect(() => {
      onDidFinishLoadRef.current = onDidFinishLoad
    }, [onDidFinishLoad])

    useEffect(() => {
      onDidFailLoadRef.current = onDidFailLoad
    }, [onDidFailLoad])

    useEffect(() => {
      onPageTitleUpdatedRef.current = onPageTitleUpdated
    }, [onPageTitleUpdated])

    useEffect(() => {
      onPageFaviconUpdatedRef.current = onPageFaviconUpdated
    }, [onPageFaviconUpdated])

    useEffect(() => {
      onUrlChangeRef.current = onUrlChange
    }, [onUrlChange])
    // // 生成分区标识
    const generatePartition = useCallback((): string => {
      // 如果已经有缓存的 partition ID，直接返回
      if (partitionIdRef.current) {
        return partitionIdRef.current
      }

      // 如果已经提供了partition属性，直接使用
      if (partition) {
        partitionIdRef.current = partition
        return partition
      }

      // 根据缓存类型和标签生成分区标识
      let partitionId: string
      switch (cacheType) {
        case 'persistent':
          // 持久化缓存
          partitionId = tag ? `persist:${tag}` : 'persist:default'
          break
        case 'memory':
          // 内存缓存
          partitionId = tag ? `memory:${tag}` : 'memory:default'
          break
        case 'isolated':
          // 独立隔离缓存（使用随机标识）
          partitionId = `isolated:${tag || Math.random().toString(36).substring(2, 11)}`
          break
        case 'default':
        default:
          // 默认缓存
          partitionId = tag ? `persist:${tag}` : 'persist:default'
          break
      }

      // 缓存生成的 partition ID
      partitionIdRef.current = partitionId
      return partitionId
    }, [partition, tag, cacheType])

    // 暴露控制方法给父组件
    React.useImperativeHandle(
      ref,
      (): WebAction => ({
        /**
         * 后退
         */
        goBack: () => {
          if (webviewRef.current) {
            webviewRef.current.goBack()
          }
          // 通知主进程执行相应操作
        },

        /**
         * 前进
         */
        goForward: () => {
          if (webviewRef.current) {
            webviewRef.current.goForward()
          }
          // 通知主进程执行相应操作
        },

        /**
         * 重新加载
         */
        reload: () => {
          if (webviewRef.current) {
            webviewRef.current.reload()
          }
          // 通知主进程执行相应操作
        },

        /**
         * 执行JavaScript代码
         * @param code 要执行的JavaScript代码
         */
        executeJavaScript: (code: string) => {
          if (webviewRef.current) {
            // 直接在渲染进程中执行 JavaScript，不通过主进程
            return webviewRef.current.executeJavaScript(code)
          }
          return Promise.resolve()
        },

        /**
         * 打开开发者工具
         */
        openDevTools: () => {
          if (webviewRef.current) {
            webviewRef.current.openDevTools()
          }
        },

        /**
         * 获取 Cookie 管理器
         */
        getCookieManager: (): CookieManager => {
          if (!cookieManagerRef.current) {
            // 只有在 Cookie 管理器未初始化时才创建新的实例
            // 使用在 DOM 准备就绪时创建的相同 partitionId
            cookieManagerRef.current = new CookieManager(generatePartition())
          }
          return cookieManagerRef.current
        },
        loadURL: (url: string) => {
          if (webviewRef.current) {
            webviewRef.current.loadURL(url)
          }
        },
        getUrl: async () => {
          if (webviewRef.current && domReady.current) {
            return webviewRef.current.getURL()
          }
          return Promise.resolve('')
        },
        getTitle: () => {
          if (webviewRef.current && domReady.current) {
            return webviewRef.current.getTitle()
          }
          return ''
        }
      })
    )

    // 处理 WebView 事件监听：仅在挂载/卸载时运行，避免每次渲染都触发清理和重新注册
    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      // 页面加载完成处理
      const handleFinishLoad = () => {
        onDidFinishLoadRef.current?.(url)
      }

      // 页面加载失败处理
      const handleFailLoad = (event: Electron.DidFailLoadEvent) => {
        onDidFailLoadRef.current?.(event.errorCode, event.errorDescription)
      }

      // 页面标题更新处理
      const handlePageTitleUpdated = (event: Electron.PageTitleUpdatedEvent) => {
        console.log('Page title updated in WebView:', event.title)
        onPageTitleUpdatedRef.current?.(event.title)
      }
      // 页面图标更新处理
      const handlePageFaviconUpdated = (event: Electron.PageFaviconUpdatedEvent) => {
        onPageFaviconUpdatedRef.current?.(event.favicons)
      }

      // DOM准备就绪处理
      const handleDomReady = async () => {
        console.log('顶级Frame Dom 加载完毕')
        domReady.current = true
        const webContentsId = webview.getWebContentsId()

        // 如果当前 webContentsId 与已注册的一致，说明只是重复的 dom-ready，直接跳过
        if (viewIdRef.current === webContentsId) {
          return
        }

        // 如果存在旧的、不同的 webContentsId，则先让主进程销毁旧实例
        if (viewIdRef.current !== -1 && viewIdRef.current !== webContentsId) {
          ipcRenderer.send('NATIVE_WEBVIEW_DESTROY', viewIdRef.current)
        }

        // 更新为当前的 webContentsId，并在主进程注册
        viewIdRef.current = webContentsId
        // 使用已缓存的 partition ID，而不是重新生成
        const partitionId = generatePartition()
        await ipcRenderer.invoke('NATIVE_WEBVIEW_CREATE', webContentsId, partitionId)

        // 初始化 Cookie 管理器（如果尚未初始化）
        if (!cookieManagerRef.current) {
          cookieManagerRef.current = new CookieManager(partitionId)
        }

        // 设置用户代理（如果提供）
        if (useragent) {
          webview.setUserAgent(useragent)
        }
      }

      // 页面导航处理
      const handleDidNavigate = (event: Electron.DidNavigateEvent) => {
        // 当页面导航时触发，更新URL和标题
        console.log('did-navigate event:', event.url)
        // 调用URL变化回调
        onUrlChangeRef.current?.(event.url)
        // 延迟一小段时间以确保页面标题已更新
        setTimeout(() => {
          onPageTitleUpdatedRef.current?.(webview.getTitle())
        }, 100)
      }

      // 页面内导航处理（SPA 路由变化）
      const handleDidNavigateInPage = (event: Electron.DidNavigateInPageEvent) => {
        // 当页面内导航时触发，更新标题
        console.log('did-navigate-in-page event:', event.url)
        // 调用URL变化回调
        onUrlChangeRef.current?.(event.url)

        // 对于 SPA，需要多次尝试获取标题，因为 DOM 可能需要时间更新
        const tryUpdateTitle = (attempt: number = 0) => {
          setTimeout(
            () => {
              try {
                const title = webview.getTitle()
                if (title && title.trim() !== '') {
                  onPageTitleUpdatedRef.current?.(title)
                } else if (attempt < 3) {
                  // 如果标题为空且未超过最大尝试次数，继续尝试
                  tryUpdateTitle(attempt + 1)
                }
              } catch (error) {
                console.error('获取标题失败:', error)
                if (attempt < 3) {
                  tryUpdateTitle(attempt + 1)
                }
              }
            },
            attempt === 0 ? 200 : 300
          ) // 第一次延迟 200ms，后续延迟 300ms
        }

        // 开始尝试更新标题
        tryUpdateTitle()

        // Favicon 更新已通过 page-favicon-updated 事件处理，无需手动获取
      }

      // 添加对新窗口消息的处理
      const handleNewWindowMessage = (_event: Electron.IpcMessageEvent, url: string) => {
        console.log('Received new-window message:', url)
        // 可以在这里处理新窗口消息，例如发送到主进程创建新标签页
      }

      // 添加对 update-target-url 事件的处理
      const handleUpdateTargetUrl = (event: any) => {
        // 当鼠标悬停在链接上时触发
        console.log('update-target-url event:', event.url)
        // 注意：这个事件只是表示鼠标悬停在链接上，而不是页面 URL 的实际变化
        // 所以我们不在此处更新当前 URL
      }
      // webview.addEventListener('ipc-message', (event) => {
      //   console.log('ipc-message event:', event.channel)
      // })

      // 添加事件监听器
      webview.addEventListener('dom-ready', handleDomReady)
      webview.addEventListener('did-finish-load', handleFinishLoad)
      webview.addEventListener('did-fail-load', handleFailLoad)
      webview.addEventListener('did-navigate', handleDidNavigate)
      webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.addEventListener('page-title-updated', handlePageTitleUpdated)
      webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)
      webview.addEventListener('update-target-url', handleUpdateTargetUrl)
      // 处理来自 webview 内部的 IPC 消息
      const handleIpcMessage = (event: Electron.IpcMessageEvent) => {
        if (event.channel === 'new-window') {
          handleNewWindowMessage(event, event.args[0])
        }
      }

      webview.addEventListener('ipc-message', handleIpcMessage)

      // 监听来自主进程转发的 URL 和标题变化消息（用于 SPA 路由）
      const handleUrlChangedMessage = (
        _event: any,
        data: { webContentsId: number; url: string }
      ) => {
        // 只处理当前 webview 的消息
        if (webview.getWebContentsId() === data.webContentsId) {
          console.log('SPA URL changed via IPC:', data.url)
          onUrlChangeRef.current?.(data.url)

          // 延迟获取标题
          setTimeout(() => {
            try {
              const title = webview.getTitle()
              if (title && title.trim() !== '') {
                onPageTitleUpdatedRef.current?.(title)
              }
            } catch (error) {
              console.error('获取标题失败:', error)
            }
          }, 200)
        }
      }

      const handleTitleChangedMessage = (
        _event: any,
        data: { webContentsId: number; title: string }
      ) => {
        // 只处理当前 webview 的消息
        if (webview.getWebContentsId() === data.webContentsId) {
          console.log('SPA title changed via IPC:', data.title)
          if (data.title && data.title.trim() !== '') {
            onPageTitleUpdatedRef.current?.(data.title)
          }
        }
      }

      // 在主进程的 IPC 消息监听器中注册
      ipcRenderer.on('webview-url-changed', handleUrlChangedMessage)
      ipcRenderer.on('webview-title-changed', handleTitleChangedMessage)

      // 清理函数
      return () => {
        const webview = webviewRef.current
        const viewId = viewIdRef.current

        // 移除 IPC 消息监听器
        ipcRenderer.removeListener('webview-url-changed', handleUrlChangedMessage)
        ipcRenderer.removeListener('webview-title-changed', handleTitleChangedMessage)

        // 仅在已成功创建并注册 WebView 实例时通知主进程销毁
        if (viewId !== -1) {
          ipcRenderer.send('NATIVE_WEBVIEW_DESTROY', viewId)
        }

        // 检查 WebView 是否仍然存在，移除事件监听器
        if (webview) {
          webview.removeEventListener('dom-ready', handleDomReady)
          webview.removeEventListener('did-finish-load', handleFinishLoad)
          webview.removeEventListener('did-fail-load', handleFailLoad)
          webview.removeEventListener('did-navigate', handleDidNavigate)
          webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
          webview.removeEventListener('page-title-updated', handlePageTitleUpdated)
          webview.removeEventListener('page-favicon-updated', handlePageFaviconUpdated)
          webview.removeEventListener('update-target-url', handleUpdateTargetUrl)
          webview.removeEventListener('ipc-message', handleIpcMessage)
        }

        // 重置引用
        viewIdRef.current = -1
        partitionIdRef.current = null
        cookieManagerRef.current = null
      }
    }, [])

    // 处理 WebView 缩放（不再触碰 partition 和 src，避免触发 ERR_ABORTED）
    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      if (zoom !== undefined) {
        webview.setZoomFactor(zoom)
      }
    }, [zoom])

    // 仅在组件挂载时重置 partitionIdRef
    useEffect(() => {
      // 返回清理函数，组件卸载时重置 partitionIdRef
      return () => {
        partitionIdRef.current = null
      }
    }, [])

    // 处理 visible 属性变化
    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      webview.style.visibility = visible ? 'visible' : 'hidden'

      // 通知主进程更新可见性（仅在 WebView 已经初始化后）
      if (viewIdRef.current !== -1) {
        ipcRenderer.invoke('NATIVE_WEBVIEW_SET_VISIBLE', {
          viewId: viewIdRef.current,
          visible
        })
      }
    }, [visible])

    const partitionId = generatePartition()

    console.log('Rendering WebView with URL:', url, 'partition:', partitionId)
    return (
      // @ts-ignore - partition is a valid webview attribute
      <webview
        ref={webviewRef}
        className={className}
        style={{ ...style, visibility: visible ? 'visible' : 'hidden' }}
        src={url}
        partition={partitionId}
      />
    )
  }
)

NativeWebView.displayName = 'NativeWebView'

export default NativeWebView
