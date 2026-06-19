import type { PlanType, SectionDef } from '../types'
import { companySection, planIdSection, existingPlanSection } from './sharedCore'
import { designSection } from './designConsiderations'
import { soloSection } from './solo'
import {
  planSetupSection,
  contactsSection,
  payrollSection,
  advisorSection,
  fundsSection,
  autoEnrollSection,
  censusSection,
} from './operational'

export interface PlanMeta {
  type: PlanType
  name: string
  short: string
  blurb: string
  sections: SectionDef[]
  /**
   * Id of the section after which the Service Agreement review/sign step is shown.
   * The agreement is presented BEFORE the detailed questionnaire — after the
   * identifying info needed to pre-populate it has been collected. Undefined for
   * plan types that have no Service Agreement (457(b), SIMPLE IRA).
   */
  slaAfterSectionId?: string
}

// Shared identity collected first (and reused to pre-populate the Service Agreement).
const identity = [companySection, planIdSection]

// Operational onboarding forms for plans hosted on FBSI's recordkeeping platform.
const fullOperational = [
  planSetupSection,
  contactsSection,
  payrollSection,
  advisorSection,
  fundsSection,
  autoEnrollSection, // section-level showWhen: autoEnrollment === 'Yes'
  censusSection,
]

// Solo plans are owner-only: no census, no payroll divisions, no auto-enrollment.
const soloOperational = [planSetupSection, contactsSection, advisorSection, fundsSection]

export const PLANS: PlanMeta[] = [
  {
    type: '401k', name: '401(k) Plan', short: '401(k)',
    blurb: 'Employer-sponsored defined-contribution plan with full design options.',
    sections: [...identity, existingPlanSection, designSection, ...fullOperational],
    slaAfterSectionId: 'planId',
  },
  {
    type: '403b', name: '403(b) Plan', short: '403(b)',
    blurb: 'For nonprofits, schools, and certain tax-exempt employers.',
    sections: [...identity, existingPlanSection, designSection, ...fullOperational],
    slaAfterSectionId: 'planId',
  },
  {
    type: '457b', name: '457(b) Plan', short: '457(b)',
    blurb: 'Deferred compensation plan for governmental and certain nonprofit employers.',
    sections: [...identity, existingPlanSection, contactsSection],
  },
  {
    type: 'simpleira', name: 'SIMPLE IRA Plan', short: 'SIMPLE IRA',
    blurb: 'Simplified plan for small employers.',
    sections: [...identity, existingPlanSection, contactsSection],
  },
  {
    type: 'solo401k', name: 'Solo 401(k) Plan', short: 'Solo 401(k)',
    blurb: 'For owner-only businesses with no full-time employees.',
    sections: [...identity, soloSection, existingPlanSection, ...soloOperational],
    slaAfterSectionId: 'soloConfig',
  },
]

export const getPlan = (type: PlanType): PlanMeta =>
  PLANS.find((p) => p.type === type)!
