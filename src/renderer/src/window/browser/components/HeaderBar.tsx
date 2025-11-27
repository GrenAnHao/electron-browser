import { Button, Layout, Nav, Space, Typography } from '@douyinfe/semi-ui'
import {
  IconMoon,
  IconSemiLogo,
  IconSun,
  IconMinus,
  IconMaximize,
  IconMinimize,
  IconClose
} from '@douyinfe/semi-icons'
import { useState, useEffect } from 'react'

const { Header } = Layout
const { Title } = Typography

const HeaderBar = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  // 检查窗口是否最大化并监听状态变化
  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.api.window.isMaximized()
      setIsMaximized(maximized)
    }
    checkMaximized()

    // 监听窗口最大化状态变化
    window.api.window.onMaximize((maximized) => {
      setIsMaximized(maximized)
    })

    return () => {
      window.api.window.removeMaximizeListener()
    }
  }, [])

  const handleMinimize = () => {
    window.api.window.minimize()
  }

  const handleMaximize = () => {
    window.api.window.maximize()
  }

  const handleClose = () => {
    window.api.window.close()
  }

  const [dark, setDark] = useState(false)

  const setThemeMode = () => {
    const body = document.body
    if (body.hasAttribute('theme-mode')) {
      body.removeAttribute('theme-mode')
    } else {
      body.setAttribute('theme-mode', 'dark')
    }
    setDark(body.hasAttribute('theme-mode'))
  }

  return (
    <Header
      className={'titleBar'}
      style={{
        height: '64px',
        backgroundColor: 'var(--semi-color-bg-1)',
        boxShadow: 'none'
      }}
    >
      <Nav mode="horizontal" defaultSelectedKeys={['Home']}>
        <Nav.Header>
          <IconSemiLogo style={{ height: '36px', fontSize: 36, paddingRight: '10px' }} />
          <Title
            heading={4}
            style={{ margin: 0, color: 'var(--semi-color-text-0)', fontWeight: 600 }}
          >
            X Online Browser
          </Title>
        </Nav.Header>
        <Nav.Footer>
          <Space>
            {/* <Dropdown
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  {userMenu.map((item, index) => {
                    if (item.node === 'divider') {
                      return <Dropdown.Divider key={index} />
                    }
                    return (
                      <Dropdown.Item key={item.key} icon={item.icon} onClick={item.onClick}>
                        {item.name}
                      </Dropdown.Item>
                    )
                  })}
                </Dropdown.Menu>
              }
            >
              <Avatar color="orange" size="extra-small">
                YJ
              </Avatar>
            </Dropdown> */}

            {/* 窗口操作按钮 */}
            <Space style={{ marginLeft: '16px' }}>
              <Button
                theme="borderless"
                icon={dark ? <IconSun size="large" /> : <IconMoon size="large" />}
                style={{
                  color: 'var(--semi-color-text-2)'
                }}
                onClick={setThemeMode}
              />

              <Button
                theme="borderless"
                icon={<IconMinus />}
                onClick={handleMinimize}
                style={{
                  color: 'var(--semi-color-text-2)',
                  width: '32px',
                  height: '32px',
                  padding: 0
                }}
              />
              <Button
                theme="borderless"
                icon={isMaximized ? <IconMinimize /> : <IconMaximize />}
                onClick={handleMaximize}
                style={{
                  color: 'var(--semi-color-text-2)',
                  width: '32px',
                  height: '32px',
                  padding: 0
                }}
              />
              <Button
                theme="borderless"
                icon={<IconClose />}
                onClick={handleClose}
                style={{
                  color: 'var(--semi-color-text-2)',
                  width: '32px',
                  height: '32px',
                  padding: 0
                }}
              />
            </Space>
          </Space>
        </Nav.Footer>
      </Nav>
    </Header>
  )
}

export default HeaderBar
