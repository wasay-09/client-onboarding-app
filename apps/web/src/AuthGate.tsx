import App from './App'
import { useAuth } from './auth-context'
import { SignIn } from './components/SignIn'

/** Gate the app behind a Supabase session. When auth isn't configured (local dev),
 *  the app renders un-gated (pair with the API's AUTH_BYPASS). */
export function AuthGate() {
  const { authEnabled, loading, session } = useAuth()
  if (!authEnabled) return <App />
  if (loading) return null // brief: resolving the persisted session
  if (!session) return <SignIn />
  return <App />
}
