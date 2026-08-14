import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Hooks must always use the exact React instance owned by react-dom. This
    // also protects linked/local packages and Vite's optimized dependency graph.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/firebase/') || id.includes('@firebase')) return 'firebase'
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts'
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react'
        },
      },
    },
  },
})
