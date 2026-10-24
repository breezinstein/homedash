import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    // Keep the browser on one origin during development, matching production.
    proxy: {
      '/api': 'http://localhost:3001',
      '/icons': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
})
