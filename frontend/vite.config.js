import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import locatorJsPlugin from '@locator/babel-jsx/dist/index.js'
import { fileURLToPath } from 'node:url'

// Port 5000 is taken by another app (UPS automation); override with EDI_API=http://localhost:XXXX.
const EDI_API = process.env.EDI_API || 'http://localhost:5001'

const proxyToBackend = (extra = {}) => ({ target: EDI_API, changeOrigin: true, secure: false, ...extra })

// LocatorJS browser extension: Alt+click a component to open its source file (dev server only).
// The plugin writes file paths into JS strings, so Windows backslashes ("\u...") must become forward slashes.
const toForwardSlashes = (path) => path.replace(/\\/g, '/')

const locatorWithForwardSlashPaths = (api) => {
  const locator = locatorJsPlugin.default(api)
  const { enter, exit } = locator.visitor.Program
  return {
    ...locator,
    visitor: {
      ...locator.visitor,
      Program: {
        enter(path, state) {
          state.filename = toForwardSlashes(state.filename)
          state.cwd = toForwardSlashes(state.cwd)
          enter.call(this, path, state)
        },
        exit,
      },
    },
  }
}

const locatorJs = () => babel({ plugins: [[locatorWithForwardSlashPaths, { env: 'development' }]] })

export default defineConfig(({ command }) => ({
  plugins: [...(command === 'serve' ? [locatorJs()] : []), react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  build: {
    outDir: '../node-backend/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': proxyToBackend(),
      '/uploads': proxyToBackend(),
      '/socket.io': proxyToBackend({ ws: true }),
    },
  },
}))
