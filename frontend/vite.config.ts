// exam-sync-v2/frontend/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable in production for smaller builds
  },
  server: {
    port: 5173,
    host: true, // Important for Render
  },
  preview: {
    port: 5173,
    host: true,
  },
})