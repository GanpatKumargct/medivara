import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Same-origin dev proxy to the FastAPI backend's /api/v1 (integration plan G-3).
// In dummy-data mode nothing hits the proxy; it is here so switching to the real
// backend later needs no app-code change.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
