// 使用 require 导入 electron-store，在主进程中更可靠
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StoreClass = require('electron-store').default

class CacheManager {
  private store: any
  constructor() {
    this.store = new StoreClass()
  }
  set(key: string, value: any) {
    this.store.set(key, value)
  }
  get(key: string) {
    return this.store.get(key)
  }
  delete(key: string) {
    this.store.delete(key)
  }
  clear() {
    this.store.clear()
  }
  has(key: string) {
    return this.store.has(key)
  }
}

export const cacheManager = new CacheManager()
