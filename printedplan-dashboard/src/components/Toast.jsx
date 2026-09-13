import { useToast } from '../hooks/useToast.jsx'

export default function ToastViewport() {
  const { toasts, dismiss } = useToast()
  if (!toasts.length) return null
  const styles = {
    info: 'bg-slate-900 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg ${styles[t.type] || styles.info}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
