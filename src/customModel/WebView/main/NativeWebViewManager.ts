import { app, BrowserWindow, ipcMain, Menu, session, shell, webContents } from 'electron'
import { Session } from 'electron/main'
import { join } from 'path'
import WebContents = Electron.WebContents

// 存储 WebView 实例相关信息：key = viewId（由渲染进程生成）
// 由于 webview 标签的特殊性，我们只存储相关信息而不是实际的 webview 对象
const nativeWebViewMap = new Map<
  number,
  {
    window: BrowserWindow
    webContents: WebContents
    partition: string
    session: Session
    // 保存事件监听器的引用，以便后续可以移除
    contextMenuHandler?: (event: Electron.Event, params: Electron.ContextMenuParams) => void
  }
>()

// 会话管理器
class SessionManager {
  private sessions: Map<string, Session> = new Map()

  // 获取或创建会话
  public getSession(partition: string): Session {
    if (!this.sessions.has(partition)) {
      const newSession = session.fromPartition(partition)
      this.sessions.set(partition, newSession)
      return newSession
    }
    return this.sessions.get(partition)!
  }
}

// 全局会话管理器实例
const sessionManager = new SessionManager()

export function registerNativeWebViewManager() {
  // 监听渲染进程创建 webview 并初始化一系列设置
  app.on('web-contents-created', (_, contents) => {
    switch (contents.getType()) {
      case 'window': {
        contents.on('will-attach-webview', (_, webPreferences) => {
          const p = join(__dirname, '../preload/webview.js')
          webPreferences.preload = `${p}`
          webPreferences.sandbox = false
          webPreferences.nodeIntegration = false
          webPreferences.webSecurity = true
          webPreferences.contextIsolation = true
          webPreferences.allowRunningInsecureContent = false
        })
        break
      }
      case 'webview': {
        console.log('原生 WebView 创建请求', contents.id)
        break
      }
    }
  })

  // 当渲染进程请求创建 Native WebView
  ipcMain.handle('NATIVE_WEBVIEW_CREATE', async (event, contentsId: number, partition: string) => {
    if (nativeWebViewMap.has(contentsId)) {
      console.log('原生 WebView 已经存在', contentsId)
      // 如果已经存在，直接返回
      const existingInstance = nativeWebViewMap.get(contentsId)!
      return existingInstance.webContents.id
    } else {
      console.log('原生 WebView 开始注册', contentsId)
      const hostWindow = BrowserWindow.fromWebContents(event.sender)
      if (!hostWindow) throw new Error('NativeWebView: No host window found')

      const fakeWebContents = webContents.fromId(contentsId)

      // 获取或创建会话
      const webSession = sessionManager.getSession(partition || 'persist:default')

      if (fakeWebContents) {
        // 增加右键菜单 完整的浏览器功能菜单
        const contextMenuHandler = (_: Electron.Event, params: Electron.ContextMenuParams) => {
          const { x, y } = params
          const menuItems: Electron.MenuItemConstructorOptions[] = []

          console.log('WebView context-menu at', { x, y, params })

          // 添加基础导航选项
          menuItems.push(
            {
              label: '后退',
              enabled: fakeWebContents.navigationHistory.canGoBack(),
              click: () => {
                fakeWebContents.goBack()
              }
            },
            {
              label: '前进',
              enabled: fakeWebContents.navigationHistory.canGoForward(),
              click: () => {
                fakeWebContents.goForward()
              }
            },
            {
              label: '刷新',
              click: () => {
                fakeWebContents.reload()
              }
            },
            {
              type: 'separator'
            }
          )

          // 添加文本编辑相关选项
          if (params.isEditable) {
            menuItems.push(
              {
                label: '剪切',
                enabled: params.editFlags.canCut,
                click: () => fakeWebContents.cut()
              },
              {
                label: '复制',
                enabled: params.editFlags.canCopy,
                click: () => fakeWebContents.copy()
              },
              {
                label: '粘贴',
                enabled: params.editFlags.canPaste,
                click: () => fakeWebContents.paste()
              },
              {
                type: 'separator'
              }
            )
          }

          // 添加链接相关选项
          if (params.linkURL) {
            menuItems.push(
              {
                label: '在新标签页中打开链接',
                click: () => {
                  const window = BrowserWindow.fromWebContents(fakeWebContents)
                  if (window) {
                    window.webContents.send('new-window', params.linkURL)
                  }
                }
              },
              {
                label: '在外部浏览器打开',
                click: () => {
                  shell.openExternal(params.linkURL)
                }
              },
              {
                label: '复制链接地址',
                click: () => fakeWebContents.copy()
              },
              {
                type: 'separator'
              }
            )
          }

          // 添加页面操作选项
          menuItems.push(
            {
              label: '查看页面源代码',
              click: () => fakeWebContents.loadURL(`view-source:${params.pageURL}`)
            },
            {
              label: '检查元素',
              click: () => {
                fakeWebContents.inspectElement(x, y)
                if (fakeWebContents.isDevToolsOpened()) {
                  fakeWebContents.devToolsWebContents?.focus()
                }
              }
            }
          )

          // 构建并弹出菜单，使用宿主窗口作为弹出目标
          const contextMenu = Menu.buildFromTemplate(menuItems)
          contextMenu.popup({ window: hostWindow })
        }

        fakeWebContents.on('context-menu', contextMenuHandler)
        fakeWebContents.on('ipc-message', (_, channel, ...args: any[]) => {
          switch (channel) {
            case 'new-window': {
              const [url] = args
              hostWindow.webContents.send('new-window', String(url))
              break
            }
            case 'webview-url-changed': {
              const [url] = args
              // 转发 URL 变化消息到渲染进程，附带 webContentsId
              hostWindow.webContents.send('webview-url-changed', {
                webContentsId: contentsId,
                url: String(url)
              })
              break
            }
            case 'webview-title-changed': {
              const [title] = args
              // 转发标题变化消息到渲染进程，附带 webContentsId
              hostWindow.webContents.send('webview-title-changed', {
                webContentsId: contentsId,
                title: String(title)
              })
              break
            }
            default: {
              break
            }
          }
        })

        //处理CSP问题
        // webSession.webRequest.onHeadersReceived((details, callback) => {
        //   const { responseHeaders } = details
        //   const newHeaders = { ...responseHeaders }
        //
        //   // 删除所有 CSP 相关头部
        //   Object.keys(newHeaders).forEach((key) => {
        //     const lowerKey = key.toLowerCase()
        //     if (
        //       lowerKey === 'content-security-policy' ||
        //       lowerKey === 'content-security-policy-report-only'
        //     ) {
        //       delete newHeaders[key]
        //     }
        //   })
        //
        //   callback({ responseHeaders: newHeaders })
        // })

        nativeWebViewMap.set(contentsId, {
          window: hostWindow,
          webContents: fakeWebContents,
          partition: partition || 'persist:default',
          session: webSession,
          contextMenuHandler
        })

        console.log('原生 WebView 注册完毕', contentsId)
        return fakeWebContents.id
      }
    }
    return -1
  })

  // 更新 WebView 尺寸（由渲染进程通知）
  ipcMain.on('NATIVE_WEBVIEW_SET_BOUNDS', (_event, { viewId, bounds }) => {
    // 对于原生 webview 标签，尺寸更新完全在渲染进程中处理
    // 这里可以添加日志或其他处理逻辑
    console.log('原生 WebView 尺寸更新', viewId, bounds)
  })

  // 方法调用代理（如 goBack, reload）
  ipcMain.handle('NATIVE_WEBVIEW_METHOD', async (_event, { viewId, method }) => {
    const instance = nativeWebViewMap.get(viewId)
    if (!instance) throw new Error(`NativeWebView with id ${viewId} not found`)

    // 对于原生 webview 标签，这些方法应该在渲染进程中执行
    // 我们可以通过事件通知渲染进程执行相应操作
    switch (method) {
      case 'goBack':
      case 'goForward':
      case 'reload':
      case 'executeJavaScript':
        // 这些操作应该在渲染进程中执行
        return {
          success: true,
          message: `Method ${method} should be executed in renderer process`,
          note: 'Use ref methods in renderer process instead'
        }
      default:
        throw new Error(`Method ${method} is not supported`)
    }
  })

  // 执行 JavaScript 代码
  ipcMain.handle('NATIVE_WEBVIEW_EXECUTE_JS', async (_event, { viewId, code }) => {
    try {
      const instance = nativeWebViewMap.get(viewId)
      if (!instance) {
        throw new Error(`NativeWebView with id ${viewId} not found`)
      }

      // 在 webContents 上执行 JavaScript
      const result = await instance.webContents.executeJavaScript(code)
      return { success: true, result }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `执行 JavaScript 失败: ${errorMessage}` }
    }
  })
  // Cookie 操作处理
  ipcMain.handle('NATIVE_WEBVIEW_COOKIE_SET', async (_event, { partition, cookie }) => {
    try {
      const webSession = sessionManager.getSession(partition || 'persist:default')
      await webSession.cookies.set(cookie)
      return { success: true, message: 'Cookie 设置成功' }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `设置 Cookie 失败: ${errorMessage}` }
    }
  })

  ipcMain.handle('NATIVE_WEBVIEW_COOKIE_GET', async (_event, { partition, filter }) => {
    try {
      const webSession = sessionManager.getSession(partition || 'persist:default')
      const cookies = await webSession.cookies.get(filter || {})
      return { success: true, cookies }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `获取 Cookie 失败: ${errorMessage}` }
    }
  })

  ipcMain.handle('NATIVE_WEBVIEW_COOKIE_REMOVE', async (_event, { partition, url, name }) => {
    try {
      const webSession = sessionManager.getSession(partition || 'persist:default')
      await webSession.cookies.remove(url, name)
      return { success: true, message: 'Cookie 删除成功' }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, message: `删除 Cookie 失败: ${errorMessage}` }
    }
  })
  // 获取会话信息
  ipcMain.handle('NATIVE_WEBVIEW_GET_SESSION', async (_event, { viewId }) => {
    const instance = nativeWebViewMap.get(viewId)
    if (!instance) throw new Error(`NativeWebView with id ${viewId} not found`)

    return {
      partition: instance.partition,
      message: 'Session info retrieved'
    }
  })
  // 销毁
  ipcMain.on('NATIVE_WEBVIEW_DESTROY', (_event, viewId: number) => {
    const instance = nativeWebViewMap.get(viewId)
    if (instance) {
      // 移除所有事件监听器
      const { webContents, contextMenuHandler } = instance
      try {
        // 移除 context-menu 事件监听器
        if (contextMenuHandler) {
          webContents.removeListener('context-menu', contextMenuHandler)
        }

        // 移除所有其他自定义事件监听器
        webContents.removeAllListeners()

        // 如果需要，可以在这里执行其他清理操作
        // 例如：清除会话数据、停止网络请求等
        console.log('WebView WebContents 资源清理完成')
      } catch (error) {
        console.error('清理 WebContents 资源时出错:', error)
      }

      nativeWebViewMap.delete(viewId)
      console.log('原生 WebView 销毁成功', viewId)
    } else {
      console.log('尝试销毁不存在的 WebView 实例', viewId)
    }
  })
  // 控制 WebView 显示/隐藏
  ipcMain.handle('NATIVE_WEBVIEW_SET_VISIBLE', async () => {
    // 对于原生 webview 标签，可见性控制应该在渲染进程中处理
    return {
      success: true,
      message: 'Use visible prop or style.visibility in renderer process instead'
    }
  })
  // 获取 WebView 信息
  ipcMain.handle('NATIVE_WEBVIEW_GET_INFO', async (_event, { viewId }) => {
    const instance = nativeWebViewMap.get(viewId)
    if (!instance) throw new Error(`NativeWebView with id ${viewId} not found`)
    return {
      webContentsId: instance.webContents.id,
      partition: instance.partition,
      message: 'WebView info retrieved in main process',
      note: 'More info should be accessed from renderer process'
    }
  })
}
