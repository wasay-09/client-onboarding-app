import { useState } from 'react'
import { supabase } from '../supabase'

type Mode = 'signin' | 'signup'

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // If email confirmation is enabled, there's no session yet.
        if (!(await supabase.auth.getSession()).data.session) {
          setNotice('Check your email to confirm your account, then sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // On success, onAuthStateChange swaps this screen for the app.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white font-extrabold text-base shadow-sm tracking-tighter">
              FBSI
            </div>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-navy">
              Retirement Plan Onboarding
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Client Portal
            </p>
          </div>

          <form
            onSubmit={submit}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg flex flex-col gap-4"
          >
            <h2 className="text-sm font-bold text-navy">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </h2>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-500">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs font-semibold text-red-600">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-accent-600 active:scale-98 transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
                setNotice(null)
              }}
              className="text-xs font-semibold text-slate-500 hover:text-navy transition-colors"
            >
              {mode === 'signin'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
