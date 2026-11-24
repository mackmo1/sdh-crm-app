import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    // The Cosmos preview tunnel forwards the public host name, so Vite's
    // host allow-list has to accept it in development.
    allowedHosts: true,
    proxy: {
      // Keeps the browser on a single origin in development, so the session
      // cookie works without cross-origin CORS handling.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
