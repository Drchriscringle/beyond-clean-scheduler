import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// One-time cleanup for devices that installed the first build, whose
// service worker had pinned index.html (including a Netlify-injected
// script) in its precache. Dropping those caches lets the old worker fall
// through to the network until the new worker takes over.
const PURGE_KEY = 'pm_cache_purge_v1'
if ('caches' in window && !localStorage.getItem(PURGE_KEY)) {
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('workbox-precache')).map((k) => caches.delete(k))))
    .then(() => localStorage.setItem(PURGE_KEY, '1'))
    .catch(() => {})
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
