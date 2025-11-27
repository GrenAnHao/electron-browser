import React, { useState } from 'react'
import { Button, Card, Col, Input, Row, Typography } from '@douyinfe/semi-ui'

interface HomePageProps {
  onOpenUrl: (url: string) => void
}

const quickLinks: Array<{ title: string; url: string }> = [
  { title: '必应', url: 'https://cn.bing.com' },
  { title: '哔哩哔哩', url: 'https://www.bilibili.com' },
  { title: 'GitHub', url: 'https://github.com' },
  { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { title: 'Vue', url: 'https://cn.vuejs.org' },
  { title: 'React', url: 'https://react.dev' },
  { title: 'MDN', url: 'https://developer.mozilla.org' },
  { title: '掘金', url: 'https://juejin.cn' }
]

const { Title, Text } = Typography

const normalizeInputToUrl = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }
  const query = encodeURIComponent(trimmed)
  return `https://cn.bing.com/search?q=${query}`
}

const HomePage: React.FC<HomePageProps> = ({ onOpenUrl }) => {
  const [search, setSearch] = useState('')

  const handleSubmit = () => {
    const target = normalizeInputToUrl(search)
    if (!target) {
      return
    }
    onOpenUrl(target)
  }

  return (
    <div
      style={{
        padding: 24,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        overflow: 'auto'
      }}
    >
      <div
        style={{
          maxWidth: 720,
          width: '100%'
        }}
      >
        <div
          style={{
            marginBottom: 32,
            marginTop: 32,
            textAlign: 'center'
          }}
        >
          <Title heading={3} style={{ marginBottom: 16 }}>
            快捷启动
          </Title>
          <div
            style={{
              display: 'flex',
              gap: 8
            }}
          >
            <Input
              placeholder="输入网址或搜索内容"
              value={search}
              onChange={(value) => setSearch(value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit()
                }
              }}
            />
            <Button type="primary" onClick={handleSubmit}>
              前往
            </Button>
          </div>
        </div>
        <Row gutter={[16, 16]}>
          {quickLinks.map((item) => (
            <Col span={6} key={item.url}>
              <div style={{ cursor: 'pointer' }} onClick={() => onOpenUrl(item.url)}>
                <Card bodyStyle={{ padding: 12, textAlign: 'center' }}>
                  <Text>{item.title}</Text>
                </Card>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  )
}

export default HomePage
