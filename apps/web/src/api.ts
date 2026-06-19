import type { FormValues, PlanType } from '@fbsi/shared'
import { supabase } from './supabase'

// The web app talks ONLY to our own API (never the DB directly). Configurable via
// VITE_API_URL; defaults to the local dev API.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

// Attach the signed-in user's Supabase JWT so the API can authenticate + scope the
// request to their data. Empty when auth isn't configured (local dev + AUTH_BYPASS).
async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

export interface CreatedCase {
  id: string
  pdfUrl: string
}

export interface LoadedCase {
  id: string
  planType: PlanType
  answers: FormValues
  status: string
  pdfUrl: string
  createdAt: string
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(`API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** Fetch a case's server-made PDF WITH the auth header and open it in a new tab.
 *  A plain <a href> can't carry the bearer token, so the protected PDF route needs
 *  this fetch-to-blob path. */
export async function openCasePdf(caseId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/cases/${caseId}/pdf`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  const url = URL.createObjectURL(await res.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000) // let the new tab load first
}

export async function createCase(planType: PlanType, answers: FormValues): Promise<CreatedCase> {
  const res = await fetch(`${API_URL}/api/cases`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ planType, answers }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}

export async function getCase(id: string): Promise<LoadedCase> {
  const res = await fetch(`${API_URL}/api/cases/${id}`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}

/** The caller's most recent case, for cross-session pre-fill ("ask once"). Returns
 *  null when they have no prior case (API replies 204). */
export async function getLatestCase(): Promise<LoadedCase | null> {
  const res = await fetch(`${API_URL}/api/cases/latest`, { headers: await authHeaders() })
  if (res.status === 204 || res.status === 404) return null
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}

// ── Staff dashboard (internal, role-gated by the API) ────────────────────────

export interface StaffCaseRow {
  id: string
  planType: PlanType
  status: string
  createdAt: string
  orgName: string
  ein: string | null
  planName: string | null
  ownerId: string | null
}

export interface StaffCaseList {
  rows: StaffCaseRow[]
  total: number
}

export interface StaffParty {
  id: string
  role: string
  name: string | null
  email: string | null
  phone: string | null
  title: string | null
  isAuthorizedSigner: boolean | null
}

export interface StaffDocument {
  id: string
  type: string
  sha256: string | null
  signedAt: string | null
  createdAt: string
}

export interface StaffCaseDetail {
  id: string
  planType: PlanType
  status: string
  createdAt: string
  answers: FormValues
  orgName: string
  ein: string | null
  planName: string | null
  pdfUrl: string
  pdfHash: string | null
  parties: StaffParty[]
  documents: StaffDocument[]
}

export interface StaffCaseQuery {
  q?: string
  planType?: string
  status?: string
  limit?: number
  offset?: number
}

export async function listStaffCases(params: StaffCaseQuery = {}): Promise<StaffCaseList> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const res = await fetch(`${API_URL}/api/staff/cases?${qs.toString()}`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}

export async function getStaffCase(id: string): Promise<StaffCaseDetail> {
  const res = await fetch(`${API_URL}/api/staff/cases/${id}`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}

/** Open a case's server-made PDF in a new tab. Like openCasePdf, a fetch-to-blob is
 *  needed because the bearer token can't ride a plain <a href>. */
export async function openStaffCasePdf(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/staff/cases/${id}/pdf`, { headers: await authHeaders() })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  const url = URL.createObjectURL(await res.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
