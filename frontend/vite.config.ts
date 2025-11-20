import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Render expects this
    sourcemap: false, // remove if not needed
    chunkSizeWarningLimit: 600, // raise warning limit, optional
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // all node_modules go to vendor
            return 'vendor'
          }
          if (id.includes('assets')) {
            // separate assets if needed
            return 'assets'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@assets': path.resolve(__dirname, 'src/assets')
    }
  }
})
