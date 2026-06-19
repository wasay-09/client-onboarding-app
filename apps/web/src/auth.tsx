import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authEnabled, supabase } from './supabase'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(authEnabled)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Un-gated local dev (no Supabase) defaults to 'admin' so the staff dashboard is
  // reachable — matches the API's DEV_USER_ROLE default. With auth on, the role comes
  // from the Supabase custom claim app_metadata.role (set by an admin).
  const role = !authEnabled
    ? 'admin'
    : ((session?.user?.app_metadata?.role as string | undefined) ?? null)

  const value: AuthState = {
    authEnabled,
    loading,
    session,
    email: session?.user?.email ?? null,
    role,
    signOut: async () => {
      await supabase?.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
