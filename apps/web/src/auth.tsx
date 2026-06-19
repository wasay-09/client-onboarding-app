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

  const value: AuthState = {
    authEnabled,
    loading,
    session,
    email: session?.user?.email ?? null,
    signOut: async () => {
      await supabase?.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
