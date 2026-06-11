import { useState } from 'react'
import type { PlanType } from './types'
import type { FormValues } from './schema/visibility'
import { getPlan } from './schema/plans'
import { PlanPicker } from './components/PlanPicker'
import { QuestionnaireForm } from './components/QuestionnaireForm'
import { downloadQuestionnairePdf } from './pdf/generatePdf'

type Step = 'pick' | 'fill' | 'done'

export default function App() {
  const [step, setStep] = useState<Step>('pick')
  const [planType, setPlanType] = useState<PlanType | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)

  async function complete(data: FormValues) {
    if (!planType) return
    setValues(data)
    setBusy(true)
    try {
      const name = await downloadQuestionnairePdf(planType, data)
      setFileName(name)
      setStep('done')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStep('pick')
    setPlanType(null)
    setValues({})
    setFileName('')
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-navy">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <span className="text-sm font-bold uppercase tracking-widest text-white/90">
            Retirement Plan Onboarding
          </span>
        </div>
      </header>

      {step === 'pick' && (
        <PlanPicker
          onSelect={(type) => {
            setPlanType(type)
            setStep('fill')
          }}
        />
      )}

      {step === 'fill' && planType && (
        <QuestionnaireForm planType={planType} onBack={reset} onComplete={complete} />
      )}

      {step === 'done' && planType && (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-bold text-navy">Questionnaire complete</h1>
          <p className="mt-2 text-slate-600">
            Your {getPlan(planType).name} questionnaire has been downloaded
            {fileName && <> as <span className="font-semibold">{fileName}</span></>}.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => downloadQuestionnairePdf(planType, values)}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download again
            </button>
            <button
              onClick={reset}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
            >
              Start a new questionnaire
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 flex items-center justify-center bg-white/60">
          <span className="text-sm font-medium text-slate-600">Generating PDF…</span>
        </div>
      )}
    </div>
  )
}
