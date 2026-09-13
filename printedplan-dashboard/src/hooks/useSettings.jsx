import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../lib/constants.js'

const SettingsContext = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed, apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys } }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load)

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
