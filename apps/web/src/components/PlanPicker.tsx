import type { PlanType } from '@fbsi/shared'
import { PLANS } from '@fbsi/shared'

interface Props {
  onSelect: (type: PlanType) => void
}

// Map plan types to customized SVG icons and colored badges
const PLAN_METADATA: Record<
  PlanType,
  {
    icon: React.ReactNode
    badge: string
    badgeClass: string
  }
> = {
  '401k': {
    badge: 'Standard Group',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  '403b': {
    badge: 'Nonprofit / Education',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-100',
    icon: (
      <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  '457b': {
    badge: 'Governmental',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: (
      <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  },
  simpleira: {
    badge: 'Small Business',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: (
      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  solo401k: {
    badge: 'Owner-Only',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: (
      <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
}

export function PlanPicker({ onSelect }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 lg:py-20 animate-fadeIn">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-bold text-accent uppercase tracking-widest bg-accent/10 rounded-full px-4 py-1.5 inline-block">
          FBSI Onboarding Portal
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold text-navy tracking-tight">
          Select Your Plan Type
        </h1>
        <p className="mt-3 text-slate-500 text-sm md:text-base leading-relaxed">
          Choose the retirement plan structure you would like to set up. We'll construct a dynamic onboarding flow tailored precisely to this plan.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const meta = PLAN_METADATA[plan.type]
          return (
            <button
              key={plan.type}
              onClick={() => onSelect(plan.type)}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm
                transition-all duration-350 hover:-translate-y-1 hover:border-accent hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-accent/15"
            >
              <div>
                {/* Header Icon + Arrow */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 group-hover:bg-accent/5 group-hover:scale-105 transition-all duration-300">
                    {meta.icon}
                  </div>
                  <span className="text-slate-300 group-hover:text-accent group-hover:translate-x-1 transition-all duration-300 text-xl font-bold">
                    →
                  </span>
                </div>

                {/* Badging */}
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-3 ${meta.badgeClass}`}>
                  {meta.badge}
                </span>

                {/* Plan Info */}
                <h3 className="text-lg font-bold text-navy tracking-tight group-hover:text-accent transition-colors duration-200">
                  {plan.name}
                </h3>
                <p className="mt-2 text-xs text-slate-400 font-medium leading-relaxed">
                  {plan.blurb}
                </p>
              </div>

              {/* Action Cue */}
              <div className="mt-6 border-t border-slate-50 pt-4 flex items-center text-xs font-bold text-slate-500 group-hover:text-accent transition-colors">
                Begin Questionnaire
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
