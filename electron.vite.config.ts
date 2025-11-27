import { resolve } from 'path'
import { bytecodePlugin, defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    publicDir: 'resources',
    build: {
      minify: 'esbuild',
      target: 'node20',
      rollupOptions: {
        output: {
          compact: true
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      minify: 'esbuild',
      target: 'node20',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          webview: resolve(__dirname, 'src/preload/webview.ts')
        },
        output: {
          compact: true
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@customModel': resolve('src/customModel')
      }
    },
    plugins: [react()],
    build: {
      minify: 'esbuild',
      target: 'es2020',
      cssMinify: true,
      rollupOptions: {
        output: {
          compact: true,
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'semi-vendor': ['@douyinfe/semi-ui', '@douyinfe/semi-icons']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    }
  }
})
