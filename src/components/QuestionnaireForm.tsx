import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { PlanType, SectionDef } from '../types'
import { getPlan } from '../schema/plans'
import { indexFields, isSectionVisible, isVisible, validate } from '../schema/visibility'
import type { FormValues } from '../schema/visibility'
import { hasSla } from '../pdf/serviceAgreementContent'
import { downloadServiceAgreementPdf } from '../pdf/generatePdf'
import { ServiceAgreementText } from './ServiceAgreementText'
import { Field } from './fields/Field'

interface Props {
  planType: PlanType
  onBack: () => void
  onComplete: (values: FormValues) => void
}

type Step =
  | { kind: 'section'; section: SectionDef }
  | { kind: 'sla' }

const SLA_ACK = 'slaAcknowledged'

const stepTitle = (step: Step): string =>
  step.kind === 'sla' ? 'Service Agreement' : step.section.title

export function QuestionnaireForm({ planType, onBack, onComplete }: Props) {
  const plan = getPlan(planType)
  const methods = useForm<FormValues>({ defaultValues: {}, mode: 'onSubmit' })
  const { handleSubmit, watch, getValues, setValue } = methods
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeStep, setActiveStep] = useState(0)
  const [slaBusy, setSlaBusy] = useState(false)
  const [slaDownloaded, setSlaDownloaded] = useState(false)
  const [slaError, setSlaError] = useState<string | null>(null)

  // Watch all values so conditional visibility re-evaluates as the user types.
  const values = watch()
  const byName = useMemo(() => indexFields(plan.sections), [plan])

  // Build the ordered step list: visible sections, with the Service Agreement
  // review/sign gate injected right after the identifying info it needs.
  const steps = useMemo<Step[]>(() => {
    const list: Step[] = []
    for (const section of plan.sections) {
      if (!isSectionVisible(section, values, byName)) continue
      list.push({ kind: 'section', section })
      if (plan.slaAfterSectionId && section.id === plan.slaAfterSectionId) {
        list.push({ kind: 'sla' })
      }
    }
    return list
  }, [plan, values, byName])

  const stepIdx = Math.min(activeStep, steps.length - 1)
  const currentStep = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1

  const visibleFields = useMemo(() => {
    if (currentStep.kind !== 'section') return []
    return currentStep.section.fields.filter((f) => isVisible(f, values, byName))
  }, [currentStep, values, byName])

  const slaAcknowledged = values[SLA_ACK] === 'Yes'

  const findStepForField = (fieldName: string): number =>
    steps.findIndex((s) => s.kind === 'section' && s.section.fields.some((f) => f.name === fieldName))

  const handleNext = () => {
    if (currentStep.kind === 'sla') {
      if (!slaAcknowledged) {
        setErrors({ [SLA_ACK]: 'Please review and acknowledge the Service Agreement to continue.' })
        return
      }
      setErrors({})
      setActiveStep(stepIdx + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const data = getValues()
    const found = validate([currentStep.section], data)
    if (found.length) {
      const map: Record<string, string> = {}
      for (const e of found) map[e.name] = e.message
      setErrors(map)
      document.getElementById(found[0].name)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setErrors({})
    setActiveStep(stepIdx + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrev = () => {
    if (stepIdx === 0) {
      onBack()
    } else {
      setErrors({})
      setActiveStep(stepIdx - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const downloadSla = async () => {
    setSlaBusy(true)
    setSlaError(null)
    try {
      await downloadServiceAgreementPdf(planType, getValues())
      setSlaDownloaded(true)
    } catch (err) {
      console.error('Service Agreement generation failed:', err)
      setSlaError('Something went wrong generating the Service Agreement. Please try again.')
    } finally {
      setSlaBusy(false)
    }
  }

  const onSubmit = (data: FormValues) => {
    const found = validate(plan.sections, data)
    if (found.length) {
      const map: Record<string, string> = {}
      for (const e of found) map[e.name] = e.message
      setErrors(map)
      const target = findStepForField(found[0].name)
      if (target !== -1) setActiveStep(target)
      return
    }
    // Service Agreement must be acknowledged before completion.
    if (hasSla(planType) && data[SLA_ACK] !== 'Yes') {
      setErrors({ [SLA_ACK]: 'Please review and acknowledge the Service Agreement to continue.' })
      const slaStep = steps.findIndex((s) => s.kind === 'sla')
      if (slaStep !== -1) setActiveStep(slaStep)
      return
    }
    setErrors({})
    onComplete(data)
  }

  const progressPercent = Math.round(((stepIdx + 1) / steps.length) * 100)

  return (
    <FormProvider {...methods}>
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
        {/* Mobile Header Progress */}
        <div className="mb-6 lg:hidden">
          <button
            onClick={handlePrev}
            className="text-xs font-semibold text-slate-500 hover:text-accent flex items-center gap-1 mb-2"
          >
            ← Back
          </button>
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>{stepTitle(currentStep)}</span>
            <span>{stepIdx + 1} of {steps.length}</span>
          </div>
          <div className="mt-2 h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Large Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Left Panel: Desktop Stepper */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6 sticky top-8">
            <button
              onClick={onBack}
              className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-accent flex items-center gap-1.5 transition-colors"
            >
              ← Change Plan Type
            </button>
            <div className="border-l border-slate-200 pl-4 py-1 space-y-6">
              {steps.map((step, idx) => {
                const isCompleted = idx < stepIdx
                const isActive = idx === stepIdx
                const isSla = step.kind === 'sla'

                return (
                  <div key={`${stepTitle(step)}-${idx}`} className="relative flex items-center gap-3 group">
                    <div
                      className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold border transition-all duration-200 ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                          : isActive
                          ? 'bg-accent border-accent text-white shadow-md shadow-accent/20 ring-4 ring-accent/15'
                          : isSla
                          ? 'bg-white border-accent/40 text-accent'
                          : 'bg-white border-slate-300 text-slate-400 group-hover:border-slate-400'
                      }`}
                    >
                      {isCompleted ? '✓' : isSla ? '§' : idx + 1}
                    </div>
                    <span
                      className={`text-sm font-semibold transition-colors duration-200 ${
                        isActive
                          ? 'text-navy font-bold'
                          : isCompleted
                          ? 'text-slate-500 hover:text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {stepTitle(step)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Plan Setup Mode
              </span>
              <span className="text-xs font-semibold text-navy mt-0.5 block bg-slate-100 rounded-md px-2 py-1.5 w-fit">
                {plan.name}
              </span>
            </div>
          </aside>

          {/* Right Panel: Stepper Content Card */}
          <main className="lg:col-span-3">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
              <div className="animate-fadeIn rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Step {stepIdx + 1} of {steps.length}
                </div>

                {currentStep.kind === 'sla' ? (
                  /* ── Service Agreement: read on screen, click to agree ── */
                  <div>
                    <h2 className="mt-3 text-xl md:text-2xl font-bold text-navy tracking-tight">
                      Your Service Agreement
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                      Before we collect your detailed plan design, please read the Service Agreement below. It is
                      pre-populated with the information you just entered. Read it, then check “I agree” to continue.
                      You can optionally download a copy for your records.
                    </p>

                    {/* Scrollable agreement text */}
                    <div className="mt-5 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-inner">
                      <ServiceAgreementText planType={planType} values={values} />
                    </div>

                    {/* Optional download */}
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={downloadSla}
                        disabled={slaBusy}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-accent hover:text-accent active:scale-95 disabled:opacity-60"
                      >
                        {slaBusy ? 'Generating…' : slaDownloaded ? '↻ Re-download a copy (PDF)' : '⤓ Download a copy (PDF)'}
                      </button>
                      {slaDownloaded && !slaBusy && (
                        <span className="ml-3 text-xs font-semibold text-emerald-600">Downloaded ✓</span>
                      )}
                      {slaError && <p className="mt-2 text-xs font-semibold text-rose-600">{slaError}</p>}
                    </div>

                    {/* Click-to-agree */}
                    <label className={`mt-5 flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      slaAcknowledged ? 'border-accent bg-accent/[0.03] ring-1 ring-accent' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                        checked={slaAcknowledged}
                        onChange={(e) => setValue(SLA_ACK, e.target.checked ? 'Yes' : '')}
                      />
                      <span className="text-sm font-semibold text-slate-700 leading-snug">
                        I have read and agree to the Service Agreement and its fee schedule on behalf of the Plan Sponsor.
                      </span>
                    </label>
                    {errors[SLA_ACK] && (
                      <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
                        <span className="inline-block w-1 h-1 rounded-full bg-rose-600 animate-pulse" />
                        {errors[SLA_ACK]}
                      </p>
                    )}
                  </div>
                ) : (
                  /* ── Standard form section ── */
                  <>
                    <h2 className="mt-3 text-xl md:text-2xl font-bold text-navy tracking-tight">
                      {currentStep.section.title}
                    </h2>
                    {currentStep.section.description && (
                      <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                        {currentStep.section.description}
                      </p>
                    )}

                    <div className="mt-8 space-y-6 border-t border-slate-100 pt-6">
                      {visibleFields.map((field) => (
                        <Field
                          key={field.name}
                          field={field}
                          value={values[field.name] ?? ''}
                          error={errors[field.name]}
                        />
                      ))}
                      {visibleFields.length === 0 && (
                        <p className="text-sm font-medium text-slate-500 italic">
                          No additional options required for this step. Click Next to proceed.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Step Navigation Controls */}
              <div className="flex justify-between items-center gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                >
                  {stepIdx === 0 ? 'Cancel' : '← Back'}
                </button>

                {!isLast ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-accent-600 hover:shadow active:scale-95 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/10 transition-all hover:bg-emerald-600 hover:shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    Review &amp; Download PDF ✓
                  </button>
                )}
              </div>
            </form>
          </main>
        </div>
      </div>
    </FormProvider>
  )
}
