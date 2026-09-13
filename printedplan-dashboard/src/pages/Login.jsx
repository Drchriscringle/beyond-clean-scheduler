import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'
import { Field } from '../components/ui.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mfa, setMfa] = useState(null) // { factorId } when a second factor is required
  const [code, setCode] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password, remember)
      // If two-factor is enrolled, Supabase issues an aal1 session; ask for the code.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.find((f) => f.status === 'verified')
        if (totp) {
          setMfa({ factorId: totp.id })
          return
        }
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMfa(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfa.factorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfa.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (vErr) throw vErr
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-black text-slate-900">
            P
          </span>
          <h1 className="mt-3 text-lg font-bold tracking-wide text-white">PRINTEDPLANCOMPANY DASHBOARD</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to see today&apos;s plan.</p>
        </div>

        <div className="card p-6">
          {mfa ? (
            <form onSubmit={handleMfa} className="space-y-4">
              <Field label="Two-factor code" hint="Enter the 6-digit code from your authenticator app.">
                <input
                  className="input tracking-widest"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Password">
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me on this device
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Single-user dashboard. Sign-up is disabled; accounts are created in Supabase.
        </p>
      </div>
    </div>
  )
}
