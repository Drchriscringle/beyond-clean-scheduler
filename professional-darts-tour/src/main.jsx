import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the app (no requests to Google, and they work offline).
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/unifrakturmaguntia/400.css'
import '@fontsource/vt323/400.css'
import '@fontsource/old-standard-tt/400.css'
import '@fontsource/old-standard-tt/700.css'
import './styles.css'
import App from './App.jsx'
import { installStoreNames } from './brand.js'

const root = document.getElementById('root')
installStoreNames(root)

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
