import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import { SettingsProvider } from './hooks/useSettings.jsx'
import { isConfigured } from './lib/supabase.js'
import Layout from './components/Layout.jsx'
import ToastViewport from './components/Toast.jsx'
import { Spinner } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EtsyTracker from './pages/EtsyTracker.jsx'
import PinterestTracker from './pages/PinterestTracker.jsx'
import InstagramTracker from './pages/InstagramTracker.jsx'
import ContentPipeline from './pages/ContentPipeline.jsx'
import CopyLibrary from './pages/CopyLibrary.jsx'
import PerformanceAnalytics from './pages/PerformanceAnalytics.jsx'
import Settings from './pages/Settings.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Checking your session…" className="min-h-screen" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Checking your session…" className="min-h-screen" />
  if (user) return <Navigate to="/" replace />
  return children
}

function NotConfigured() {
  return (
    <div className="mx-auto mt-16 max-w-lg px-4">
      <div className="card p-6">
        <h1 className="text-lg font-bold">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Copy <code>.env.example</code> to <code>.env</code> and fill in <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server. On Vercel, add the same two variables under
          Project → Settings → Environment Variables and redeploy.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <SettingsProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  <RedirectIfAuthed>
                    <Login />
                  </RedirectIfAuthed>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="etsy" element={<EtsyTracker />} />
                <Route path="pinterest" element={<PinterestTracker />} />
                <Route path="instagram" element={<InstagramTracker />} />
                <Route path="pipeline" element={<ContentPipeline />} />
                <Route path="copy" element={<CopyLibrary />} />
                <Route path="analytics" element={<PerformanceAnalytics />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <ToastViewport />
        </AuthProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}
