import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The GitHub Pages deployment is served from
// https://roryot-ux.github.io/html-email-previewer/, so its asset URLs need the
// repository sub-path. Only the `github-pages` build mode sets it; the deploy
// workflow runs `npm run build -- --mode github-pages`. npm run dev,
// npm run build and npm run preview all use the root path.
export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/html-email-previewer/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    // Monaco is large; the chunk-size warning is expected and not actionable.
    chunkSizeWarningLimit: 4000,
  },
}))
