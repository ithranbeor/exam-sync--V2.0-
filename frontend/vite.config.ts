import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    // ✅ Plugin to copy _redirects file to build output
    {
      name: 'copy-redirects',
      closeBundle() {
        // Copy _redirects to build output for Render
        const fs = require('fs');
        const srcPath = path.resolve(__dirname, 'public/_redirects');
        const destPath = path.resolve(__dirname, 'build/_redirects');
        
        try {
          if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log('✅ Copied _redirects to build folder');
          } else {
            console.warn('⚠️  _redirects file not found in public/');
          }
        } catch (err) {
          console.error('❌ Error copying _redirects:', err);
        }
      }
    }
  ],
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
  }
})