/**
 * DraggableTabs 快速演示
 *
 * 这个文件可以直接在 main.tsx 中导入来测试组件
 */

import { useState } from 'react'
import { DraggableTabs } from './index'
import type { TabItem } from './index'
import { Image, Typography } from '@douyinfe/semi-ui'
import NativeWebView from '@customModel/WebView/render/NativeWebView'

const { Text } = Typography

// WebView 生命周期监测组件

const DraggableTabsDemo = () => {
  const [activeKey, setActiveKey] = useState('1')

  const [tabs, setTabs] = useState<TabItem[]>(() => [
    {
      key: '1',
      tab: (
        <>
          <Image width={16} height={16} src="https://www.baidu.com/favicon.ico" preview={false} />
          <Text>百度</Text>
        </>
      ),
      children: <NativeWebView url={'https://www.baidu.com/'} style={{ height: '100%' }} />
    },
    {
      key: '2',
      tab: (
        <>
          <Image width={16} height={16} src="https://www.bing.com/favicon.ico" preview={false} />
          <Text>必应</Text>
        </>
      ),
      children: <NativeWebView url={'https://www.bing.com/'} style={{ height: '100%' }} />
    },
    {
      key: '3',
      tab: (
        <>
          <Image width={16} height={16} src="https://www.google.com/favicon.ico" preview={false} />
          <Text>Google</Text>
        </>
      ),
      children: <NativeWebView url={'https://www.google.com/'} style={{ height: '100%' }} />
    }
  ])

  const addTab = () => {
    const newKey = String(Date.now())
    setTabs([
      ...tabs,
      {
        key: newKey,
        tab: (
          <>
            <Image width={16} height={16} src="https://www.bing.com/favicon.ico" preview={false} />
            <Text>新标签页 {tabs.length + 1}</Text>
          </>
        ),
        children: <NativeWebView url="http://www.bing.com" style={{ height: '100%' }} />
      }
    ])
    setActiveKey(newKey)
  }

  const removeTab = (key: string) => {
    const newTabs = tabs.filter((tab) => tab.key !== key)
    setTabs(newTabs)
    if (activeKey === key && newTabs.length > 0) {
      setActiveKey(newTabs[0].key)
    }
  }

  const handleOrderChange = (newOrder: string[]) => {
    console.log('新的标签页顺序:', newOrder)
    // 可以在这里根据新顺序重新排列 tabs 数组
    const orderedTabs = newOrder
      .map((key) => tabs.find((tab) => tab.key === key))
      .filter(Boolean) as typeof tabs
    setTabs(orderedTabs)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      <div>
        <h1>DraggableTabs 组件演示</h1>
        <p>拖拽标签页来重新排序，点击标签页来切换，点击关闭按钮来删除标签页。</p>
        <p>点击右侧的加号按钮添加新标签页（类似 Edge 浏览器）。</p>
      </div>

      <div style={{ flex: 1 }}>
        <DraggableTabs
          type="button"
          items={tabs}
          activeKey={activeKey}
          onChange={(key) => setActiveKey(key)}
          onTabClose={(key) => removeTab(key)}
          onTabOrderChange={handleOrderChange}
          onAddTab={addTab}
          showAddButton={true}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}

export default DraggableTabsDemo

/**
 * 快速测试方法：
 *
 * 在 src/renderer/src/main.tsx 中：
 *
 * import DraggableTabsDemo from '@renderer/components/DraggableTabsDemo'
 *
 * createRoot(document.getElementById('root')!).render(<DraggableTabsDemo />)
 */
