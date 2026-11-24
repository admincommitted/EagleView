import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 03-Nov-2026: port 5000 is taken by another app (UPS automation), so the EDI backend runs on 5001.
// Override with EDI_API=http://localhost:XXXX if needed.
const EDI_API = process.env.EDI_API || 'http://localhost:5001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../node-backend/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // HRMS APIs moved to the separate hrms-backend (port 5100); EDI talks only to node-backend.
      '/api': {
        target: EDI_API,
        changeOrigin: true,
        secure: false,
      },
      // Proxy /uploads/ so document download links work without hardcoded localhost
      '/uploads': {
        target: EDI_API,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Socket.IO WebSocket connections (for real-time notifications)
      '/socket.io': {
        target: EDI_API,
        changeOrigin: true,
        secure: false,
        ws: true,  // Enable WebSocket proxying
      }
    }
  }
})

