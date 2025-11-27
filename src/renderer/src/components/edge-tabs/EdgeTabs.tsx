import React, { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToHorizontalAxis, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Dropdown } from '@douyinfe/semi-ui'
import {
  IconMoreStroked,
  IconPlusStroked,
  IconChevronLeft,
  IconChevronRight,
  IconPlus
} from '@douyinfe/semi-icons'
import './edge-tabs.css'

// 为了在 style 中使用 CSS 变量（--edge-tab-active-color），在 React.CSSProperties 上做一个简单扩展
type EdgeTabStyle = React.CSSProperties & {
  '--edge-tab-active-color'?: string
}

// 单个标签页的数据结构
// key: 唯一标识；tab: 标签栏上展示的标题节点；children: 对应的内容区域 React 节点
// color/icon: 仅用于 UI（强调色与图标）
export type TabItem = {
  key: string
  tab: React.ReactNode
  children?: React.ReactNode
  color?: string
  icon?: React.ReactNode
}

// 单个可拖拽标签组件的 props
type DraggableTabProps = {
  tab: TabItem
  isActive: boolean
  onClose: (key: string) => void
  onClick: (key: string) => void
  onUrlDrop?: (url: string, targetKey?: string) => void
}

// 整个标签栏组件 DraggableTabs 的 props
type DraggableTabsProps = {
  items: TabItem[]
  activeKey?: string
  onTabChange?: (key: string) => void
  onTabOrderChange?: (order: string[]) => void
  onAddTab?: () => void
  onTabClose?: (key: string) => void
  onUrlDrop?: (url: string, targetKey?: string) => void
  mode?: EdgeTabsMode
  verticalCollapsed?: boolean
  onToggleMode?: () => void
  onToggleCollapse?: () => void
}

export type EdgeTabsMode = 'horizontal' | 'vertical'

// 通过 React Context 向子组件下发的公共状态和回调
type EdgeTabsContextValue = {
  items: TabItem[]
  activeKey: string
  mode: EdgeTabsMode
  lazy: boolean
  keepAlive: boolean
  destroyOnClose: boolean
  visitedKeys: Set<string>
  onActiveKeyChange?: (key: string) => void
  onItemsReorder?: (order: string[]) => void
  onAddTab?: () => void
  onCloseTab?: (key: string) => void
  onUrlDrop?: (url: string, targetKey?: string) => void
  onModeChange?: (mode: EdgeTabsMode) => void
  verticalCollapsed: boolean
  onToggleCollapse?: () => void
}

// EdgeTabs 整体的上下文，方便 EdgeTabsBar / EdgeTabsContents 访问共享状态
const EdgeTabsContext = React.createContext<EdgeTabsContextValue | null>(null)

// 小工具：封装 useContext，保证使用 EdgeTabs 体系时一定在 Provider 内部
const useEdgeTabsContext = () => {
  const ctx = React.useContext(EdgeTabsContext)
  if (!ctx) {
    throw new Error('EdgeTabs components must be used within <EdgeTabs>')
  }
  return ctx
}

// EdgeTabs 顶层容器的 props，负责管理 activeKey / items 顺序 / 访问记录等
export type EdgeTabsProps = {
  items: TabItem[]
  activeKey: string
  onChange?: (key: string) => void
  onItemsChange?: (items: TabItem[]) => void
  onAddTab?: () => void
  onCloseTab?: (key: string) => void
  onUrlDrop?: (url: string, targetKey?: string) => void
  mode?: EdgeTabsMode
  onModeChange?: (mode: EdgeTabsMode) => void
  verticalCollapsed?: boolean
  onToggleCollapse?: () => void
  lazy?: boolean
  keepAlive?: boolean
  destroyOnClose?: boolean
  children: React.ReactNode
}

// EdgeTabs 是一个受控容器：
// - 不直接渲染 tabBar 或内容，而是通过 Context 把数据和操作分发给 EdgeTabsBar / EdgeTabsContents
// - 内部维护 visitedKeys 集合，用于实现 keepAlive + lazy 渲染策略
export const EdgeTabs: React.FC<EdgeTabsProps> = ({
  items,
  activeKey,
  onChange,
  onItemsChange,
  onAddTab,
  onCloseTab,
  onUrlDrop,
  mode = 'horizontal',
  onModeChange,
  verticalCollapsed = false,
  onToggleCollapse,
  lazy = true,
  keepAlive = true,
  destroyOnClose = true,
  children
}) => {
  // visitedKeys 记录所有访问过的 key，用于：
  // 1. lazy 渲染时只渲染访问过的页签
  // 2. keepAlive 下仍然保留已经渲染过的内容 DOM
  const [visitedKeys, setVisitedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (activeKey) {
      initial.add(activeKey)
    }
    return initial
  })

  // 确保通过编程方式变更 activeKey 时也会被记录到 visitedKeys
  React.useEffect(() => {
    if (!activeKey) {
      return
    }
    setVisitedKeys((prev) => {
      if (prev.has(activeKey)) {
        return prev
      }
      const next = new Set(prev)
      next.add(activeKey)
      return next
    })
  }, [activeKey])

  // effectiveVisitedKeys 始终包含当前 activeKey，避免当前页签未被记录
  const effectiveVisitedKeys = React.useMemo(() => {
    const next = new Set(visitedKeys)
    if (activeKey) {
      next.add(activeKey)
    }
    return next
  }, [visitedKeys, activeKey])

  const handleActiveKeyChange = (key: string) => {
    setVisitedKeys((prev) => {
      if (prev.has(key)) {
        return prev
      }
      const next = new Set(prev)
      next.add(key)
      return next
    })
    onChange?.(key)
  }

  // onItemsReorder：由拖拽排序触发，把新的 key 顺序映射回 TabItem 数组
  const handleItemsReorder = (order: string[]) => {
    if (!onItemsChange) {
      return
    }
    const reordered: TabItem[] = order
      .map((key) => items.find((item) => item.key === key))
      .filter((item): item is TabItem => Boolean(item))
    onItemsChange(reordered)
  }

  const handleCloseTab = (key: string) => {
    if (destroyOnClose) {
      setVisitedKeys((prev) => {
        if (!prev.has(key)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    onCloseTab?.(key)
  }

  const contextValue: EdgeTabsContextValue = {
    items,
    activeKey,
    mode,
    lazy,
    keepAlive,
    destroyOnClose,
    visitedKeys: effectiveVisitedKeys,
    onActiveKeyChange: handleActiveKeyChange,
    onItemsReorder: handleItemsReorder,
    onAddTab,
    onCloseTab: handleCloseTab,
    onUrlDrop,
    onModeChange,
    verticalCollapsed,
    onToggleCollapse
  }

  return <EdgeTabsContext.Provider value={contextValue}>{children}</EdgeTabsContext.Provider>
}

// EdgeTabsBar 只关注标签栏，所有数据从 Context 获取
export const EdgeTabsBar: React.FC = () => {
  const {
    items,
    activeKey,
    mode,
    verticalCollapsed,
    onActiveKeyChange,
    onItemsReorder,
    onAddTab,
    onCloseTab,
    onUrlDrop,
    onModeChange,
    onToggleCollapse
  } = useEdgeTabsContext()

  const handleToggleMode = () => {
    if (!onModeChange) return
    const next = mode === 'horizontal' ? 'vertical' : 'horizontal'
    onModeChange(next)
  }

  return (
    <DraggableTabs
      items={items}
      activeKey={activeKey}
      onTabChange={onActiveKeyChange}
      onTabOrderChange={onItemsReorder}
      onAddTab={onAddTab}
      onTabClose={onCloseTab}
      onUrlDrop={onUrlDrop}
      mode={mode}
      verticalCollapsed={verticalCollapsed}
      onToggleMode={handleToggleMode}
      onToggleCollapse={onToggleCollapse}
    />
  )
}

type EdgeTabsContentsProps = {
  className?: string
  style?: React.CSSProperties
}

// EdgeTabsContents 负责渲染内容区域，并根据 keepAlive/lazy 策略控制哪些 pane 挂载
export const EdgeTabsContents: React.FC<EdgeTabsContentsProps> = ({ className, style }) => {
  const { items, activeKey, lazy, keepAlive, visitedKeys } = useEdgeTabsContext()

  const containerClassName = className ?? 'edge-tabs-content'

  // 不需要 keepAlive 时，直接只渲染当前 active 的内容
  if (!keepAlive) {
    const active = items.find((item) => item.key === activeKey)
    return (
      <div className={containerClassName} style={style}>
        {active?.children}
      </div>
    )
  }

  // 为了避免拖拽排序时内容 DOM 被重新挂载，这里使用稳定的顺序：
  // 1. 优先按照 visitedKeys（首次访问顺序）
  // 2. 再补上当前 items 中存在但未在 visitedKeys 里的 key
  // 这样拖拽只影响 tabBar 的顺序，不会改变内容区 DOM 顺序，iframe 不会因为重排而重新加载。
  const itemMap = new Map(items.map((item) => [item.key, item] as const))
  const keysToRender: string[] = []

  if (lazy) {
    visitedKeys.forEach((key) => {
      if (itemMap.has(key)) {
        keysToRender.push(key)
      }
    })
    if (activeKey && itemMap.has(activeKey) && !keysToRender.includes(activeKey)) {
      keysToRender.push(activeKey)
    }
  } else {
    visitedKeys.forEach((key) => {
      if (itemMap.has(key) && !keysToRender.includes(key)) {
        keysToRender.push(key)
      }
    })
    items.forEach((item) => {
      if (!keysToRender.includes(item.key)) {
        keysToRender.push(item.key)
      }
    })
  }

  return (
    <div className={containerClassName} style={style}>
      {keysToRender.map((key) => {
        const item = itemMap.get(key)
        if (!item) return null

        return (
          <div
            key={item.key}
            className="edge-tabs-content-pane"
            style={{
              display: activeKey === item.key ? 'block' : 'none',
              height: '100%',
              width: '100%'
            }}
          >
            {item.children}
          </div>
        )
      })}
    </div>
  )
}

type TabCommandMenuProps = {
  mode: EdgeTabsMode
  verticalCollapsed: boolean
  onToggleMode?: () => void
  onCreateTab?: () => void
  onToggleCollapse?: () => void
}

// 标签栏左侧的菜单区域：
// - 三点按钮：打开/关闭垂直标签页 + 新建标签页
// - 垂直模式下额外提供收起/展开按钮
const TabCommandMenu: React.FC<TabCommandMenuProps> = ({
  mode,
  verticalCollapsed,
  onToggleMode,
  onCreateTab,
  onToggleCollapse
}) => {
  const modeText = mode === 'horizontal' ? '打开垂直标签页' : '关闭垂直标签页'

  return (
    <div className="edge-tabs-menu">
      <Dropdown
        position="bottomLeft"
        trigger="hover"
        render={
          <Dropdown.Menu>
            <Dropdown.Item icon={<IconMoreStroked />} onClick={() => onToggleMode?.()}>
              {modeText}
            </Dropdown.Item>
            <Dropdown.Item icon={<IconPlusStroked />} onClick={() => onCreateTab?.()}>
              新建标签页
            </Dropdown.Item>
          </Dropdown.Menu>
        }
      >
        <Button
          theme="borderless"
          size="small"
          icon={<IconMoreStroked />}
          className="edge-tabs-menu-btn"
        />
      </Dropdown>
      {mode === 'vertical' && (
        <Button
          theme="borderless"
          size="small"
          icon={verticalCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
          className="edge-tabs-collapse-btn"
          onClick={() => onToggleCollapse?.()}
        />
      )}
    </div>
  )
}

// 从 DataTransfer 中抽取 URL：
// - 优先读取 text/uri-list（浏览器拖拽 URL 的标准格式）
// - 然后尝试 text/plain，如果是类似 "www.xxx.com" 的域名则自动补 https://
const extractUrlFromDataTransfer = (dt: DataTransfer): string | null => {
  const uriList = dt.getData('text/uri-list')
  if (uriList) {
    const lines = uriList
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
    if (lines.length > 0) {
      return lines[0]
    }
  }
  const text = dt.getData('text/plain')
  if (text) {
    const value = text.trim()
    if (!value) {
      return null
    }
    if (/^https?:\/\//i.test(value)) {
      return value
    }
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) {
      return `https://${value}`
    }
  }
  return null
}

// 单个可拖拽标签：
// - 使用 dnd-kit 的 useSortable 支持拖拽排序
// - 同时支持拖拽 URL 到标签上（onUrlDrop）
const DraggableTab = ({ tab, isActive, onClose, onClick, onUrlDrop }: DraggableTabProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.key
  })

  const style: EdgeTabStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? 'grabbing' : 'default'
  }

  if (isActive) {
    style['--edge-tab-active-color'] = tab.color ?? 'var(--semi-color-primary, #2b6dde)'
  }

  // 点击标签时，通知父级切换 activeKey
  const handleClick = () => {
    onClick(tab.key)
  }

  // 关闭按钮：阻止冒泡，避免同时触发点击激活
  const handleClose = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onClose(tab.key)
  }

  // 让标签本身成为一个合法的 drop 区域：
  // 只要外面提供了 onUrlDrop，就统一 preventDefault，避免浏览器显示禁止图标
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onUrlDrop) {
      return
    }
    e.preventDefault()
    try {
      e.dataTransfer.dropEffect = 'copy'
    } catch {
      // ignore
    }
  }

  // 松手时尝试从 DataTransfer 解析 URL，并把 URL 和当前标签 key 传给上层
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onUrlDrop) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const url = extractUrlFromDataTransfer(e.dataTransfer)
    if (!url) {
      return
    }
    onUrlDrop(url, tab.key)
  }

  let iconNode: React.ReactNode = null
  if (typeof tab.icon === 'string') {
    const str = tab.icon
    const isUrl = /^https?:\/\//.test(str) || str.startsWith('//')
    const isImageLike = /\.(png|jpe?g|gif|webp|svg|ico)(\?|#|$)/i.test(str)
    if (isUrl || isImageLike) {
      iconNode = <img src={str} alt="" className="edge-tab-icon-img" />
    } else if (str) {
      iconNode = str
    }
  } else if (tab.icon) {
    iconNode = tab.icon
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`edge-tab ${isActive ? 'edge-tab-active' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <span
        className="edge-tab-accent"
        style={{ backgroundColor: tab.color ?? 'var(--semi-color-primary, #2b6dde)' }}
      />
      <div className="edge-tab-main">
        {iconNode && <span className="edge-tab-icon">{iconNode}</span>}
        <span className="edge-tab-label">{tab.tab}</span>
      </div>
      <Button theme="borderless" className="edge-tab-close" onClick={handleClose}>
        ×
      </Button>
    </div>
  )
}

// 整个标签栏：
// - 使用 DndContext + SortableContext 实现标签顺序拖拽
// - 水平模式：滚轮纵向滚动用于横向滚动标签栏
// - 垂直模式：列表纵向滚动，支持 Y 轴拖拽
// - 整条标签栏支持拖拽 URL 新建标签
const DraggableTabs = ({
  items,
  activeKey: controlledActiveKey,
  onTabChange,
  onTabOrderChange,
  onAddTab,
  onTabClose,
  onUrlDrop,
  mode = 'horizontal',
  verticalCollapsed = false,
  onToggleMode,
  onToggleCollapse
}: DraggableTabsProps) => {
  const currentActiveKey = controlledActiveKey ?? items[0]?.key ?? ''

  const isVertical = mode === 'vertical'

  // PointerSensor + activationConstraint.distance 实现“拖动一小段距离后再开始排序”的体验
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  )

  // dnd-kit 排序结束时，根据 active / over 计算新的 key 顺序，并回调给上层
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const keys = items.map((item) => item.key)
    const activeId = String(active.id)
    const overId = String(over.id)
    const oldIndex = keys.indexOf(activeId)
    const newIndex = keys.indexOf(overId)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const newOrder = arrayMove(keys, oldIndex, newIndex)
    onTabOrderChange?.(newOrder)
  }

  const handleTabClick = (key: string) => {
    onTabChange?.(key)
  }

  const handleCloseTab = (key: string) => {
    onTabClose?.(key)
  }

  const keys = items.map((item) => item.key)

  // 支持使用鼠标滚轮纵向滚动来横向滚动标签栏（类似 Edge/VSCode）
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isVertical) {
      // 垂直模式下保留浏览器默认纵向滚动
      return
    }
    if (e.deltaY === 0) return
    e.preventDefault()
    e.currentTarget.scrollLeft += e.deltaY
  }

  // 整条标签栏（包括空白区域）作为 URL drop 目标：
  // 在这里统一 preventDefault，这样只要进入条形区域就不会出现禁止图标
  const handleBarDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onUrlDrop) {
      return
    }
    e.preventDefault()
    try {
      e.dataTransfer.dropEffect = 'copy'
    } catch {
      // ignore
    }
  }

  // 当把 URL 拖到标签栏空白区域时，在这里解析 URL 并让上层新建一个标签
  const handleBarDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onUrlDrop) {
      return
    }
    e.preventDefault()
    const url = extractUrlFromDataTransfer(e.dataTransfer)
    if (!url) {
      return
    }
    onUrlDrop(url)
  }

  const wrapperClassName = [
    'edge-tabs-bar-wrapper',
    isVertical ? 'edge-tabs-bar-wrapper-vertical' : '',
    isVertical && verticalCollapsed ? 'edge-tabs-bar-wrapper-vertical-collapsed' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const barClassName = ['edge-tabs-bar', isVertical ? 'edge-tabs-bar-vertical' : '']
    .filter(Boolean)
    .join(' ')

  const scrollClassName = isVertical ? 'edge-tabs-scroll-vertical' : 'edge-tabs-scroll'
  const listClassName = isVertical ? 'edge-tabs-list-vertical' : 'edge-tabs-list'

  const dndModifiers = [isVertical ? restrictToVerticalAxis : restrictToHorizontalAxis]
  const sortingStrategy = isVertical ? verticalListSortingStrategy : horizontalListSortingStrategy

  return (
    <div className={wrapperClassName} onDragOver={handleBarDragOver} onDrop={handleBarDrop}>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd} modifiers={dndModifiers}>
        <div className={barClassName}>
          <TabCommandMenu
            mode={mode}
            verticalCollapsed={verticalCollapsed}
            onToggleMode={onToggleMode}
            onCreateTab={onAddTab}
            onToggleCollapse={onToggleCollapse}
          />
          <div className={scrollClassName} onWheel={handleWheel}>
            <SortableContext items={keys} strategy={sortingStrategy}>
              <div className={listClassName}>
                {items.map((tab) => (
                  <DraggableTab
                    key={tab.key}
                    tab={tab}
                    isActive={currentActiveKey === tab.key}
                    onClose={handleCloseTab}
                    onClick={handleTabClick}
                    onUrlDrop={onUrlDrop}
                  />
                ))}
                {isVertical ? (
                  <button type="button" className="edge-tab-add-vertical" onClick={onAddTab}>
                    <IconPlusStroked />
                    <span className="edge-tab-add-vertical-label">新建标签页</span>
                  </button>
                ) : (
                  <Button theme="borderless" className="edge-tab-add" onClick={onAddTab}>
                    <IconPlus />
                  </Button>
                )}
              </div>
            </SortableContext>
          </div>
        </div>
      </DndContext>
    </div>
  )
}

export { DraggableTabs }
