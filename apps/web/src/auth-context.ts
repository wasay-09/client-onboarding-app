import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  /** False when Supabase isn't configured (local dev) — the app runs un-gated. */
  authEnabled: boolean
  /** True until the initial session is resolved (avoids a sign-in flash on reload). */
  loading: boolean
  session: Session | null
  email: string | null
  /** App role from app_metadata.role ('staff' | 'admin' for FBSI internal users).
   *  'admin' in un-gated local dev so the staff dashboard is reachable. */
  role: string | null
  signOut: () => Promise<void>
}

/** Whether a role grants access to the internal staff dashboard. */
export function isStaffRole(role: string | null): boolean {
  return role === 'staff' || role === 'admin'
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
