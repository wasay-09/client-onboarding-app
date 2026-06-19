import { useEffect, useState } from 'react'
import type { PlanType, FormValues } from '@fbsi/shared'
import {
  getPlan,
  downloadQuestionnairePdf,
  downloadServiceAgreementPdf,
  downloadOnboardingPackagePdf,
  hasSla,
} from '@fbsi/shared'
import { PlanPicker } from './components/PlanPicker'
import { QuestionnaireForm } from './components/QuestionnaireForm'
import { StaffDashboard } from './components/StaffDashboard'
import { ApiError, createCase, getCase, getLatestCase, openCasePdf } from './api'
import { useAuth, isStaffRole } from './auth-context'

type Step = 'pick' | 'fill' | 'done'

export default function App() {
  const { authEnabled, email, role, signOut } = useAuth()
  const [step, setStep] = useState<Step>('pick')
  const [planType, setPlanType] = useState<PlanType | null>(null)
  const [values, setValues] = useState<FormValues>({})
  // Known answers from the user's most recent case, used to pre-fill a new
  // questionnaire across sessions ("ask once"). Empty when they have no history.
  const [initialValues, setInitialValues] = useState<FormValues>({})
  const [fileName, setFileName] = useState('')
  const [caseId, setCaseId] = useState<string | null>(null)
  // Start "busy" when about to reload a case from the URL, so we don't flash the
  // picker. Lazy init keeps this setState out of the effect body.
  const [busy, setBusy] = useState(() => /case=[\w-]+/.test(window.location.hash))

  // Lightweight hash routing for the internal staff dashboard — no router, mirroring the
  // existing `case=<id>` hash convention. `#staff` shows the dashboard for staff/admin
  // only; the `case=` reload effect below is inert on it (no `case=` to match).
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const showStaff = hash.startsWith('#staff') && isStaffRole(role)

  // Reload a previously submitted case from the API (survives a browser refresh).
  useEffect(() => {
    const match = window.location.hash.match(/case=([\w-]+)/)
    if (!match) return
    getCase(match[1])
      .then((c) => {
        setPlanType(c.planType)
        setValues(c.answers)
        setCaseId(c.id)
        setStep('done')
      })
      .catch(() => {
        window.location.hash = ''
      })
      .finally(() => setBusy(false))
  }, [])

  // Move from plan picker to the form, pre-filling from the user's most recent
  // case so already-collected details aren't re-asked. Best-effort: any failure
  // (offline, no history) just starts with a blank form.
  async function pickPlan(type: PlanType) {
    setBusy(true)
    try {
      const latest = await getLatestCase()
      setInitialValues(latest?.answers ?? {})
    } catch {
      setInitialValues({})
    } finally {
      setBusy(false)
    }
    setPlanType(type)
    setStep('fill')
  }

  async function complete(data: FormValues) {
    if (!planType) return
    setValues(data)
    setBusy(true)
    try {
      // Submit to the API: it re-validates, persists the case, and renders + stores
      // the canonical PDF server-side. The case id goes in the URL so a refresh can
      // reload it. If the API is unreachable, fall back to local generation so the
      // app still works standalone.
      try {
        const created = await createCase(planType, data)
        setCaseId(created.id)
        window.location.hash = `case=${created.id}`
        setFileName('')
      } catch (err) {
        // An auth failure means the session expired — re-prompt sign-in rather than
        // silently producing an un-persisted local PDF. Only fall back to local
        // generation for genuine connectivity errors.
        if (authEnabled && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await signOut()
          return
        }
        console.warn('API unavailable — generating the package locally instead.', err)
        setCaseId(null)
        setFileName(await downloadOnboardingPackagePdf(planType, data))
      }
      setStep('done')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    window.location.hash = ''
    setStep('pick')
    setPlanType(null)
    setValues({})
    setInitialValues({})
    setFileName('')
    setCaseId(null)
  }

  // Service Agreement execution status, for the confirmation screen.
  const saSigned = values.slaAcknowledged === 'Yes' && values.slaSignerAuthorized === 'Yes'
  const saPendingSigner = values.slaSignerAuthorized === 'No' ? (values.slaDelegateName || 'your authorized signer') : null

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      {/* Premium Corporate Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white font-extrabold text-sm shadow-sm tracking-tighter">
              FBSI
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-navy block leading-none">
                Flexible Benefits Systems, Inc.
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                Retirement Plan Onboarding
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-slate-400">
            <span>Client Portal</span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="text-slate-500 bg-slate-100 rounded-full px-2.5 py-1 font-bold">Phase 2</span>
            {isStaffRole(role) && (
              <>
                <span className="h-3 w-px bg-slate-200" />
                <button
                  onClick={() => {
                    window.location.hash = showStaff ? '' : 'staff'
                  }}
                  className={`font-bold transition-colors ${showStaff ? 'text-accent' : 'text-slate-400 hover:text-navy'}`}
                >
                  {showStaff ? 'Portal' : 'Staff'}
                </button>
              </>
            )}
            {authEnabled && email && (
              <>
                <span className="h-3 w-px bg-slate-200" />
                <span className="text-slate-500 max-w-[160px] truncate" title={email}>
                  {email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-slate-400 hover:text-navy font-bold transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {showStaff && <StaffDashboard onExit={() => { window.location.hash = '' }} />}

        {!showStaff && step === 'pick' && <PlanPicker onSelect={pickPlan} />}

        {!showStaff && step === 'fill' && planType && (
          <QuestionnaireForm
            planType={planType}
            initialValues={initialValues}
            onBack={reset}
            onComplete={complete}
          />
        )}

        {!showStaff && step === 'done' && planType && (
          <div className="mx-auto max-w-3xl px-4 py-16 animate-fadeIn">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-8 md:p-12 shadow-lg text-center relative overflow-hidden">
              {/* Background gradient blur */}
              <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-accent/5 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />

              {/* Success Badge */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 text-3xl font-bold shadow-inner border border-emerald-100">
                ✓
              </div>

              <h1 className="mt-6 text-3xl font-extrabold text-navy tracking-tight">
                Onboarding Submitted!
              </h1>
              <p className="mt-3 text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
                Your onboarding package for the <span className="font-bold text-navy">{getPlan(planType).name}</span> has been submitted and saved. It bundles your Service Agreement and onboarding summary behind an execution &amp; certification cover page — download it below.
              </p>

              {/* Download File Detail Cards */}
              <div className="mt-6 flex flex-col gap-2 items-center">
                {fileName && (
                  <div className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm max-w-full">
                    <svg className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">Onboarding Package</span>
                      <span className="truncate max-w-[250px] sm:max-w-[400px] font-bold text-slate-800">{fileName}</span>
                    </div>
                  </div>
                )}
                {hasSla(planType) && (
                  <div className={`inline-flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-sm max-w-full ${saSigned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    <span className="text-base leading-none shrink-0">{saSigned ? '✓' : '⏳'}</span>
                    <div className="text-left">
                      <span className="text-[10px] opacity-70 block">Service Agreement</span>
                      <span className="font-bold">
                        {saSigned
                          ? 'Signed electronically'
                          : `Pending signature — routed to ${saPendingSigner}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Business Process Next Steps */}
              <div className="mt-8 border-t border-slate-100 pt-8 text-left max-w-xl mx-auto">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  What Happens Next in Onboarding:
                </h3>
                <div className="space-y-4">
                  {hasSla(planType) ? (
                    <>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0">1</div>
                        <div>
                          {saSigned ? (
                            <>
                              <span className="text-sm font-bold text-navy block">Service Agreement Signed</span>
                              <span className="text-xs text-slate-400">You signed the Service Agreement electronically. A signed copy is included in your package — no further action needed.</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-navy block">Service Agreement Awaiting Signature</span>
                              <span className="text-xs text-slate-400">We’ll send the Service Agreement to {saPendingSigner} for electronic signature. Onboarding proceeds once it is signed and returned.</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0">2</div>
                        <div>
                          <span className="text-sm font-bold text-navy block">Submit Your Employee Census &amp; Funding</span>
                          <span className="text-xs text-slate-400">Provide the employee census (with email and date of birth for each employee) and the signed ACH authorization so FBSI can fund payroll contributions.</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0">3</div>
                        <div>
                          <span className="text-sm font-bold text-navy block">Initial Onboarding Call</span>
                          <span className="text-xs text-slate-400">We will schedule a call with the Trustee, Primary Contact, and Financial Advisor to confirm payroll, funds, and census setup.</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0">1</div>
                        <div>
                          <span className="text-sm font-bold text-navy block">FBSI Reviews Your Questionnaire</span>
                          <span className="text-xs text-slate-400">FBSI will review your completed questionnaire and reach out with next steps for your {getPlan(planType).name}.</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0">2</div>
                        <div>
                          <span className="text-sm font-bold text-navy block">Service Agreement</span>
                          <span className="text-xs text-slate-400">FBSI will prepare and send a Service Agreement outlining fees and scope of services for your review and signature.</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0">3</div>
                        <div>
                          <span className="text-sm font-bold text-navy block">Initial Onboarding Call</span>
                          <span className="text-xs text-slate-400">We will schedule a call with the Trustee, Primary Contact, and Financial Advisor to kick off payroll and census settings.</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-10 flex flex-wrap justify-center gap-3 border-t border-slate-100 pt-8">
                {caseId ? (
                  <button
                    onClick={() => openCasePdf(caseId)}
                    className="rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-white hover:bg-accent-600 hover:shadow-md hover:shadow-accent/10 active:scale-98 transition-all duration-150 shadow-sm"
                  >
                    Download Package
                  </button>
                ) : (
                  <button
                    onClick={() => downloadOnboardingPackagePdf(planType, values)}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all duration-150 shadow-sm"
                  >
                    Re-download Package
                  </button>
                )}
                <button
                  onClick={() => downloadQuestionnairePdf(planType, values)}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all duration-150 shadow-sm"
                >
                  Summary only
                </button>
                {hasSla(planType) && (
                  <button
                    onClick={() => downloadServiceAgreementPdf(planType, values)}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all duration-150 shadow-sm"
                  >
                    Service Agreement only
                  </button>
                )}
                <button
                  onClick={reset}
                  className="rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-white hover:bg-accent-600 hover:shadow-md hover:shadow-accent/10 active:scale-98 transition-all duration-150 shadow-sm"
                >
                  Start New Questionnaire
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Glassmorphic Loading Overlay */}
      {busy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/25 backdrop-blur-sm transition-all duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 flex flex-col items-center gap-4 text-center max-w-[280px]">
            <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div>
              <span className="text-sm font-bold text-navy block">Compiling Selections</span>
              <span className="text-xs text-slate-400 block mt-0.5">Generating PDF documents…</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
