import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Keep the charting library in its own cacheable chunk.
        manualChunks: (id) => (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') ? 'charts' : undefined),
      },
    },
  },
})
