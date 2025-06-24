import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@entities': path.resolve(__dirname, 'src/entities'),
      '@app': path.resolve(__dirname, 'src/app'),
      '@widgets': path.resolve(__dirname, 'src/widgets'),
      '@pages': path.resolve(__dirname, 'src/pages'),
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Убираем HTTPS для работы с туннелем
    allowedHosts: ['dev-bot.appninjabot.ru', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      // Добавляем proxy для WebSocket соединений
      '/socket.io': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
