import { useEffect, useMemo, useState } from 'react'
import {
  getPlan,
  indexFields,
  isSectionVisible,
  isVisible,
  displayValue,
  parseTable,
  type FieldDef,
} from '@fbsi/shared'
import { getStaffCase, openStaffCasePdf, type StaffCaseDetail as Detail } from '../api'

const ROLE_LABELS: Record<string, string> = {
  primary_contact: 'Primary Contact',
  contact: 'Plan Contact',
  trustee: 'Trustee',
  advisor: 'Financial Advisor',
  payroll: 'Payroll Contact',
  ach: 'ACH Contact',
}

/** A single answer field, rendered read-only for staff (mirrors the form's visibility,
 *  so what staff see is exactly what the PDF prints). Table fields show their rows. */
function FieldRow({ field, values }: { field: FieldDef; values: Detail['answers'] }) {
  if (field.type === 'table') {
    const rows = parseTable(values[field.name])
    if (rows.length === 0) return null
    return (
      <div className="py-2">
        <dt className="text-xs font-semibold text-slate-400">{field.label}</dt>
        <dd className="mt-1 space-y-1">
          {rows.map((r, i) => (
            <div key={i} className="text-xs text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5">
              {(field.columns ?? []).map((c) => r[c.key]).filter(Boolean).join(' · ')}
            </div>
          ))}
        </dd>
      </div>
    )
  }
  const value = displayValue(field, values)
  if (!value) return null
  return (
    <div className="py-2 flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-xs font-semibold text-slate-400 sm:w-1/2 shrink-0">{field.label}</dt>
      <dd className="text-sm text-slate-800 sm:w-1/2 break-words">{value}</dd>
    </div>
  )
}

export function StaffCaseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // The parent remounts this panel per case (key={id}), so loading/error start fresh and
  // we only set state inside the async callbacks (the repo's effect pattern).
  useEffect(() => {
    let cancelled = false
    getStaffCase(id)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
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
  }, [id])

  const sections = useMemo(() => (detail ? getPlan(detail.planType).sections : []), [detail])
  const byName = useMemo(() => indexFields(sections), [sections])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/30 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-navy tracking-tight">
              {detail?.orgName ?? 'Case'}
            </h2>
            {detail && (
              <p className="text-xs text-slate-400">
                {getPlan(detail.planType).name} · {detail.ein ? `EIN ${detail.ein}` : 'no EIN'} ·{' '}
                {new Date(detail.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {error && <p className="text-sm text-rose-500">Could not load this case.</p>}

          {detail && (
            <>
              <div className="flex flex-wrap gap-2 mb-5">
                <button
                  onClick={() => openStaffCasePdf(detail.id)}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-600 transition-colors shadow-sm"
                >
                  Download Package
                </button>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  {detail.status}
                </span>
              </div>

              {detail.parties.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Parties</h3>
                  <div className="space-y-1.5">
                    {detail.parties.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-baseline gap-x-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wide">
                          {ROLE_LABELS[p.role] ?? p.role}
                        </span>
                        <span className="font-semibold text-slate-800">{p.name ?? '—'}</span>
                        {p.email && <span className="text-slate-500 text-xs">{p.email}</span>}
                        {p.phone && <span className="text-slate-400 text-xs">{p.phone}</span>}
                        {p.isAuthorizedSigner && (
                          <span className="text-[10px] font-bold text-emerald-600">authorized signer</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Submission</h3>
                {sections
                  .filter((s) => isSectionVisible(s, detail.answers, byName))
                  .map((section) => {
                    const fields = section.fields.filter((f) => isVisible(f, detail.answers, byName))
                    return (
                      <div key={section.id} className="mb-4 border-t border-slate-100 pt-3">
                        <h4 className="text-sm font-bold text-navy mb-1">{section.title}</h4>
                        <dl className="divide-y divide-slate-50">
                          {fields.map((f) => (
                            <FieldRow key={f.name} field={f} values={detail.answers} />
                          ))}
                        </dl>
                      </div>
                    )
                  })}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
