import type { PlanType } from '../types'
import { PLANS } from '../schema/plans'

interface Props {
  onSelect: (type: PlanType) => void
}

export function PlanPicker({ onSelect }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-navy">Select a plan type</h1>
      <p className="mt-2 text-slate-600">
        Choose the plan you'd like to set up. We'll ask only the questions that apply to it.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <button
            key={plan.type}
            onClick={() => onSelect(plan.type)}
            className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm
              transition hover:border-accent hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-navy">{plan.name}</span>
              <span className="text-accent opacity-0 transition group-hover:opacity-100">→</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
