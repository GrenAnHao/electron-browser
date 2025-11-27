import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Tabs, Button } from '@douyinfe/semi-ui'
import type { PlainTab, TabsProps } from '@douyinfe/semi-ui/lib/es/tabs'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconPlus, IconClose } from '@douyinfe/semi-icons'
import './DraggableTabs.css'

// 标签页数据接口
export interface TabItem {
  key: string // 标签页唯一标识
  tab: React.ReactNode // 标签页标题内容
  children: React.ReactNode // 标签页内容
  closable?: boolean // 是否可关闭
  disabled?: boolean // 是否禁用
  icon?: React.ReactNode // 标签页图标
}

// 可排序的标签页组件
const SortableTabItem: React.FC<{
  id: string
  children: React.ReactNode
  isActive: boolean
}> = ({ id, children, isActive }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'default',
    position: 'relative' as const,
    zIndex: isDragging ? 1000 : 'auto',
    whiteSpace: 'nowrap' as const // 确保拖拽时文本不换行
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`sortable-tab-item ${isDragging ? 'dragging' : ''} ${isActive ? 'active' : ''}`}
    >
      {children}
    </div>
  )
}

// 可拖拽 Tabs 组件的属性接口
export interface DraggableTabsProps extends Omit<TabsProps, 'children'> {
  items: TabItem[] // 标签页数据数组
  onTabOrderChange?: (newOrder: string[]) => void
  enableDragSort?: boolean
  onAddTab?: () => void // 新增标签页的回调
  showAddButton?: boolean // 是否显示新增标签页按钮
  addButtonTooltip?: string // 新增按钮的提示文本
  onTabClose?: (key: string) => void // 关闭标签页的回调
}

/**
 * 可拖拽排序的 Tabs 组件
 * 基于 Semi-UI Tabs 和 dnd-kit 实现
 * 不使用原生 TabPane,通过 items 属性传递标签页数据
 */
const DraggableTabs: React.FC<DraggableTabsProps> = ({
  items,
  activeKey: controlledActiveKey,
  defaultActiveKey,
  onChange,
  onTabOrderChange,
  enableDragSort = true,
  tabBarExtraContent,
  onAddTab,
  showAddButton = false,
  tabPosition = 'top',
  onTabClose,
  ...restProps
}) => {
  // 标签页顺序状态
  const [tabOrder, setTabOrder] = useState<string[]>(() => items.map((item) => item.key))

  // 当前激活的标签页
  const [activeKey, setActiveKey] = useState<string>(
    controlledActiveKey || defaultActiveKey || (items[0]?.key ?? '')
  )

  // 拖拽中的标签页
  const [activeId, setActiveId] = useState<string | null>(null)

  // 使用 Map 缓存已创建的内容,避免重复创建和销毁
  const contentCacheRef = useRef<Map<string, React.ReactNode>>(new Map())
  // 用于在缓存更新后触发一次额外渲染，确保 UI 立刻反映最新 children
  const [, forceUpdate] = useState(0)

  // 当标签页数据变化时更新顺序和缓存
  useEffect(() => {
    const newKeys = items.map((item) => item.key)
    // 只有当有新的 key 出现时才更新顺序
    const hasNewKeys = newKeys.some((key) => !tabOrder.includes(key))
    const hasRemovedKeys = tabOrder.some((key) => !newKeys.includes(key))

    if (hasNewKeys || hasRemovedKeys) {
      // 保留已存在的顺序，添加新的 key
      const updatedOrder = tabOrder.filter((key) => newKeys.includes(key))
      newKeys.forEach((key) => {
        if (!updatedOrder.includes(key)) {
          updatedOrder.push(key)
        }
      })
      setTabOrder(updatedOrder)

      // 清理已删除标签页的缓存
      hasRemovedKeys &&
        contentCacheRef.current.forEach((_, key) => {
          if (!newKeys.includes(key)) {
            console.log('Removing cached content for key:', key)
            contentCacheRef.current.delete(key)
          }
        })
    }

    // 更新缓存:始终使用当前 items 的 children 覆盖缓存，确保内容变更生效
    items.forEach((item) => {
      console.log('Caching content for key:', item.key)
      contentCacheRef.current.set(item.key, item.children)
    })

    // 缓存更新后强制触发一次渲染，使最新的 children 立即生效
    forceUpdate((v) => v + 1)
  }, [items, tabOrder])

  // 同步受控的 activeKey
  useEffect(() => {
    if (controlledActiveKey !== undefined) {
      setActiveKey(controlledActiveKey)
    }
  }, [controlledActiveKey])

  // 根据标签页方向确定拖拽策略
  const isVertical = tabPosition === 'left' || (tabPosition as string) === 'right'
  const sortingStrategy = isVertical ? verticalListSortingStrategy : horizontalListSortingStrategy

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // 移动 8px 后才开始拖拽，避免误触
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // 拖拽开始事件
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // 拖拽结束事件
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setTabOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        const newOrder = arrayMove(items, oldIndex, newIndex)

        // 触发顺序变化回调
        onTabOrderChange?.(newOrder)

        return newOrder
      })
    }

    setActiveId(null)
  }

  // 标签页切换事件
  const handleTabChange = (key: string) => {
    if (controlledActiveKey === undefined) {
      setActiveKey(key)
    }
    onChange?.(key)
  }

  // 关闭标签页事件
  const handleCloseTab = (key: string, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡，避免触发标签页切换
    onTabClose?.(key)
  }

  // 按照新顺序排列的标签页
  const orderedTabs = useMemo(() => {
    return tabOrder
      .map((key) => items.find((item) => item.key === key))
      .filter(Boolean) as TabItem[]
  }, [tabOrder, items])

  // 获取当前拖拽的标签页信息
  const activeTab = useMemo(() => {
    return items.find((item) => item.key === activeId)
  }, [activeId, items])

  // 渲染新增标签页按钮
  const renderAddButton = () => {
    if (!showAddButton || !onAddTab) return null

    return <Button icon={<IconPlus size="small" />} theme="borderless" onClick={onAddTab} />
  }

  // 合并额外内容和新增按钮
  const mergedExtraContent = (
    <>
      {renderAddButton()}
      {tabBarExtraContent}
    </>
  )

  // 如果不启用拖拽排序，使用简化版本
  if (!enableDragSort) {
    const plainTabs: PlainTab[] = items.map((item) => ({
      itemKey: item.key,
      tab: (
        <div className="custom-tab-content">
          <span className="custom-tab-label">{item.tab}</span>
          {(item.closable ?? true) && (
            <span
              className={`custom-tab-close ${activeKey === item.key ? 'active' : ''}`}
              onClick={(e) => handleCloseTab(item.key, e)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <IconClose size="small" />
            </span>
          )}
        </div>
      ),
      icon: item.icon,
      disabled: item.disabled
    }))

    return (
      <div
        className={`draggable-tabs-wrapper ${isVertical ? 'vertical' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%'
        }}
      >
        <Tabs
          {...restProps}
          more={6}
          tabPosition={tabPosition}
          activeKey={activeKey}
          onChange={handleTabChange}
          tabBarExtraContent={mergedExtraContent}
          tabList={plainTabs}
        />
        <div className="draggable-tabs-content-container" style={{ flex: 1 }}>
          {items.map((item) => (
            <div
              key={item.key}
              className="draggable-tabs-content-pane"
              style={{
                display: activeKey === item.key ? 'block' : 'none',
                height: '100%',
                width: '100%'
              }}
            >
              {item.children}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const tabs: PlainTab[] = orderedTabs.map((item) => ({
    itemKey: item.key,
    tab: (
      <SortableTabItem id={item.key} isActive={activeKey === item.key}>
        <div className="custom-tab-content">
          <span className="custom-tab-label">{item.tab}</span>
          {(item.closable ?? true) && (
            <span
              className={`custom-tab-close ${activeKey === item.key ? 'active' : ''}`}
              onClick={(e) => handleCloseTab(item.key, e)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <IconClose size="small" />
            </span>
          )}
        </div>
      </SortableTabItem>
    ),
    icon: item.icon,
    disabled: item.disabled
  }))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={`draggable-tabs-wrapper ${isVertical ? 'vertical' : ''}`}
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'row' : 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden'
        }}
      >
        {/* 标签栏 - 只负责 UI 展示和拖拽交互 */}
        <Tabs
          {...restProps}
          tabPosition={tabPosition}
          activeKey={activeKey}
          onChange={handleTabChange}
          tabBarExtraContent={mergedExtraContent}
          style={{
            ...(restProps.style || {}),
            flexShrink: 0,
            flexGrow: 0,
            height: 'auto',
            width: isVertical ? 'auto' : '100%'
          }}
          renderTabBar={(tabBarProps, DefaultTabBar) => {
            // 创建一个包装组件来提供 SortableContext
            const TabBarWithSortable = () => (
              <SortableContext items={tabOrder} strategy={sortingStrategy}>
                <DefaultTabBar {...tabBarProps} />
              </SortableContext>
            )
            return <TabBarWithSortable />
          }}
          tabList={tabs}
        />
        {/* 独立的内容容器层 - 使用 flex: 1 占用剩余空间 */}
        <div
          className="draggable-tabs-content-container"
          style={{
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            minWidth: 0
          }}
        >
          {Array.from(contentCacheRef.current.entries()).map(
            ([key, content]: [string, React.ReactNode]) => (
              <div
                key={key}
                className="draggable-tabs-content-pane"
                style={{
                  display: activeKey === key ? 'block' : 'none',
                  height: '100%',
                  width: '100%'
                }}
              >
                {content}
              </div>
            )
          )}
        </div>

        {/* 拖拽时的覆盖层显示 */}
        <DragOverlay>
          {activeId && activeTab ? (
            <div className="drag-overlay-item" style={{ whiteSpace: 'nowrap' }}>
              {activeTab.tab}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

export default DraggableTabs
