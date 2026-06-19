import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The web app signs in with Supabase Auth and sends the resulting JWT to OUR API
// (never to Supabase directly — architecture invariant 4). The anon key is
// browser-safe; the service-role key lives only on the API.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Whether Supabase Auth is configured. When false, the app runs un-gated for
 *  local dev (pair with the API's AUTH_BYPASS). */
export const authEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url!, anonKey!)
  : null
