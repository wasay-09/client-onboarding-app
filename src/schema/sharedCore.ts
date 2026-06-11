import type { SectionDef } from '../types'

// The 28 fields common to ALL 5 plan types, taken verbatim from the
// "<Plan> Plan Design Questionnaire" forms. Three subsections.

const ENTITY_TYPES = [
  { value: 'Corporation', label: 'Corporation' },
  { value: 'Subchapter S Corp.', label: 'Subchapter S Corp.' },
  { value: 'Sole Proprietorship', label: 'Sole Proprietorship' },
  { value: 'Limited Liability Co.', label: 'Limited Liability Co.' },
  { value: 'Partnership', label: 'Partnership' },
]

export const companySection: SectionDef = {
  id: 'company',
  title: 'Company / Employer Information',
  fields: [
    { name: 'companyName', label: 'Company Name', type: 'text', required: true },
    { name: 'companyAddress', label: 'Company Address', type: 'textarea', required: true },
    { name: 'entityType', label: 'Entity Type', type: 'radio', required: true, options: ENTITY_TYPES },
    { name: 'controlledGroup', label: 'Is the Employer a member of a Controlled Group?', type: 'yesno', required: true },
    { name: 'affiliatedServiceGroup', label: 'Affiliated Service Group?', type: 'yesno', required: true },
    { name: 'ein', label: "Employer's Tax Identification Number (EIN)", type: 'text', required: true, placeholder: '12-3456789' },
    { name: 'dateBusinessCommenced', label: 'Date Business Commenced', type: 'date', required: true },
    { name: 'taxYearEnd', label: "Employer's Tax Year End", type: 'text', required: true, placeholder: 'MM/DD' },
    { name: 'employerEmail', label: "Employer's E-mail Address", type: 'email', required: true },
    { name: 'employerPhone', label: "Employer's Telephone Number", type: 'tel', required: true },
    { name: 'employerFax', label: "Employer's Fax Number", type: 'tel' },
    { name: 'sendBillingsTo', label: 'Send Billings to', type: 'text' },
    { name: 'dayToDayContact', label: 'Day to Day Contact', type: 'text' },
    { name: 'brokerName', label: "Broker's Name", type: 'text' },
    { name: 'brokerPhone', label: "Broker's Telephone Number", type: 'tel' },
    { name: 'brokerEmail', label: "Broker's E-mail Address", type: 'email' },
  ],
}

export const planIdSection: SectionDef = {
  id: 'planId',
  title: 'Plan Identification',
  fields: [
    { name: 'planName', label: 'Plan Name', type: 'text', required: true },
    { name: 'planTrustee', label: 'Plan Trustee', type: 'text', required: true },
    { name: 'planEffectiveDate', label: 'Plan Effective Date', type: 'date', required: true },
    { name: 'planYearEnd', label: 'Plan Year End', type: 'text', required: true, placeholder: 'MM/DD' },
    { name: 'planNumber', label: 'Plan Number (001, 002, etc.)', type: 'text', required: true, placeholder: '001' },
    { name: 'investmentProduct', label: 'Investment Product', type: 'text', required: true },
  ],
}

export const existingPlanSection: SectionDef = {
  id: 'existingPlan',
  title: 'Existing Plan Information',
  fields: [
    { name: 'anotherQualifiedPlan', label: 'Does Company have another qualified plan?', type: 'yesno', required: true },
    {
      name: 'anotherQualifiedPlanType',
      label: 'If yes, what type of qualified plan is it?',
      type: 'text',
      required: true,
      showWhen: { field: 'anotherQualifiedPlan', equals: 'Yes' },
    },
    { name: 'payrollProvider', label: 'Payroll Provider / Contact', type: 'text' },
    { name: 'payrollContactInternal', label: 'Payroll Contact within your Company', type: 'text' },
    { name: 'payrollContactEmail', label: 'Payroll Contact Email', type: 'email' },
    { name: 'priorTpa', label: 'Prior TPA / Recordkeeper', type: 'text' },
  ],
}

export const sharedCoreSections: SectionDef[] = [companySection, planIdSection, existingPlanSection]
