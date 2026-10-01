import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths so the build works from any web address and inside the native apps.
export default defineConfig({
  base: './',
  plugins: [react()],
})
