import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [react()],
    base: isProduction ? '/static/' : '/', // Use /static/ only in production
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    // This ensures files in the public directory are copied to dist
    publicDir: 'public',
  }
})
