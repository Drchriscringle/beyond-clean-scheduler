import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built app works from any folder or host (it uses #/ routes).
export default defineConfig({
  base: './',
  plugins: [react()],
})
