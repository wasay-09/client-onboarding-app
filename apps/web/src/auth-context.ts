import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  /** False when Supabase isn't configured (local dev) — the app runs un-gated. */
  authEnabled: boolean
  /** True until the initial session is resolved (avoids a sign-in flash on reload). */
  loading: boolean
  session: Session | null
  email: string | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
