// Headless smoke test: validation logic + PDF render for each plan type.
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { PLANS, validate, QuestionnairePdf } from '@fbsi/shared'
import type { FormValues } from '@fbsi/shared'

// Minimal valid shared-core data.
const base: FormValues = {
  companyName: 'Acme Widgets LLC',
  companyAddress: '123 Main St, Springfield, IL 62704',
  entityType: 'Limited Liability Co.',
  controlledGroup: 'No',
  affiliatedServiceGroup: 'No',
  ein: '12-3456789',
  dateBusinessCommenced: '2010-05-01',
  taxYearEnd: '12/31',
  employerEmail: 'hr@acme.com',
  employerPhone: '555-123-4567',
  planName: 'Acme Widgets 401(k) Plan',
  planTrustee: 'Jane Doe',
  planEffectiveDate: '2026-01-01',
  planYearEnd: '12/31',
  planNumber: '001',
  investmentProduct: 'Mutual Funds',
  anotherQualifiedPlan: 'No',
}

// 401k/403b design-section required fields.
const design: FormValues = {
  trustees: 'Individuals',
  eligibilityRequirements: '1 year',
  ageRequirements: '21',
  planEntryDates: 'Quarterly',
  recognizePriorEmployerService: 'No',
  vestingSchedule: '3 year cliff',
  yearsForVesting: 'All Years',
  normalRetirementAge: '65',
  modifyDeferralFrequency: 'Monthly',
  oneTimeDeferralOnBonus: 'No',
  allowRoth: 'Yes',
  commenceDeferralsAfterEligible: 'Monthly',
  autoEnrollment: 'No',
  employerMatch: 'Yes',
  matchingFormula: '50% on the first 6%',
  matchingFrequency: 'Per Payroll Period',
  matchingHours: 'None (typical)',
  matchingForfeitureThen: 'Used to Reduce future contributions (typical)',
  profitSharingOffered: 'No',
  loans: 'Yes',
  loanLimitations: 'Minimum loan of $1,000.00 (typical)',
  refinanceLoans: 'No',
  transfersFromOtherPlan: 'No',
  hardshipDistributions: 'From Employee Deferrals Only (typical)',
  inServiceDistributions: 'No',
  distributionFeesPaidByParticipants: 'Yes',
  forceOutThreshold: 'Less than $1,000 (paid to participant)',
  safeHarbor: 'No',
  adpAcpTestingMethod: 'Prior Year',
}

// Required fields contributed by the operational sections, by section id.
const planSetupData: FormValues = { newOrExistingPlan: 'New' }
const contactsData: FormValues = {
  primaryContactName: 'John Smith',
  primaryContactEmail: 'john@acme.com',
  primaryContactPhone: '555-222-3333',
  primaryIsAuthorizedSigner: 'Yes',
}
const payrollData: FormValues = {
  separateDivisions: 'No',
  payrollFrequency: 'Bi-Weekly',
  payrollWhenPaid: 'Friday',
}
const advisorData: FormValues = {
  advisorFirmName: 'Acme Advisors LLC',
  advisorFeeArrangement: 'Option 2 — Fee-Based (advisor invoices)',
}
const fundsData: FormValues = {
  defaultFundType: 'Single fund or Model Portfolios',
  fundLineup: JSON.stringify([
    { ticker: 'VFIAX', fundName: 'Vanguard 500 Index', cusip: '922908710', etf: 'No', notes: '' },
  ]),
}

let failures = 0

for (const plan of PLANS) {
  const has = (id: string) => plan.sections.some((s) => s.id === id)
  const hasDesign = has('design')
  const values: FormValues = {
    ...base,
    ...(hasDesign ? design : {}),
    ...(has('soloConfig') ? { soloValuationType: 'daily' } : {}),
    ...(has('planSetup') ? planSetupData : {}),
    ...(has('contacts') ? contactsData : {}),
    ...(has('payroll') ? payrollData : {}),
    ...(has('advisor') ? advisorData : {}),
    ...(has('funds') ? fundsData : {}),
  }

  // 1) empty data should produce errors; full data should be clean.
  const emptyErrors = validate(plan.sections, {})
  const fullErrors = validate(plan.sections, values)

  // 2) conditional check: matching fields only required when employerMatch=Yes.
  let condOk = true
  if (hasDesign) {
    const noMatch = validate(plan.sections, { ...values, employerMatch: 'No', matchingFormula: '', matchingFrequency: '', matchingHours: '' })
    condOk = noMatch.length === 0 // hidden conditionals shouldn't error
  }

  // 3) PDF renders without throwing.
  let pdfOk = true
  let pdfBytes = 0
  try {
    const buf = await renderToBuffer(createElement(QuestionnairePdf, { planType: plan.type, values }))
    pdfBytes = buf.length
  } catch (e) {
    pdfOk = false
    console.error(`  PDF render error for ${plan.type}:`, (e as Error).message)
  }

  const ok = emptyErrors.length > 0 && fullErrors.length === 0 && condOk && pdfOk && pdfBytes > 1000
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${plan.short.padEnd(11)} ` +
    `emptyErrors=${emptyErrors.length} fullErrors=${fullErrors.length} ` +
    `cond=${condOk} pdf=${pdfOk}(${pdfBytes}b)` +
    (fullErrors.length ? ` -> ${fullErrors.map((e) => e.name).join(',')}` : '')
  )
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
