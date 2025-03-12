import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/', // This will prefix all asset URLs with /static/
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  // This ensures files in the public directory are copied to dist
  publicDir: 'public',
})
