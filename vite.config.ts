import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the production build can be opened from the file system
// or served from any sub-path without rewriting asset URLs.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    // Monaco is large; the chunk-size warning is expected and not actionable.
    chunkSizeWarningLimit: 4000,
  },
})
