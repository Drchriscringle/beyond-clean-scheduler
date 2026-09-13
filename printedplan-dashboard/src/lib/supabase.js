import { createClient } from '@supabase/supabase-js'

// Set these in .env (see .env.example). Find them in Supabase: Project Settings -> API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const REMEMBER_KEY = 'ppc_remember_me'

export function setRememberMe(value) {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

export function getRememberMe() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0'
  } catch {
    return true
  }
}

// Auth token lives in localStorage (30-day style persistent session) unless the
// user unticks "Remember me" at login, in which case it lives in sessionStorage
// and disappears when the tab closes.
const authStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      if (getRememberMe()) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    } catch {
      /* storage unavailable */
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      /* storage unavailable */
    }
  },
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
