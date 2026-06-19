import type { FormValues, PlanType } from '@fbsi/shared'

// The web app talks ONLY to our own API (never the DB directly). Configurable via
// VITE_API_URL; defaults to the local dev API.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

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

/** Absolute URL to a case's stored PDF (server-made), for download links. */
export function pdfDownloadUrl(caseId: string): string {
  return `${API_URL}/api/cases/${caseId}/pdf`
}

export async function createCase(planType: PlanType, answers: FormValues): Promise<CreatedCase> {
  const res = await fetch(`${API_URL}/api/cases`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ planType, answers }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}

export async function getCase(id: string): Promise<LoadedCase> {
  const res = await fetch(`${API_URL}/api/cases/${id}`)
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res.json()
}
