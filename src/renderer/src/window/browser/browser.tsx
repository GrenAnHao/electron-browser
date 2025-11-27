import { Image, Layout, Typography } from '@douyinfe/semi-ui'
import '@renderer/assets/layout-fill.css'
import HeaderBar from '@renderer/window/browser/components/HeaderBar'
import HomePage from '@renderer/window/browser/components/HomePage'
import './browser.css'
import '@renderer/assets/app.css'
import React, { createRef, useCallback, useEffect, useState, useRef, useMemo } from 'react'
import NativeWebView from '@customModel/WebView/render/NativeWebView'
import { WebAction } from '@customModel/WebView/render/shared'
import ToolsBar from '@renderer/window/browser/components/ToolsBar'
import {
  EdgeTabs,
  EdgeTabsBar,
  EdgeTabsContents,
  type TabItem,
  type EdgeTabsMode
} from '@renderer/components/edge-tabs/EdgeTabs'
import { IconHome, IconGlobe } from '@douyinfe/semi-icons'

// 判断 URL 是否应该保存到历史记录
const shouldSaveToHistory = (url: string): boolean => {
  return (
    Boolean(url) &&
    url !== 'about:blank' &&
    url !== 'about:home' &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://')
  )
}

const Browser = () => {
  const { Text } = Typography
  const [activeKey, setActiveKey] = useState('1')
  const [currentUrl, setCurrentUrl] = useState('')
  const [currentTitle, setCurrentTitle] = useState('')
  const [currentFavicon, setCurrentFavicon] = useState<string | undefined>(undefined)

  // 使用 ref 存储最新的 activeKey,避免闭包问题
  const activeKeyRef = useRef(activeKey)
  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  const lastNewWindowRef = useRef<{ url: string; time: number } | null>(null)

  // 使用 Map 存储 WebView 引用和元数据，确保引用稳定
  const webViewRefsMap = useRef<Map<string, React.RefObject<WebAction | null>>>(new Map())
  // 存储 URL 变化时的防抖定时器
  const historySaveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // 核心状态：只存储标签页的元数据，不存储 ReactNode
  const [panes, setPanes] = useState<
    Array<{
      title: string
      itemKey: string
      url: string
      favicon?: React.ReactNode
      isIncognito?: boolean
    }>
  >([])

  // 获取或创建 WebView ref
  const getWebViewRef = useCallback((itemKey: string) => {
    if (!webViewRefsMap.current.has(itemKey)) {
      webViewRefsMap.current.set(itemKey, createRef<WebAction | null>())
    }
    return webViewRefsMap.current.get(itemKey)!
  }, [])

  const updateTitle = useCallback((key: string, title: string) => {
    console.log('Updating title for pane', key, 'to', title)
    setPanes((prevPanes) =>
      prevPanes.map((pane) => (pane.itemKey === key ? { ...pane, title } : pane))
    )
  }, [])

  const updateFavicon = useCallback((key: string, favicon: React.ReactNode) => {
    setPanes((prevPanes) =>
      prevPanes.map((pane) => (pane.itemKey === key ? { ...pane, favicon } : pane))
    )
  }, [])

  const getFaviconUrl = useCallback((url: string) => {
    try {
      if (!url || url === 'about:blank') return ''
      const u = new URL(url)
      return `${u.origin}/favicon.ico`
    } catch {
      return ''
    }
  }, [])

  const getTitleFromUrl = useCallback((url: string) => {
    try {
      const u = new URL(url)
      return u.host || url
    } catch {
      return url
    }
  }, [])

  const updateUrl = useCallback((key: string, url: string) => {
    console.log('Updating URL for pane', key, 'to', url)
    setPanes((prevPanes) =>
      prevPanes.map((pane) => (pane.itemKey === key ? { ...pane, url } : pane))
    )
  }, [])

  const add = useCallback(
    (url: string = 'about:home') => {
      const newKey = Date.now().toString()
      setPanes((prevPanes) => [
        ...prevPanes,
        {
          title: '新标签页',
          itemKey: newKey,
          url,
          favicon: getFaviconUrl(url) || undefined,
          isIncognito: false
        }
      ])
      setActiveKey(newKey)
    },
    [getFaviconUrl]
  )

  const addIncognito = useCallback(
    (url: string = 'about:home') => {
      const newKey = Date.now().toString()
      setPanes((prevPanes) => [
        ...prevPanes,
        {
          title: '新建隐身标签页',
          itemKey: newKey,
          url,
          favicon: getFaviconUrl(url) || undefined,
          isIncognito: true
        }
      ])
      setActiveKey(newKey)
    },
    [getFaviconUrl]
  )

  // 处理标签页顺序变化
  const handleItemsChange = useCallback((nextItems: TabItem[]) => {
    const newOrder = nextItems.map((item) => item.key)
    setPanes((prevPanes) => {
      const panesMap = new Map(prevPanes.map((pane) => [pane.itemKey, pane]))
      return newOrder.map((key) => panesMap.get(key)!).filter(Boolean)
    })
  }, [])

  const handleUrlDrop = useCallback(
    (url: string, targetKey?: string) => {
      const title = getTitleFromUrl(url)
      const favicon = getFaviconUrl(url) || undefined

      if (targetKey) {
        updateUrl(targetKey, url)
        updateTitle(targetKey, title)
        if (favicon) {
          updateFavicon(targetKey, favicon)
        }
        if (targetKey === activeKeyRef.current) {
          setCurrentUrl(url)
          setCurrentTitle(title)
          if (favicon) {
            setCurrentFavicon(favicon)
          }
        }
        return
      }

      const newKey = Date.now().toString()
      setPanes((prevPanes) => [
        ...prevPanes,
        {
          title,
          itemKey: newKey,
          url,
          favicon,
          isIncognito: false
        }
      ])
      setActiveKey(newKey)
      setCurrentUrl(url)
      setCurrentTitle(title)
      setCurrentFavicon(favicon)
    },
    [getFaviconUrl, getTitleFromUrl, updateUrl, updateTitle, updateFavicon]
  )

  const handleModeChange = useCallback((nextMode: EdgeTabsMode) => {
    setTabsMode(nextMode)
    if (nextMode === 'horizontal') {
      setVerticalCollapsed(false)
    }
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setVerticalCollapsed((prev) => !prev)
  }, [])

  const remove = useCallback((key: string) => {
    setPanes((prevPanes) => {
      const newPanes = prevPanes.filter((pane) => pane.itemKey !== key)

      // 清理 WebView ref 和定时器
      webViewRefsMap.current.delete(key)
      const timer = historySaveTimers.current.get(key)
      if (timer) {
        clearTimeout(timer)
        historySaveTimers.current.delete(key)
      }

      // 如果删除的是当前激活的标签页，切换到其他标签页
      if (activeKeyRef.current === key && newPanes.length > 0) {
        const currentIndex = prevPanes.findIndex((pane) => pane.itemKey === key)
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0
        setActiveKey(newPanes[nextIndex].itemKey)
      }

      return newPanes
    })
  }, [])

  const toolBarEvent = useCallback(
    (method: string, url?: string): any => {
      console.log('Tool bar event:', method, 'url:', url)
      const activeKeyCurrent = activeKeyRef.current

      switch (method) {
        case 'goBack':
          getWebViewRef(activeKeyCurrent).current?.goBack()
          break
        case 'goForward':
          getWebViewRef(activeKeyCurrent).current?.goForward()
          break
        case 'reload':
          getWebViewRef(activeKeyCurrent).current?.reload()
          break
        case 'loadUrl': {
          if (!url) {
            break
          }

          // 通过更新 pane.url 来驱动导航，同时更新当前地址栏
          updateUrl(activeKeyCurrent, url)
          setCurrentUrl(url)
          break
        }
        case 'addIncognito': {
          addIncognito()
          break
        }
      }
    },
    [getWebViewRef, updateUrl, addIncognito]
  )

  // 保存历史记录的公共函数
  const saveHistory = useCallback(
    async (itemKey: string, url: string, title: string, favicon?: React.ReactNode) => {
      if (!shouldSaveToHistory(url)) {
        return
      }

      try {
        const currentPane = panes.find((p) => p.itemKey === itemKey)
        if (currentPane?.isIncognito) {
          return
        }
        let faviconToSave: string | undefined
        if (typeof favicon === 'string') {
          faviconToSave = favicon
        } else if (typeof currentPane?.favicon === 'string') {
          faviconToSave = currentPane.favicon
        }
        await window.api.history.add({
          url,
          title: title || url,
          favicon: faviconToSave
        })
      } catch (error) {
        console.error('记录历史失败:', error)
      }
    },
    [panes]
  )

  // 监听当前活动标签页的 URL 变化
  useEffect(() => {
    const webViewRef = getWebViewRef(activeKey)
    if (webViewRef.current) {
      webViewRef.current
        .getUrl()
        .then((url) => {
          console.log('Setting current URL to:', url)
          // 忽略无效或 about:blank 的内部 URL，避免覆盖用户输入的地址
          if (!url || url === 'about:blank') {
            return
          }
          setCurrentUrl(url)
        })
        .catch((error) => {
          console.error('Failed to get URL:', error)
        })

      // 获取当前标题
      const title = webViewRef.current.getTitle()
      if (title) {
        setCurrentTitle(title)
      }
    }

    // 从 panes 中获取当前活动标签页的 title 和 favicon
    const currentPane = panes.find((pane) => pane.itemKey === activeKey)
    if (currentPane) {
      setCurrentTitle(currentPane.title)
      if (typeof currentPane.favicon === 'string') {
        setCurrentFavicon(currentPane.favicon)
      } else {
        setCurrentFavicon(undefined)
      }
    }
  }, [activeKey, getWebViewRef, panes])

  // 初始化时添加默认标签页
  useEffect(() => {
    if (panes.length === 0) {
      add()
    }
  }, [panes.length, add])

  // 监听 pane 数量为0的时候关闭窗口
  useEffect(() => {
    if (currentUrl !== '' && panes.length === 0) {
      window.close()
    }
  }, [currentUrl, panes.length])

  // 将 panes 转换为 TabItem[]
  // 关键:只依赖 panes,所有回调函数都使用稳定的引用
  const renderFavicon = useCallback((favicon: React.ReactNode | undefined, url: string) => {
    if (url === 'about:home') {
      return <IconHome style={{ fontSize: 16 }} />
    }
    if (favicon) {
      if (typeof favicon === 'string') {
        return <Image width={16} height={16} src={favicon} preview={false} />
      }
      return favicon
    }
    return <IconGlobe style={{ fontSize: 16 }} />
  }, [])

  const tabItems = useMemo<TabItem[]>(() => {
    console.log('Creating tabItems, panes count:', panes.length)
    return panes.map((pane) => ({
      key: pane.itemKey,
      color: pane.isIncognito ? '#a855f7' : undefined,
      tab: (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '24px',
            lineHeight: '24px'
          }}
        >
          {renderFavicon(pane.favicon, pane.url)}
          <Text
            ellipsis={{ showTooltip: { opts: { content: pane.title } } }}
            style={{ width: 150 }}
          >
            {pane.title}
          </Text>
        </div>
      ),
      children: (
        <div
          style={{
            position: 'relative',
            height: '100%'
          }}
        >
          <NativeWebView
            key={pane.itemKey}
            // 主页状态下内部实际加载 about:blank, 防止无意义的远程请求
            url={pane.url === 'about:home' ? 'about:blank' : pane.url}
            style={{ height: '100%' }}
            ref={getWebViewRef(pane.itemKey)}
            cacheType={pane.isIncognito ? 'memory' : 'persistent'}
            tag={pane.isIncognito ? `incognito-${pane.itemKey}` : 'default'}
            useragent={`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`}
            // 主页时隐藏 WebView, 只显示自定义主页; 一旦 URL 变为真实地址, 同一个 WebView 继续使用
            visible={pane.url !== 'about:home'}
            onPageTitleUpdated={(title) => {
              // 全局忽略空标题和 about:blank，避免覆盖真实页面标题
              if (!title || title === 'about:blank') {
                return
              }

              updateTitle(pane.itemKey, title)
              if (pane.itemKey === activeKeyRef.current) {
                setCurrentTitle(title)
              }
              const webViewRef = getWebViewRef(pane.itemKey)
              if (webViewRef.current && title && title.trim() !== '') {
                const existingTimer = historySaveTimers.current.get(pane.itemKey)
                if (existingTimer) {
                  clearTimeout(existingTimer)
                }
                const timer = setTimeout(async () => {
                  try {
                    const actualUrl = await webViewRef.current?.getUrl()
                    if (actualUrl && shouldSaveToHistory(actualUrl)) {
                      const actualTitle = webViewRef.current?.getTitle() || title
                      await saveHistory(pane.itemKey, actualUrl, actualTitle)
                    }
                    historySaveTimers.current.delete(pane.itemKey)
                  } catch (error) {
                    console.error('记录历史失败:', error)
                    historySaveTimers.current.delete(pane.itemKey)
                  }
                }, 500)
                historySaveTimers.current.set(pane.itemKey, timer)
              }
            }}
            onPageFaviconUpdated={(favicon) => {
              const faviconUrl = favicon?.length > 0 ? favicon[0] : ''
              updateFavicon(pane.itemKey, faviconUrl)
              if (pane.itemKey === activeKeyRef.current) {
                setCurrentFavicon(faviconUrl)
              }
            }}
            onUrlChange={(url) => {
              console.log('URL changed for pane', pane.itemKey, 'to', url)
              // 全局忽略 about:blank 或空 URL，只在真实 URL 时更新状态
              if (!url || url === 'about:blank') {
                return
              }

              updateUrl(pane.itemKey, url)
              if (pane.itemKey === activeKeyRef.current) {
                console.log('Updating toolbar URL from onUrlChange:', url)
                setCurrentUrl(url)
              }
              const computed = getFaviconUrl(url)
              if (computed) {
                updateFavicon(pane.itemKey, computed)
                if (pane.itemKey === activeKeyRef.current) {
                  setCurrentFavicon(computed)
                }
              }
              const webViewRef = getWebViewRef(pane.itemKey)
              if (webViewRef.current) {
                setTimeout(() => {
                  try {
                    const title = webViewRef.current?.getTitle()
                    if (title && title.trim() !== '') {
                      updateTitle(pane.itemKey, title)
                      if (pane.itemKey === activeKeyRef.current) {
                        setCurrentTitle(title)
                      }
                    }
                  } catch (error) {
                    console.error('获取标题失败:', error)
                  }
                }, 300)
              }
            }}
            onDidFailLoad={(errorCode, errorDescription) => {
              console.error('WebView did-fail-load:', {
                itemKey: pane.itemKey,
                errorCode,
                errorDescription
              })
            }}
            onDidFinishLoad={async () => {
              const webViewRef = getWebViewRef(pane.itemKey)
              if (webViewRef.current) {
                try {
                  const actualUrl = await webViewRef.current.getUrl()
                  // 全局忽略 about:blank 或空 URL，只在真实 URL 时更新状态和历史
                  if (!actualUrl || actualUrl === 'about:blank') {
                    return
                  }

                  updateUrl(pane.itemKey, actualUrl)
                  if (pane.itemKey === activeKeyRef.current) {
                    setCurrentUrl(actualUrl)
                  }
                  const computed = getFaviconUrl(actualUrl)
                  if (computed) {
                    updateFavicon(pane.itemKey, computed)
                    if (pane.itemKey === activeKeyRef.current) {
                      setCurrentFavicon(computed)
                    }
                  }

                  if (shouldSaveToHistory(actualUrl)) {
                    setTimeout(async () => {
                      try {
                        const actualTitle = webViewRef.current?.getTitle() || ''
                        if (!actualTitle || actualTitle.trim() === '') {
                          setTimeout(async () => {
                            try {
                              const finalTitle = webViewRef.current?.getTitle() || ''
                              await saveHistory(pane.itemKey, actualUrl, finalTitle)
                            } catch (error) {
                              console.error('记录历史失败:', error)
                            }
                          }, 500)
                        } else {
                          await saveHistory(pane.itemKey, actualUrl, actualTitle)
                        }
                      } catch (error) {
                        console.error('记录历史失败:', error)
                      }
                    }, 500)
                  }
                } catch (error) {
                  console.error('获取 URL 失败:', error)
                }
              }
            }}
          />
          {pane.url === 'about:home' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'auto'
              }}
            >
              <HomePage
                onOpenUrl={(nextUrl) => {
                  updateUrl(pane.itemKey, nextUrl)
                  if (pane.itemKey === activeKeyRef.current) {
                    setCurrentUrl(nextUrl)
                  }
                }}
              />
            </div>
          )}
        </div>
      )
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panes])

  // 监听新窗口事件
  useEffect(() => {
    const handleNewWindow = (_event: any, url: string) => {
      const urlString = String(url || '').trim()
      if (!urlString) {
        return
      }

      const now = Date.now()
      const last = lastNewWindowRef.current
      if (last && last.url === urlString && now - last.time < 300) {
        console.log('Skip duplicated new-window for url:', urlString)
        return
      }

      lastNewWindowRef.current = { url: urlString, time: now }
      add(urlString)
    }

    window.electron.ipcRenderer.on('new-window', handleNewWindow)

    return () => {
      window.electron.ipcRenderer.removeListener('new-window', handleNewWindow)
    }
  }, [add])

  const [tabsMode, setTabsMode] = useState<EdgeTabsMode>('horizontal')
  const [verticalCollapsed, setVerticalCollapsed] = useState(false)

  console.log(
    'Rendering Browser with panes:',
    panes,
    'activeKey:',
    activeKey,
    'currentUrl:',
    currentUrl
  )

  const shellClassName = [
    'edge-tabs-shell',
    tabsMode === 'vertical' ? 'edge-tabs-shell-vertical' : '',
    tabsMode === 'vertical' && verticalCollapsed ? 'edge-tabs-shell-vertical-collapsed' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Layout className={'root-layout'}>
      <HeaderBar />
      <ToolsBar
        event={toolBarEvent}
        url={currentUrl}
        title={currentTitle}
        favicon={currentFavicon}
      />
      <Layout.Content>
        <EdgeTabs
          items={tabItems}
          activeKey={activeKey}
          onChange={(key) => setActiveKey(key)}
          onItemsChange={handleItemsChange}
          onAddTab={() => add()}
          onCloseTab={remove}
          onUrlDrop={handleUrlDrop}
          mode={tabsMode}
          onModeChange={handleModeChange}
          verticalCollapsed={verticalCollapsed}
          onToggleCollapse={handleToggleCollapse}
          lazy
          keepAlive
          destroyOnClose
        >
          <div className={shellClassName}>
            <EdgeTabsBar />
            <EdgeTabsContents />
          </div>
        </EdgeTabs>
      </Layout.Content>
    </Layout>
  )
}

export default Browser
