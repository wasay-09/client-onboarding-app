import { useEffect, useState } from 'react'
import { getPlan, PLANS } from '@fbsi/shared'
import { listStaffCases, type StaffCaseRow } from '../api'
import { StaffCaseDetail } from './StaffCaseDetail'

const PAGE_SIZE = 25

export function StaffDashboard({ onExit }: { onExit: () => void }) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [planType, setPlanType] = useState('')
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<StaffCaseRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Fetch on filter/page change. State is only set inside the async callbacks (never
  // synchronously in the effect body) — the repo's pattern; offset is reset to page 1 in
  // the filter handlers, not here.
  useEffect(() => {
    let cancelled = false
    listStaffCases({ q: debouncedQ || undefined, planType: planType || undefined, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (cancelled) return
        setRows(res.rows)
        setTotal(res.total)
        setError(false)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, planType, offset])

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">Submitted Cases</h1>
          <p className="text-sm text-slate-400">Internal staff view — every client onboarding submission.</p>
        </div>
        <button
          onClick={onExit}
          className="text-sm font-bold text-slate-400 hover:text-navy transition-colors"
        >
          ← Back to portal
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOffset(0)
          }}
          placeholder="Search company, EIN, or plan name…"
          className="flex-1 min-w-[240px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <select
          value={planType}
          onChange={(e) => {
            setPlanType(e.target.value)
            setOffset(0)
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="">All plan types</option>
          {PLANS.map((p) => (
            <option key={p.type} value={p.type}>
              {p.short}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 font-bold">Company</th>
              <th className="px-4 py-3 font-bold">EIN</th>
              <th className="px-4 py-3 font-bold">Plan</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3 font-bold text-navy">{r.orgName}</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums">{r.ein ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.planName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    {getPlan(r.planType).short}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{r.status}</td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                  {error ? 'Could not load cases.' : 'No cases match your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {loading ? 'Loading…' : `${from}–${to} of ${total}`}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            Previous
          </button>
          <button
            disabled={to >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* key remounts the panel per case, so its loading/error state starts fresh. */}
      {selectedId && <StaffCaseDetail key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
