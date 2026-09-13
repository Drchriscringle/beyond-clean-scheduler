import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'info', ttl = 4000) => {
      const id = ++counter.current
      setToasts((list) => [...list, { id, message, type }])
      if (ttl > 0) setTimeout(() => dismiss(id), ttl)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      info: (m) => push(m, 'info'),
      success: (m) => push(m, 'success'),
      error: (m) => push(m || 'Something went wrong. Please try again.', 'error', 6000),
    }),
    [toasts, dismiss, push],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
