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
    // Page-level security headers for the dev server. No Content-Security-Policy here: Vite's
    // dev mode injects inline scripts (HMR); set a CSP where the production build is hosted.
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      // camera and microphone: this app only (sign mode, dictation); never embedded third parties.
      'Permissions-Policy': 'camera=(self), geolocation=(), microphone=(self)',
    },
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Adds X-Forwarded-For so the backend's sign-in limit counts each browser, not the proxy.
        xfwd: true,
      },
    },
  },
})
