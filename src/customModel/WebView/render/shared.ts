import { CookieManager } from './NativeWebView'

// WebView操作接口
export interface WebAction {
  goBack: () => void
  goForward: () => void
  reload: () => void
  executeJavaScript: (script: string) => void
  openDevTools: () => void
  getCookieManager: () => CookieManager
  loadURL: (url: string) => void
  getUrl: () => Promise<string>
  getTitle: () => string
}
