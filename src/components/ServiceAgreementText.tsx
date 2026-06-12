import type { PlanType } from '../types'
import type { FormValues } from '../schema/visibility'
import {
  ARTICLES, feeHighlights, getSlaFees, parseSlaDate, selectSlaTemplate,
} from '../pdf/serviceAgreementContent'

interface Props {
  planType: PlanType
  values: FormValues
}

/**
 * On-screen, readable rendering of the Service Agreement for the click-wrap
 * "I Agree" step. Renders from the SAME content module as the PDF, so the text
 * the user agrees to on screen always matches the downloadable copy.
 */
export function ServiceAgreementText({ planType, values }: Props) {
  const template = selectSlaTemplate(planType, values)
  const fees = getSlaFees(template)
  const { day, month, year } = parseSlaDate(values.planEffectiveDate ?? '')
  const employer = values.companyName || '________'
  const planName = values.planName || '________'

  return (
    <div className="text-slate-700">
      <div className="border-b border-slate-200 pb-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Flexible Benefits Systems, Inc.</p>
        <h3 className="text-lg font-bold text-navy">Service Agreement</h3>
        <p className="text-xs text-slate-500">{fees.templateLabel}</p>
      </div>

      {/* Preamble with merge fields */}
      <p className="text-[13px] leading-relaxed bg-slate-50 border-l-2 border-accent p-3 rounded-r-lg">
        This Service Agreement (the “Agreement”) is entered into between Flexible Benefits Systems, Inc. (“FBSI”) and{' '}
        <span className="font-bold text-navy">{employer}</span>, the employer and plan sponsor (“Plan Sponsor”), to provide{' '}
        {fees.serviceDescription} for the <span className="font-bold text-navy">{planName}</span> (the “Plan”), under the terms,
        conditions and limitations stated herein, effective as of the <span className="font-bold">{day}</span> day of{' '}
        <span className="font-bold">{month}</span>, <span className="font-bold">{year}</span> (the “Effective Date”).
      </p>

      {/* Fee highlights */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Fee Schedule Highlights</p>
        <div className="space-y-1.5">
          {feeHighlights(template).map((f) => (
            <div key={f.label} className="flex justify-between items-baseline gap-4 text-[13px] border-b border-slate-50 pb-1.5 last:border-0">
              <span className="text-slate-600">{f.label}</span>
              <span className="font-bold text-navy whitespace-nowrap">{f.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400 italic">
          The full fee schedule (Exhibit A) and plan expense allocation grid (Exhibit B) are included in the downloadable copy.
        </p>
      </div>

      {/* Articles */}
      <div className="mt-5 space-y-4">
        {ARTICLES.map((art) => (
          <div key={art.num}>
            <h4 className="text-[13px] font-bold text-navy bg-slate-50 rounded px-2 py-1">
              Article {art.num} — {art.title}
            </h4>
            <div className="mt-2 space-y-2">
              {art.secs.map((sec) => (
                <div key={sec.num} className="flex gap-2.5">
                  <span className="text-[11px] font-bold text-slate-400 w-8 shrink-0">{sec.num}</span>
                  <div className="text-[12px] leading-relaxed">
                    <span className="font-bold text-slate-800">{sec.title}. </span>
                    <span>{sec.body}</span>
                    {sec.address && (
                      <div className="mt-1.5 text-slate-600">
                        {sec.address.map((line) => <div key={line}>{line}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Execution */}
        <div>
          <h4 className="text-[13px] font-bold text-navy bg-slate-50 rounded px-2 py-1">Article XI — Execution</h4>
          <p className="mt-2 text-[12px] leading-relaxed">
            By agreeing to this Agreement, the Plan Sponsor agrees and acknowledges that it has reviewed the Agreement and is
            legally authorized to enter into this Agreement on behalf of the Plan.
          </p>
        </div>
      </div>
    </div>
  )
}
