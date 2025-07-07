import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to backend to avoid CORS issues
      '/api': {
        target: process.env.VITE_PUBLIC_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: false, // Don't proxy WebSocket connections through this route
      },
      // Proxy workflow-related calls to backend
      '/workflows': {
        target: process.env.VITE_PUBLIC_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying for DevTools
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // For local development: use frontend URL (proxy will route to backend)
    // For production: use backend URL directly
    'import.meta.env.VITE_PUBLIC_API_URL': JSON.stringify(
      process.env.NODE_ENV === 'production' 
        ? (process.env.VITE_PUBLIC_API_URL || 'http://localhost:8000')
        : 'http://localhost:5173'
    ),
  },
});