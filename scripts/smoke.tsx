// Headless smoke test: validation logic + PDF render for each plan type.
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { PLANS } from '../src/schema/plans'
import { validate } from '../src/schema/visibility'
import type { FormValues } from '../src/schema/visibility'
import { QuestionnairePdf } from '../src/pdf/QuestionnairePdf'

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
  employerMatch: 'Yes',
  matchingFormula: '50% on the first 6%',
  matchingFrequency: 'Per Payroll Period',
  matchingHours: 'None (typical)',
  profitSharingOffered: 'No',
  loans: 'Yes',
  refinanceLoans: 'No',
  transfersFromOtherPlan: 'No',
  hardshipDistributions: 'From Employee Deferrals Only (typical)',
  inServiceDistributions: 'No',
  distributionFeesPaidByParticipants: 'Yes',
  forceOutThreshold: 'Less than $1,000 (paid to participant)',
  safeHarbor: 'No',
  adpAcpTestingMethod: 'Prior Year',
}

let failures = 0

for (const plan of PLANS) {
  const hasDesign = plan.sections.some((s) => s.id === 'design')
  const values: FormValues = hasDesign ? { ...base, ...design } : { ...base }

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
