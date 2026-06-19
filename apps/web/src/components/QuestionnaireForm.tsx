import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { PlanType, SectionDef, FormValues } from '@fbsi/shared'
import {
  getPlan,
  indexFields,
  isSectionVisible,
  isVisible,
  validate,
  hasSla,
  downloadServiceAgreementPdf,
} from '@fbsi/shared'
import { ServiceAgreementText } from './ServiceAgreementText'
import { SignaturePad } from './SignaturePad'
import { Field } from './fields/Field'

interface Props {
  planType: PlanType
  /** Known answers from a prior submission, used to pre-fill across sessions. */
  initialValues?: FormValues
  onBack: () => void
  onComplete: (values: FormValues) => void
}

type Step =
  | { kind: 'section'; section: SectionDef }
  | { kind: 'sla' }
  | { kind: 'certify' }

// Field-name keys for the signature/consent/certification gates. These live in the
// same flat FormValues map as the schema fields (and flow through to the PDFs).
const SLA_ACK = 'slaAcknowledged'
const ESIGN_CONSENT = 'esignConsent'
const SIGNER_AUTHORIZED = 'slaSignerAuthorized'
const DATA_CERTIFIED = 'dataCertified'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const now = () => new Date().toISOString()

const stepTitle = (step: Step): string =>
  step.kind === 'sla' ? 'Service Agreement'
  : step.kind === 'certify' ? 'Review & Certify'
  : step.section.title

/** Validate the Service Agreement gate: e-consent + either an authorized e-signature
 *  or delegation to the authorized signer. Returns an error map, or null if valid. */
function validateSla(data: FormValues): Record<string, string> | null {
  const e: Record<string, string> = {}
  if (data[ESIGN_CONSENT] !== 'Yes') {
    e[ESIGN_CONSENT] = 'Please consent to using electronic records and signatures to continue.'
  }
  const auth = data[SIGNER_AUTHORIZED]
  if (auth !== 'Yes' && auth !== 'No') {
    e[SIGNER_AUTHORIZED] = 'Please tell us whether you are authorized to sign on behalf of the Plan Sponsor.'
  } else if (auth === 'Yes') {
    if (!(data.slaSignerName ?? '').trim()) e.slaSignerName = 'Type your full legal name to sign.'
    if (!(data.slaSignatureImage ?? '').trim()) e.slaSignatureImage = 'Add your signature — type or draw it above.'
    if (data[SLA_ACK] !== 'Yes') e[SLA_ACK] = 'Please check the box to sign the Service Agreement.'
  } else {
    if (!(data.slaDelegateName ?? '').trim()) e.slaDelegateName = 'Enter the authorized signer’s name.'
    const email = (data.slaDelegateEmail ?? '').trim()
    if (!email) e.slaDelegateEmail = 'Enter the authorized signer’s email.'
    else if (!EMAIL_RE.test(email)) e.slaDelegateEmail = 'Enter a valid email address.'
    if (data[SLA_ACK] !== 'Yes') e[SLA_ACK] = 'Please confirm to route the Agreement to the authorized signer.'
  }
  return Object.keys(e).length ? e : null
}

/** Validate the final data certification gate. `requireConsent` is true for plans
 *  with no Service Agreement step, where e-consent is captured here instead. */
function validateCertify(data: FormValues, requireConsent: boolean): Record<string, string> | null {
  const e: Record<string, string> = {}
  if (requireConsent && data[ESIGN_CONSENT] !== 'Yes') {
    e[ESIGN_CONSENT] = 'Please consent to using electronic records to continue.'
  }
  if (!(data.dataCertifiedBy ?? '').trim()) e.dataCertifiedBy = 'Type your full name to certify.'
  if (data[DATA_CERTIFIED] !== 'Yes') e[DATA_CERTIFIED] = 'Please check the certification box to continue.'
  return Object.keys(e).length ? e : null
}

// Shared styling + small render helpers for the gate steps.
const checkBoxClass = (active: boolean) =>
  `mt-3 flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
    active ? 'border-accent bg-accent/[0.03] ring-1 ring-accent' : 'border-slate-200 hover:border-slate-300'
  }`
const textInputClass =
  'mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm bg-white text-slate-800 ' +
  'placeholder-slate-400 transition-all focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none hover:border-slate-300'

function ErrLine({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-rose-600 animate-pulse" />
      {msg}
    </p>
  )
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-1.5 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-navy text-right">{value || '—'}</dd>
    </div>
  )
}

export function QuestionnaireForm({ planType, initialValues = {}, onBack, onComplete }: Props) {
  const plan = getPlan(planType)
  // Seed the form with any known answers from a prior submission ("ask once").
  // defaultValues are captured once on mount; the form is remounted per plan pick.
  const methods = useForm<FormValues>({ defaultValues: initialValues, mode: 'onSubmit' })
  const prefilled = Object.keys(initialValues).length > 0
  const { handleSubmit, watch, getValues, setValue, register } = methods
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
    // Final gate for every plan: review the entered data and certify it accurate.
    list.push({ kind: 'certify' })
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
  const consented = values[ESIGN_CONSENT] === 'Yes'
  const signerAuthorized = values[SIGNER_AUTHORIZED]
  const dataCertified = values[DATA_CERTIFIED] === 'Yes'

  const findStepForField = (fieldName: string): number =>
    steps.findIndex((s) => s.kind === 'section' && s.section.fields.some((f) => f.name === fieldName))

  const handleNext = () => {
    if (currentStep.kind === 'sla') {
      const slaErrors = validateSla(getValues())
      if (slaErrors) {
        setErrors(slaErrors)
        return
      }
      setErrors({})
      setActiveStep(stepIdx + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // 'certify' is always the last step, reached via the submit button — never here.
    if (currentStep.kind === 'certify') return

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
    // Service Agreement gate: e-consent + signature or delegation.
    if (hasSla(planType)) {
      const slaErrors = validateSla(data)
      if (slaErrors) {
        setErrors(slaErrors)
        const slaStep = steps.findIndex((s) => s.kind === 'sla')
        if (slaStep !== -1) setActiveStep(slaStep)
        return
      }
    }
    // Final data certification gate (e-consent captured here for non-SLA plans).
    const certErrors = validateCertify(data, !hasSla(planType))
    if (certErrors) {
      setErrors(certErrors)
      const certStep = steps.findIndex((s) => s.kind === 'certify')
      if (certStep !== -1) setActiveStep(certStep)
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
                const isCertify = step.kind === 'certify'

                return (
                  <div key={`${stepTitle(step)}-${idx}`} className="relative flex items-center gap-3 group">
                    <div
                      className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold border transition-all duration-200 ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                          : isActive
                          ? 'bg-accent border-accent text-white shadow-md shadow-accent/20 ring-4 ring-accent/15'
                          : isSla || isCertify
                          ? 'bg-white border-accent/40 text-accent'
                          : 'bg-white border-slate-300 text-slate-400 group-hover:border-slate-400'
                      }`}
                    >
                      {isCompleted ? '✓' : isSla ? '§' : isCertify ? '✓' : idx + 1}
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
                  /* ── Service Agreement: e-consent, read, then sign or delegate ── */
                  <div>
                    <h2 className="mt-3 text-xl md:text-2xl font-bold text-navy tracking-tight">
                      Your Service Agreement
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                      Before we collect your detailed plan design, please review the Service Agreement below — it is
                      pre-populated with the details you just entered. Consent to electronic records, then sign it, or
                      send it to your company’s authorized signer.
                    </p>

                    {/* E-SIGN / UETA electronic-records consent */}
                    <label className={checkBoxClass(consented)}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                        checked={consented}
                        onChange={(e) => {
                          const c = e.target.checked
                          setValue(ESIGN_CONSENT, c ? 'Yes' : '')
                          setValue('esignConsentAt', c ? now() : '')
                        }}
                      />
                      <span className="text-sm font-semibold text-slate-700 leading-snug">
                        I consent to transact electronically, to use electronic signatures, and to receive the Agreement
                        and related disclosures in electronic form (federal E-SIGN Act / UETA).
                      </span>
                    </label>
                    <ErrLine msg={errors[ESIGN_CONSENT]} />

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

                    {/* Authority: who signs? */}
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <p className="text-sm font-bold text-navy">
                        Are you authorized to sign this Agreement on behalf of the Plan Sponsor?
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                        The Agreement must be executed by someone authorized to bind the company (often an officer or
                        Trustee). If that isn’t you, we’ll route it to them — you can still finish onboarding now.
                      </p>
                      <div className="mt-3 flex rounded-xl border border-slate-200/80 p-1 bg-slate-50 w-fit gap-1 shadow-inner">
                        {[
                          { v: 'Yes', label: 'Yes — I’ll sign now' },
                          { v: 'No', label: 'No — send to signer' },
                        ].map((o) => {
                          const sel = signerAuthorized === o.v
                          return (
                            <button
                              type="button"
                              key={o.v}
                              onClick={() => {
                                // Reset the acknowledgment so the signature/confirmation
                                // is made explicitly under the chosen path.
                                setValue(SIGNER_AUTHORIZED, o.v)
                                setValue(SLA_ACK, '')
                                setValue('slaSignedAt', '')
                                setValue('slaSignatureImage', '')
                              }}
                              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                                sel ? 'bg-white shadow text-navy ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {o.label}
                            </button>
                          )
                        })}
                      </div>
                      <ErrLine msg={errors[SIGNER_AUTHORIZED]} />
                    </div>

                    {/* Authorized signer — type-to-sign */}
                    {signerAuthorized === 'Yes' && (
                      <div className="mt-5 space-y-4 animate-fadeIn">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-semibold text-slate-800">
                              Full legal name<span className="ml-1 text-rose-500">*</span>
                            </label>
                            <input className={textInputClass} placeholder="Type your full legal name" {...register('slaSignerName')} />
                            <ErrLine msg={errors.slaSignerName} />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-800">Title</label>
                            <input className={textInputClass} placeholder="e.g. President / Trustee" {...register('slaSignerTitle')} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800">
                            Signature<span className="ml-1 text-rose-500">*</span>
                          </label>
                          <p className="mt-0.5 text-xs text-slate-400">Type your name to generate a signature, or switch to Draw to sign by hand.</p>
                          <div className="mt-2">
                            <SignaturePad
                              value={values.slaSignatureImage ?? ''}
                              onChange={(url) => setValue('slaSignatureImage', url)}
                              typedName={(values.slaSignerName ?? '').trim()}
                            />
                          </div>
                          <ErrLine msg={errors.slaSignatureImage} />
                        </div>
                        <label className={checkBoxClass(slaAcknowledged)}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                            checked={slaAcknowledged}
                            onChange={(e) => {
                              const c = e.target.checked
                              setValue(SLA_ACK, c ? 'Yes' : '')
                              setValue('slaSignedAt', c ? now() : '')
                            }}
                          />
                          <span className="text-sm font-semibold text-slate-700 leading-snug">
                            By signing above and checking this box, I,{' '}
                            <strong className="text-navy">{(values.slaSignerName ?? '').trim() || '…'}</strong>, sign this
                            Service Agreement and its fee schedule on behalf of the Plan Sponsor, and represent that I am
                            authorized to do so.
                          </span>
                        </label>
                        <ErrLine msg={errors[SLA_ACK]} />
                      </div>
                    )}

                    {/* Delegate to authorized signer */}
                    {signerAuthorized === 'No' && (
                      <div className="mt-5 space-y-4 animate-fadeIn">
                        <p className="text-xs text-slate-500 leading-relaxed rounded-lg bg-amber-50 border border-amber-100 p-3">
                          We’ll mark the Service Agreement <strong>pending signature</strong> and route it to the
                          authorized signer named below after you finish. The rest of onboarding continues now.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-semibold text-slate-800">
                              Authorized signer — name<span className="ml-1 text-rose-500">*</span>
                            </label>
                            <input className={textInputClass} placeholder="e.g. Jane Doe" {...register('slaDelegateName')} />
                            <ErrLine msg={errors.slaDelegateName} />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-800">Title</label>
                            <input className={textInputClass} placeholder="e.g. CEO / Trustee" {...register('slaDelegateTitle')} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800">
                            Authorized signer — email<span className="ml-1 text-rose-500">*</span>
                          </label>
                          <input className={textInputClass} type="email" placeholder="name@company.com" {...register('slaDelegateEmail')} />
                          <ErrLine msg={errors.slaDelegateEmail} />
                        </div>
                        <label className={checkBoxClass(slaAcknowledged)}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                            checked={slaAcknowledged}
                            onChange={(e) => setValue(SLA_ACK, e.target.checked ? 'Yes' : '')}
                          />
                          <span className="text-sm font-semibold text-slate-700 leading-snug">
                            I confirm these details are correct and authorize FBSI to send the Service Agreement to the
                            named authorized signer for signature.
                          </span>
                        </label>
                        <ErrLine msg={errors[SLA_ACK]} />
                      </div>
                    )}
                  </div>
                ) : currentStep.kind === 'certify' ? (
                  /* ── Review & certify the entered data ── */
                  <div>
                    <h2 className="mt-3 text-xl md:text-2xl font-bold text-navy tracking-tight">
                      Review &amp; Certify
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                      You’re almost done. Review the key details below — use Back to edit anything — then certify the
                      information is accurate. We’ll generate your onboarding package next.
                    </p>

                    {/* E-consent here only when there was no Service Agreement step */}
                    {!consented && (
                      <>
                        <label className={checkBoxClass(consented)}>
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                            checked={consented}
                            onChange={(e) => {
                              const c = e.target.checked
                              setValue(ESIGN_CONSENT, c ? 'Yes' : '')
                              setValue('esignConsentAt', c ? now() : '')
                            }}
                          />
                          <span className="text-sm font-semibold text-slate-700 leading-snug">
                            I consent to transact electronically and to receive documents in electronic form (federal
                            E-SIGN Act / UETA).
                          </span>
                        </label>
                        <ErrLine msg={errors[ESIGN_CONSENT]} />
                      </>
                    )}

                    {/* Mini summary */}
                    <dl className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-1.5 text-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Summary</p>
                      <SummaryRow label="Plan type" value={plan.name} />
                      <SummaryRow label="Company" value={values.companyName} />
                      <SummaryRow label="Plan name" value={values.planName} />
                      <SummaryRow label="Primary contact" value={values.primaryContactName} />
                      {hasSla(planType) && (
                        <SummaryRow
                          label="Service Agreement"
                          value={
                            slaAcknowledged && signerAuthorized === 'Yes'
                              ? `Signed — ${(values.slaSignerName ?? '').trim() || 'authorized signer'}`
                              : signerAuthorized === 'No'
                              ? `Pending — routed to ${(values.slaDelegateName ?? '').trim() || 'authorized signer'}`
                              : 'Reviewed'
                          }
                        />
                      )}
                    </dl>

                    {/* Certification */}
                    <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800">
                          Your full name<span className="ml-1 text-rose-500">*</span>
                        </label>
                        <input className={textInputClass} placeholder="Type your full name" {...register('dataCertifiedBy')} />
                        <ErrLine msg={errors.dataCertifiedBy} />
                      </div>
                      <label className={checkBoxClass(dataCertified)}>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                          checked={dataCertified}
                          onChange={(e) => {
                            const c = e.target.checked
                            setValue(DATA_CERTIFIED, c ? 'Yes' : '')
                            setValue('dataCertifiedAt', c ? now() : '')
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-700 leading-snug">
                          I certify that the information provided is accurate and complete to the best of my knowledge,
                          and understand FBSI will rely on it to administer the plan (Service Agreement §2.2).
                        </span>
                      </label>
                      <ErrLine msg={errors[DATA_CERTIFIED]} />
                    </div>
                  </div>
                ) : (
                  /* ── Standard form section ── */
                  <>
                    <h2 className="mt-3 text-xl md:text-2xl font-bold text-navy tracking-tight">
                      {currentStep.section.title}
                    </h2>
                    {currentStep.section.party && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        Typically completed by: <span className="text-navy">{currentStep.section.party}</span>
                      </p>
                    )}
                    {currentStep.section.description && (
                      <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                        {currentStep.section.description}
                      </p>
                    )}

                    {prefilled && (
                      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/[0.04] px-4 py-3">
                        <span className="mt-0.5 text-accent text-sm font-bold leading-none">ⓘ</span>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                          Pre-filled from your last submission — review and update anything that changed.
                        </p>
                      </div>
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
                    Complete &amp; Download Package ✓
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
