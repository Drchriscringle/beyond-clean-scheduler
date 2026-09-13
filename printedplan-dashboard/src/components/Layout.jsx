import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/etsy', label: 'Etsy Tracker', icon: '🛍️' },
  { to: '/pinterest', label: 'Pinterest', icon: '📌' },
  { to: '/instagram', label: 'Instagram', icon: '📱' },
  { to: '/pipeline', label: 'Content Pipeline', icon: '🏗️' },
  { to: '/copy', label: 'Copy Library', icon: '📝' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(e.message)
    }
  }

  const links = (onClick) =>
    NAV.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onClick}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`
        }
      >
        <span aria-hidden="true">{item.icon}</span>
        {item.label}
      </NavLink>
    ))

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar (desktop) */}
      <aside className="no-print hidden w-60 shrink-0 flex-col bg-slate-900 p-4 md:flex md:sticky md:top-0 md:h-screen">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-1">{links()}</nav>
        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="truncate text-xs text-slate-400" title={user?.email}>
            {user?.email}
          </p>
          <button type="button" className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700" onClick={handleSignOut}>
            Log out
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between bg-slate-900 px-4 py-3 md:hidden">
        <Brand compact />
        <button
          type="button"
          className="rounded-lg p-2 text-white hover:bg-slate-800"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 p-4 md:hidden">
          <div className="flex items-center justify-between">
            <Brand compact />
            <button type="button" className="rounded-lg p-2 text-2xl text-white" aria-label="Close menu" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1">{links(() => setOpen(false))}</nav>
          <button type="button" className="mt-6 w-full rounded-lg bg-slate-800 px-3 py-3 text-sm text-slate-200" onClick={handleSignOut}>
            Log out ({user?.email})
          </button>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function Brand({ compact }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-900">P</span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">PrintedPlanCompany</p>
        {!compact && <p className="text-[11px] uppercase tracking-wider text-slate-400">Dashboard</p>}
      </div>
    </div>
  )
}
