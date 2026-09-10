import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import netlify from '@netlify/vite-plugin'

// The Netlify plugin emulates the hosted platform locally — the serverless
// functions and Blobs the deployed studio runs on — so the dev server
// exercises the same code path as production, not just the Node server.
export default defineConfig({
  plugins: [react(), netlify()],
})
