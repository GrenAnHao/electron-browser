# 更新记录

## 2025-11-27

### 功能与行为修复

- **标签页：防止首次切换导致 WebView 被销毁重载**  
  - 在 `src/renderer/src/components/edge-tabs/EdgeTabs.tsx` 中：
    - 新增对 `activeKey` 的 `useEffect` 监听，将所有曾经作为 `activeKey` 的标签 key 加入 `visitedKeys`。
    - 保证只要标签被激活过，内容区域就不会在后续切换时被卸载，从而避免 `NativeWebView` 被销毁后重新创建导致的页面重新加载。

- **新窗口打开导致重复标签的问题**  
  - 在 `src/renderer/src/window/browser/browser.tsx` 中：
    - 新增 `lastNewWindowRef`，记录最后一次 `new-window` 事件的 URL 与时间戳。
    - 在 `useEffect` 监听 `window.electron.ipcRenderer.on('new-window')` 时，
      - 对同一 URL、300ms 内重复到达的 `new-window` 消息直接跳过。
      - 只对第一次事件调用 `add(url)` 创建标签，避免一次点击产生多个相同标签。

- **隐身标签高亮颜色**  
  - 在 `browser.tsx` 中构建 `tabItems` 时：
    - 为 `TabItem` 增加 `color` 字段：`color: pane.isIncognito ? '#a855f7' : undefined`。
    - 在 `EdgeTabs` 中，激活标签会使用 `tab.color` 作为强调色，隐身标签以紫色高亮显示，其它标签保持默认颜色。

- **标签栏组件切换为 EdgeTabs 并支持 URL 拖拽打开页面**  
  - 在 `src/renderer/src/window/browser/browser.tsx` 与 `src/renderer/src/components/edge-tabs/EdgeTabs.tsx` 中：
    - 将原有基于 Semi Tabs 的 `DraggableTabs` 替换为自研 `EdgeTabs` 体系，保留每个标签对应的 `NativeWebView` 实例，不会因拖拽排序或切换标签而被销毁重建。
    - 支持在标签栏及单个标签上拖拽 URL：拖到标签上会替换该标签的 URL，拖到标签栏空白区域会新建标签并打开该 URL。

- **工具栏新增“隐身”按钮并打通隐身标签创建逻辑**  
  - 在 `src/renderer/src/window/browser/components/ToolsBar.tsx` 与 `browser.tsx` 中：
    - 在工具栏右侧增加“隐身”按钮，通过调用 `event('addIncognito')` 触发 `addIncognito`，一键新建隐身标签页。
    - 保持隐身标签“不会写入浏览历史”的既有规则，新建隐身页仍不会被保存到历史记录表。

- **修复新建标签时 URL 变成 http://localhost:5174/[object Object] 的问题**  
  - 在 `browser.tsx` 中：
    - 将 `EdgeTabs` 的 `onAddTab={add}` 改为 `onAddTab={() => add()}`，避免点击事件对象被误当作 URL 传入 `add(url)`。
    - 修复开发环境下新建标签误跳转到 `http://localhost:5174/[object Object]` 的问题，保证新建标签始终使用预期的默认地址（例如 `about:home`）。

- **favicon 渲染与历史记录存储逻辑优化**  
  - 在 `browser.tsx` 中：
    - 将 pane 的 `favicon` 类型扩展为 `React.ReactNode`，新增 `renderFavicon` 工具函数：`about:home` 使用首页图标，普通页面优先显示远程 favicon，缺省时显示地球图标。
    - 在保存历史记录时仅持久化字符串类型的 favicon，对 `ReactNode` 类型进行安全转换，保证历史表中的 favicon 字段始终为 URL 字符串。

- **主页快捷卡片点击事件类型错误修复**  
  - 在 `src/renderer/src/window/browser/components/HomePage.tsx` 中：
    - 原先直接在 Semi UI 的 `Card` 上传入 `onClick`，TypeScript 报错 `CardProps` 不存在该属性。
    - 修改为用外层 `div` 包裹 `Card`：
      - 将 `style={{ cursor: 'pointer' }}` 和 `onClick={() => onOpenUrl(item.url)}` 挂在 `div` 上。
      - `Card` 仅保留 `bodyStyle` 等合法属性，修复类型错误且保持原有交互。

### 顶部 UI 与布局调整

- **标题栏（HeaderBar）背景统一 & 去除多余分割线**  
  - 文件：`src/renderer/src/window/browser/components/HeaderBar.tsx`
    - 为 `Layout.Header` 设置：
      - `backgroundColor: 'var(--semi-color-bg-1)'`
      - `boxShadow: 'none'`
    - 移除标题栏自己的下边框，避免与下方工具条之间出现多余的深色分割线。

- **工具条（ToolsBar）背景与间距优化**  
  - 文件：`src/renderer/src/window/browser/components/ToolsBar.tsx`
    - 为最外层 `Header` 设置：
      - `backgroundColor: 'var(--semi-color-bg-1)'`，与顶部标签栏背景保持一致。
      - `borderBottom: '1px solid var(--semi-color-border)'`，用于与内容区域/标签栏做视觉分隔。
      - `paddingTop: '4px'`、`paddingBottom: '4px'`，使工具条内部内容上下间距对称、垂直居中。

- **标签内容区域与工具条/窗口边缘对齐**  
  - 文件：`src/renderer/src/components/edge-tabs/edge-tabs.css`
    - 调整 `.edge-tabs-content` 的内边距：
      - 从 `padding: 4px 8px 8px;` 改为 `padding: 4px 0 8px;`。
      - 取消左右 8px 的缩进，使内容卡片（`.edge-tabs-content-pane`）的上边框在水平方向贴边，
        与工具条、窗口左右边缘对齐，避免顶部那条线两端留空。

### 其他

- **整体风格**  
  - 保持所有新样式使用 Semi 主题变量（如 `var(--semi-color-bg-1)`、`var(--semi-color-border)`、`var(--semi-color-text-*)`），
    以便继续兼容浅色/深色主题切换。

> 注：本文件用于记录 2025-11-27 当天对标签系统、WebView 生命周期以及顶部工具条/标题栏 UI 所做的主要改动，方便后续回顾与迭代。
