import type { SectionDef } from '../types'

// "Design Considerations" — present ONLY on the 401(k) and 403(b) questionnaires.
// Faithful to the source form; conditional groups gated via showWhen.

const FREQ = [
  { value: 'Any Pay Period', label: 'Any Pay Period' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Semi-Annually', label: 'Semi-Annually' },
]

const HOURS = [
  { value: 'None (typical)', label: 'None (typical)' },
  { value: '1 / 501 (Standardized)', label: '1 / 501 (Standardized)' },
  { value: '1000 / will not share (Non-Standard)', label: '1000 / will not share (Non-Standard)' },
]

const FORFEITURE_THEN = [
  { value: 'Used to Reduce future contributions (typical)', label: 'Used to Reduce future contributions (typical)' },
  { value: 'Reallocated to eligible participants', label: 'Reallocated to eligible participants' },
]

export const designSection: SectionDef = {
  id: 'design',
  title: 'Design Considerations',
  description: 'Plan design elections (401(k) and 403(b) plans only).',
  fields: [
    // --- Eligibility & vesting ---
    {
      name: 'trustees', label: 'Who will be the Trustee(s) of the Plan?', type: 'radio', required: true,
      options: [
        { value: 'Individuals', label: 'Individuals' },
        { value: 'Corporate', label: 'Corporate' },
      ],
    },
    {
      name: 'eligibilityRequirements', label: 'Eligibility Requirements (service)', type: 'radio', required: true, allowOther: true,
      options: [
        { value: '3 months', label: '3 months' },
        { value: '6 months', label: '6 months' },
        { value: '1 year', label: '1 year' },
      ],
    },
    {
      name: 'ageRequirements', label: 'Age Requirements', type: 'radio', required: true, allowOther: true,
      options: [
        { value: 'No Age', label: 'No Age' },
        { value: '18', label: '18' },
        { value: '19', label: '19' },
        { value: '20', label: '20' },
        { value: '21', label: '21' },
      ],
    },
    {
      name: 'planEntryDates', label: 'Plan Entry Dates', type: 'radio', required: true, allowOther: true,
      options: [
        { value: 'Date of Event', label: 'Date of Event' },
        { value: 'Monthly', label: 'Monthly' },
        { value: 'Quarterly', label: 'Quarterly' },
        { value: 'Semi-Annual', label: 'Semi-Annual' },
      ],
    },
    { name: 'immediatelyEligibleOnEffectiveDate', label: 'Immediately Eligible if Employed on the Effective Date (New Plans Only)', type: 'yesno' },
    { name: 'recognizePriorEmployerService', label: 'Recognize Service with a Prior Employer?', type: 'yesno', required: true },
    {
      name: 'vestingSchedule', label: 'Vesting Schedule for Employer Money', type: 'radio', required: true, allowOther: true,
      options: [
        { value: '100% Immediate', label: '100% Immediate' },
        { value: '6 year graded (2/20%)', label: '6 year graded (2/20%)' },
        { value: '3 year cliff', label: '3 year cliff' },
      ],
    },
    {
      name: 'yearsForVesting', label: 'Years for Vesting', type: 'radio', required: true,
      options: [
        { value: 'All Years', label: 'All Years' },
        { value: 'Only Years from the Effective Date of the Plan', label: 'Only Years from the Effective Date of the Plan' },
      ],
    },
    {
      name: 'normalRetirementAge', label: 'Normal Retirement Age', type: 'radio', required: true, allowOther: true,
      options: [{ value: '65', label: '65' }],
    },

    // --- Deferrals ---
    { name: 'modifyDeferralFrequency', label: 'Modifications to Salary Deferral %', type: 'radio', required: true, allowOther: true, options: FREQ },
    { name: 'oneTimeDeferralOnBonus', label: 'Allow Special One-Time Deferral Elections on Bonus Compensation?', type: 'yesno', required: true },
    { name: 'allowRoth', label: 'Allow for Roth 401(k)?', type: 'yesno', required: true },
    { name: 'commenceDeferralsAfterEligible', label: 'Commence Deferrals after eligible', type: 'radio', required: true, allowOther: true, options: FREQ },
    // Auto-enrollment election. When "Yes", the dedicated Automatic Enrollment section
    // (operational.ts) is shown so the client can configure the STP auto-enroll job.
    { name: 'autoEnrollment', label: 'Will the Plan include Automatic Enrollment?', type: 'yesno', required: true, help: 'If yes, you will complete an Automatic Enrollment setup section later in this flow.' },

    // --- Employer match (conditional) ---
    { name: 'employerMatch', label: 'Shall there be an Employer Match?', type: 'yesno', required: true },
    { name: 'matchingFormula', label: 'Employer Matching Formula', type: 'text', required: true, placeholder: '50% on the first 6%', showWhen: { field: 'employerMatch', equals: 'Yes' } },
    { name: 'matchingFrequency', label: 'Frequency that Matching will be paid in', type: 'radio', required: true, allowOther: true, showWhen: { field: 'employerMatch', equals: 'Yes' },
      options: [
        { value: 'Per Payroll Period', label: 'Per Payroll Period' },
        { value: 'Monthly', label: 'Monthly' },
        { value: 'Annually', label: 'Annually' },
      ],
    },
    { name: 'matchingHours', label: 'Hours required to share in Matching', type: 'radio', required: true, options: HOURS, showWhen: { field: 'employerMatch', equals: 'Yes' } },
    { name: 'matchingForfeitureAdminFirst', label: 'Forfeitures from Matching — use to pay Administrative Expenses FIRST?', type: 'yesno', showWhen: { field: 'employerMatch', equals: 'Yes' } },
    { name: 'matchingForfeitureThen', label: 'Forfeitures from Matching — THEN', type: 'radio', required: true, options: FORFEITURE_THEN, showWhen: { field: 'employerMatch', equals: 'Yes' } },

    // --- Profit sharing (conditional) ---
    { name: 'profitSharingOffered', label: 'Will the Plan include a Profit Sharing Contribution?', type: 'yesno', required: true },
    { name: 'profitSharingBasis', label: 'Profit Sharing Contribution basis', type: 'radio', required: true, showWhen: { field: 'profitSharingOffered', equals: 'Yes' },
      options: [
        { value: 'Compensation / Total Compensation (typical)', label: 'Compensation / Total Compensation (typical)' },
        { value: 'Integrated with Social Security', label: 'Integrated with Social Security' },
        { value: 'Cross Tested Profit Sharing', label: 'Cross Tested Profit Sharing' },
      ],
    },
    { name: 'profitSharingPctTWB', label: '% of Taxable Wage Base', type: 'text', placeholder: 'e.g. 5.7%', showWhen: { field: 'profitSharingBasis', equals: 'Integrated with Social Security' } },
    { name: 'profitSharingHours', label: 'Hours required to share in Profit Sharing', type: 'radio', options: HOURS, showWhen: { field: 'profitSharingOffered', equals: 'Yes' } },
    { name: 'profitSharingForfeitureAdminFirst', label: 'Forfeitures from Profit Sharing — use to pay Administrative Expenses FIRST?', type: 'yesno', showWhen: { field: 'profitSharingOffered', equals: 'Yes' } },
    { name: 'profitSharingForfeitureThen', label: 'Forfeitures from Profit Sharing — THEN', type: 'radio', required: true, options: FORFEITURE_THEN, showWhen: { field: 'profitSharingOffered', equals: 'Yes' } },
    { name: 'profitSharingCompensation', label: 'Compensation counted', type: 'radio', showWhen: { field: 'profitSharingOffered', equals: 'Yes' },
      options: [
        { value: 'From Date of Participation Only (typical)', label: 'From Date of Participation Only (typical)' },
        { value: 'For entire Plan Year', label: 'For entire Plan Year' },
      ],
    },

    // --- Loans & distributions ---
    { name: 'loans', label: 'Loans to Participants?', type: 'yesno', required: true },
    { name: 'refinanceLoans', label: 'Refinance Loans?', type: 'yesno', required: true },
    { name: 'loanLimitations', label: 'Limitations on Loans', type: 'radio', required: true, showWhen: { field: 'loans', equals: 'Yes' },
      options: [
        { value: 'For Hardship reasons only', label: 'For Hardship reasons only' },
        { value: 'Minimum loan of $1,000.00 (typical)', label: 'Minimum loan of $1,000.00 (typical)' },
      ],
    },
    { name: 'transfersFromOtherPlan', label: 'Transfers from other Qualified Plan?', type: 'yesno', required: true },
    { name: 'hardshipDistributions', label: 'Hardship Distributions', type: 'radio', required: true,
      options: [
        { value: 'From Employee Deferrals Only (typical)', label: 'From Employee Deferrals Only (typical)' },
        { value: 'From Any 100% Vested Account', label: 'From Any 100% Vested Account' },
      ],
    },
    { name: 'inServiceDistributions', label: 'In-Service Distributions?', type: 'yesno', required: true },
    { name: 'inServiceAge', label: 'In-Service Distribution Age', type: 'text', placeholder: '59 ½ (typical)', showWhen: { field: 'inServiceDistributions', equals: 'Yes' } },
    { name: 'distributionFeesPaidByParticipants', label: 'Distribution Fees Paid by Participants?', type: 'yesno', required: true },
    { name: 'forceOutThreshold', label: 'Threshold for Force Outs', type: 'radio', required: true,
      options: [
        { value: 'Less than $1,000 (paid to participant)', label: 'Less than $1,000 (paid to participant)' },
        { value: '$1,000 to $5,000 Forced to an IRA', label: '$1,000 to $5,000 Forced to an IRA' },
      ],
    },

    // --- Safe harbor (conditional) ---
    { name: 'safeHarbor', label: 'Safe Harbor 401(k) Plan?', type: 'yesno', required: true },
    { name: 'adpAcpTestingMethod', label: 'ADP/ACP Testing Method (if NOT a Safe Harbor Plan)', type: 'radio', showWhen: { field: 'safeHarbor', equals: 'No' },
      options: [
        { value: 'Prior Year', label: 'Prior Year' },
        { value: 'Current Year', label: 'Current Year' },
      ],
    },
    { name: 'safeHarborType', label: 'Contribution used to meet Safe Harbor', type: 'radio', required: true, showWhen: { field: 'safeHarbor', equals: 'Yes' },
      options: [
        { value: '3% Safe Harbor Non-Elective (typical)', label: '3% Safe Harbor Non-Elective (typical)' },
        { value: 'Safe Harbor Matching Formula', label: 'Safe Harbor Matching Formula' },
      ],
    },
    { name: 'safeHarborMatchFormula', label: 'Safe Harbor Matching Formula', type: 'radio', required: true, showWhen: { field: 'safeHarborType', equals: 'Safe Harbor Matching Formula' },
      options: [
        { value: '100% on the first 4%', label: '100% on the first 4%' },
        { value: '100% on the first 3% and 50% on the next 2%', label: '100% on the first 3% and 50% on the next 2%' },
      ],
    },

    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
}
