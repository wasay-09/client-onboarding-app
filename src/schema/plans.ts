import type { PlanType, SectionDef } from '../types'
import { sharedCoreSections } from './sharedCore'
import { designSection } from './designConsiderations'

export interface PlanMeta {
  type: PlanType
  name: string
  short: string
  blurb: string
  sections: SectionDef[]
}

// The shared core is used by every plan. Only 401(k) and 403(b) add the
// Design Considerations section.
const withDesign = [...sharedCoreSections, designSection]
const coreOnly = [...sharedCoreSections]

export const PLANS: PlanMeta[] = [
  { type: '401k', name: '401(k) Plan', short: '401(k)', blurb: 'Employer-sponsored defined-contribution plan with full design options.', sections: withDesign },
  { type: '403b', name: '403(b) Plan', short: '403(b)', blurb: 'For nonprofits, schools, and certain tax-exempt employers.', sections: withDesign },
  { type: '457b', name: '457(b) Plan', short: '457(b)', blurb: 'Deferred compensation plan for governmental and certain nonprofit employers.', sections: coreOnly },
  { type: 'simpleira', name: 'SIMPLE IRA Plan', short: 'SIMPLE IRA', blurb: 'Simplified plan for small employers.', sections: coreOnly },
  { type: 'solo401k', name: 'Solo 401(k) Plan', short: 'Solo 401(k)', blurb: 'For owner-only businesses with no full-time employees.', sections: coreOnly },
]

export const getPlan = (type: PlanType): PlanMeta =>
  PLANS.find((p) => p.type === type)!
