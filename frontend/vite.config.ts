import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ✅ Simple config - Vite automatically copies public/ to build output
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Render expects this
    sourcemap: false,
    chunkSizeWarningLimit: 600,
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
  },
  // ✅ Vite will copy everything from public/ to build/ automatically
  publicDir: 'public'
})