import React, { useState } from 'react';
import type { TabItem, EdgeTabsMode } from './EdgeTabs';
import { EdgeTabs, EdgeTabsBar, EdgeTabsContents } from './EdgeTabs';

// Demo 组件：
// - 维护 tabs / activeKey 两个状态
// - 演示标签排序、关闭、新建和拖拽 URL 打开页面
const EdgeTabsDemo: React.FC = () => {
  const [tabs, setTabs] = useState<TabItem[]>([
    { key: '1', tab: '首页', color: '#ab3fdaff', icon: 'https://static-production.npmjs.com/b0f1a8318363185cc2ea6a40ac23eeb2.png', children: <div><h2>首页内容</h2><p>这是首页的内容</p></div> },
    { key: '2', tab: '文档', color: '#fa8c16', icon: '📄', children: <div><h2>文档内容</h2><p>这是文档的内容</p></div> },
    { key: '3', tab: '设置', color: '#52c41a', icon: '⚙️', children: <div><h2>设置内容</h2><p>这是设置的内容</p></div> },
  ]);

  const [activeKey, setActiveKey] = useState('1');
  const [mode, setMode] = useState<EdgeTabsMode>('horizontal');
  const [verticalCollapsed, setVerticalCollapsed] = useState(false);

  // 新建一个“Bing”标签页，默认加载 https://www.bing.com
  const handleAddTab = () => {
    const newKey = `tab-${Date.now()}`;
    setTabs(prev => {
      const nextIndex = prev.length + 1;
      return [
        ...prev,
        {
          key: newKey,
          tab: `新标签页 ${nextIndex}`,
          children: <iframe style={{
              width: '100%',
              height: '100%',
              border: 'none',
          }} src='https://www.bing.com/'/>,
        },
      ];
    });
    setActiveKey(newKey);
  };

  // 关闭标签：至少保留一个标签，若关闭的是当前激活标签，则激活最后一个
  const handleCloseTab = (key: TabItem['key']) => {
    if (tabs.length <= 1) {
      return;
    }

    setTabs(prev => {
      const filtered = prev.filter(tab => tab.key !== key);
      if (key === activeKey && filtered.length > 0) {
        setActiveKey(filtered[filtered.length - 1].key);
      }
      return filtered;
    });
  };

  // 切换激活标签
  const handleTabChange = (key: string) => {
    setActiveKey(key);
  };

  // 接收排序后的 items 数组
  const handleItemsChange = (nextItems: TabItem[]) => {
    setTabs(nextItems);
  };

  const handleModeChange = (nextMode: EdgeTabsMode) => {
    setMode(nextMode);
    if (nextMode === 'horizontal') {
      setVerticalCollapsed(false);
    }
  };

  const handleToggleCollapse = () => {
    setVerticalCollapsed(prev => !prev);
  };

  // 工具函数：根据 URL 构造一个全屏 iframe 节点
  const buildIframe = (url: string) => (
    <iframe
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      src={url}
    />
  );

  // 从 URL 中提取一个用于 tab 显示的标题（优先使用 host）
  const getTitleFromUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.host || url;
    } catch {
      return url;
    }
  };

  // 处理 URL 拖拽：
  // - 如果传入 targetKey：替换指定标签的内容为该 URL
  // - 否则：在标签栏末尾新建一个标签
  const handleUrlDrop = (url: string, targetKey?: string) => {
    const title = getTitleFromUrl(url);

    if (targetKey) {
      const nextTabs = tabs.map(tab =>
        tab.key === targetKey
          ? {
              ...tab,
              tab: title,
              children: buildIframe(url),
            }
          : tab,
      );
      setTabs(nextTabs);
      setActiveKey(targetKey);
      return;
    }

    const newKey = `tab-${Date.now()}`;
    const newTab: TabItem = {
      key: newKey,
      tab: title,
      color: '#2b6dde',
      icon: '🌐',
      children: buildIframe(url),
    };
    setTabs([...tabs, newTab]);
    setActiveKey(newKey);
  };

  const shellClassName = [
    'edge-tabs-shell',
    mode === 'vertical' ? 'edge-tabs-shell-vertical' : '',
    mode === 'vertical' && verticalCollapsed ? 'edge-tabs-shell-vertical-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <EdgeTabs
      items={tabs}
      activeKey={activeKey}
      onChange={handleTabChange}
      onItemsChange={handleItemsChange}
      onAddTab={handleAddTab}
      onCloseTab={handleCloseTab}
      onUrlDrop={handleUrlDrop}
      mode={mode}
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
  );
};

export default EdgeTabsDemo;
