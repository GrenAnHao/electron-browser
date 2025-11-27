// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// preload.js
// preload/webview.js （修正版）

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const newWindow = (url) => {
  try {
    const urlString = String(url).trim()
    if (urlString && !urlString.startsWith('javascript:')) {
      ipcRenderer.send('new-window', urlString)
    }
  } catch (e) {
    console.error('Failed to send new-window:', e)
  }
}

// === 1. 拦截 window.open ===
if (!window.__openIntercepted) {
  const originalOpen = window.open
  window.open = function (url, target, features) {
    if (url && url !== 'about:blank') {
      newWindow(url)
      return null
    }
    return originalOpen.call(window, url, target, features)
  }
  window.__openIntercepted = true
}

// === 2. 拦截 <a> 点击（capture 阶段）===
if (!window.__clickInterceptorInstalled) {
  const handleClick = (e) => {
    let anchor = e.target?.closest?.('a[href]')
    if (!anchor) {
      const path = e.composedPath?.() || [e.target]
      anchor = path.find(
        (el) => el?.nodeType === 1 && el.tagName === 'A' && el.hasAttribute('href')
      )
    }
    if (!anchor) return

    const href = anchor.href
    if (!href || href.startsWith('#') || href.toLowerCase() === 'javascript:void(0)') return

    e.preventDefault()

    if (anchor.target === '_self' || anchor.target === '') {
      window.location.href = href
    } else if (anchor.target === '_blank') {
      newWindow(href)
    }
  }

  document.addEventListener('click', handleClick, true)
  window.__clickInterceptorInstalled = true
}

// === 3. SPA 路由监听（可选）===
if (!window.__historyInterceptorInstalled) {
  const notify = (url) => {
    ipcRenderer.send('webview-url-changed', url)
    setTimeout(() => {
      ipcRenderer.send('webview-title-changed', document.title)
    }, 100)
  }

  const wrap = (fn) => {
    return function (...args) {
      fn.apply(history, args)
      const u = args[2] || window.location.href
      notify(u.startsWith('http') ? u : new URL(u, location.origin).href)
    }
  }

  history.pushState = wrap(history.pushState, 'push')
  history.replaceState = wrap(history.replaceState, 'replace')

  window.addEventListener('popstate', () => notify(location.href))
  window.addEventListener('hashchange', () => notify(location.href))

  window.__historyInterceptorInstalled = true
}

// === 暴露 API ===
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
} else {
  window.electron = electronAPI
}

console.log('✅ Webview preload loaded')
