import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {    
    sourcemap: false, // Tắt hoàn toàn việc sinh Source Map khi build production
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Đảm bảo cổng này khớp với cổng FastAPI backend đang chạy
        changeOrigin: true,
        secure: false,
      },
    },
  },
})