import type { PlanType } from '../types'
import type { FormValues } from '../schema/visibility'

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the Service Agreement.
// Both the on-screen click-wrap (ServiceAgreementText.tsx) and the downloadable
// PDF (ServiceAgreementPdf.tsx) render from the data here, so they cannot drift.
// ─────────────────────────────────────────────────────────────────────────────

export type SlaTemplate = 'standard' | 'solo-rk' | 'solo-annual'

/** Plan types for which a Service Agreement can be generated. */
export const SLA_PLAN_TYPES: PlanType[] = ['401k', '403b', 'solo401k']
export const hasSla = (t: PlanType) => SLA_PLAN_TYPES.includes(t)

export function selectSlaTemplate(planType: PlanType, values: FormValues): SlaTemplate {
  if (planType === 'solo401k') {
    return values.soloValuationType === 'annual' ? 'solo-annual' : 'solo-rk'
  }
  return 'standard'
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Human-readable UTC timestamp for audit lines, e.g. "June 17, 2026 at 14:32 UTC". */
export function formatTimestamp(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${hh}:${mm} UTC`
}

export function parseSlaDate(iso: string): { day: string; month: string; year: string } {
  if (!iso) return { day: '____', month: '____________', year: '____' }
  const parts = iso.split('-')
  if (parts.length !== 3) return { day: '____', month: '____________', year: '____' }
  const [y, m, d] = parts
  const monthName = MONTHS[parseInt(m, 10) - 1] ?? '____________'
  return { day: String(parseInt(d, 10)), month: monthName, year: y }
}

// ─── Derived scalar fees + labels (RK templates) ──────────────────────────────

export interface SlaFees {
  isRkTemplate: boolean
  serviceDescription: string
  templateLabel: string
  annualAdmin: string
  perParticipant: string
  planDocFee: string
  restateFee: string
}

export function getSlaFees(template: SlaTemplate): SlaFees {
  const isRkTemplate = template === 'standard' || template === 'solo-rk'
  return {
    isRkTemplate,
    serviceDescription: isRkTemplate
      ? 'recordkeeping and related third party administrative services'
      : 'related third party administrative services',
    templateLabel:
      template === 'standard' ? 'Recordkeeping & TPA'
      : template === 'solo-rk' ? 'Solo 401(k) — Daily Valued (RK & TPA)'
      : 'Solo 401(k) — Annual Balance Forward',
    annualAdmin: template === 'standard' ? '$1,300.00' : '$250.00',
    perParticipant: template === 'standard' ? '$45.00' : '$0.00',
    // Standard (401k/403b) plan document fees differ from Solo RK — source: 2026 Service Agreement RK TPA (7).md
    planDocFee: template === 'standard' ? '$995.00' : '$500.00',
    restateFee: template === 'standard' ? '$995.00' : '$500.00',
  }
}

/** Concise fee highlights for the at-a-glance summary on the agreement screen. */
export function feeHighlights(template: SlaTemplate): Array<{ label: string; value: string }> {
  if (template === 'solo-annual') {
    return [
      { label: 'Annual Administrative Fee', value: '$250.00' },
      { label: 'Annual 5500 Filing Fee (if needed)', value: '$350.00' },
      { label: 'Plan Document One-Time Fee (new plan)', value: '$500.00' },
    ]
  }
  if (template === 'solo-rk') {
    return [
      { label: 'Annual Administrative Fee', value: '$250.00' },
      { label: 'Per-Participant Annual Fee', value: '$0.00' },
      { label: 'Plan Document One-Time Fee (new plan)', value: '$500.00' },
      { label: 'Daily Recordkeeping Fee', value: '0.30% – 0.12% (tiered)' },
    ]
  }
  return [
    { label: 'Annual Administrative Fee', value: '$1,300.00' },
    { label: 'Per-Participant Annual Fee', value: '$45.00' },
    { label: 'Plan Document One-Time Fee (new plan)', value: '$995.00' },
    { label: 'Daily Recordkeeping Fee', value: '0.30% – 0.12% (tiered)' },
  ]
}

// ─── Article content (shared legal body) ──────────────────────────────────────

export interface ArticleSection {
  num: string
  title: string
  body: string
  address?: string[]
}

export interface Article {
  num: string
  title: string
  secs: ArticleSection[]
}

export const ARTICLES: Article[] = [
  {
    num: 'I', title: 'Services',
    secs: [
      { num: '1.1', title: 'Services', body: 'FBSI shall perform the services stated in Exhibit A to this Agreement (the "Services"). All compliance and regulatory matters and any matters related to the Plan that are not specifically stated in Exhibit A, are the responsibility of the Plan Sponsor.' },
      { num: '1.2', title: 'Services Limitations', body: 'Plan Sponsor acknowledges and agrees that FBSI only provides the Services and the Services do not include any legal, accounting or tax advice. In addition, Plan Sponsor acknowledges and agrees that FBSI does not provide investment advice, for a fee or otherwise, to any person including Plan Sponsor, the Plan, or the Plan\'s participants and beneficiaries.' },
    ],
  },
  {
    num: 'II', title: 'Data and Information',
    secs: [
      { num: '2.1', title: 'Data and Information Disclosures', body: 'FBSI will from time to time, request certain data and information from the Plan Sponsor, which is necessary to enable FBSI to perform its duties. All such requested data and information, whether requested orally or in writing, or by electronic means, shall be provided in a timely fashion, in the nature, format, content, timing and appearance as requested by FBSI.' },
      { num: '2.2', title: 'Reliance on Plan Sponsor Data and Information', body: 'The Plan Sponsor agrees that the data and information provided will be provided timely and will be accurate in all respects and that FBSI may rely fully upon such data and information as being accurate and that FBSI has no obligation to inquire as the correctness or accuracy of the data or information provided. The Plan Sponsor acknowledges and agrees that in the event that the data and Information is not timely provided, or is inaccurate or incomplete, it is impossible for FBSI to provide the Services in a timely and accurate manner. Plan Sponsor acknowledges that inaccurate data and information and/or late data and information may result in penalties and possibly disqualification of the Plan for tax purposes.' },
    ],
  },
  {
    num: 'III', title: 'Information Privacy',
    secs: [
      { num: '3.1', title: 'Confidentiality', body: 'FBSI and the Plan Sponsor agree that all Plan data and information is confidential. The Plan Sponsor, and its employees, agents and authorized representatives, agree to use all commercially reasonable methods to safeguard the confidentiality of any data and information transmitted to FBSI, including, without limitation, any transmissions by electronic means, and electronically by means of the Internet, and to comply with such requirements as may be established from time to time by FBSI regarding the transmission of such data and information, including the use of secure portals and/or the transmission of data and information by means other than the internet, as determined by FBSI. FBSI agrees to take all commercially reasonable steps to secure the Plan Sponsor\'s Plan data.' },
      { num: '3.2', title: 'Use of Data and Information', body: 'FBSI agrees that it will not: (a) use any non-public personal information, regardless of the source of the data and information, for any purpose other than those related to the Services; (b) sell, sublicense, or resell nonpublic personal information to any third party; (c) use the non-public personal information for any unlawful purpose; or (d) use the non-public personal information for any purpose that would violate the terms of this Agreement.' },
    ],
  },
  {
    num: 'IV', title: 'Payment of Fees for Services',
    secs: [
      { num: '4.1', title: 'Payment of Fees for Services', body: 'FBSI shall be entitled to the Fees stated in Exhibit A, which shall be computed in accordance with the Fee Schedule stated in Exhibit A. FBSI reserves the right to amend the Fee Schedule from time to time with reasonable notice to the Plan Sponsor. The Plan Sponsor acknowledges that it has reviewed the attached Fee Schedule and in its fiduciary capacity to the Plan, or otherwise has determined that all Fees for the Services provided by FBSI that are paid for by the Plan are reasonable expenses for administration and recordkeeping of the Plan. The fees shall be paid as indicated in Exhibit A, unless otherwise agreed upon in writing. The Plan Sponsor and the Plan fiduciaries may authorize the Plan to pay the Fees directly. In the event that any Fee hereunder is not paid by the Plan, the Plan Sponsor agrees to pay such fee in accordance with the terms of this Agreement.' },
      { num: '4.2', title: 'Timing and Method of Payment', body: 'All Fees will be paid within fifteen (15) days after the date of the invoice. To the extent that any Fees are paid directly by the Plan, such fee payments will, reasonably comply with this time requirement and Plan Sponsor agrees to ensure that such payments are made in a timely fashion. In the event that any Fee is unpaid after the date it is due by more than thirty (30) days, FBSI may charge interest at the rate of ten percent (10%), on such amount unpaid and due. In the event that Fees remain unpaid for more than ninety (90) days, FBSI may at its option, terminate this agreement immediately, without advanced notice to the Plan or the Plan Sponsor.' },
      { num: '4.3', title: 'Disclosure of Compensation', body: 'FBSI agrees to notify the Plan Sponsor, at least annually, of any compensation received, either direct or indirect, in an amount that exceeds $1,000, to the extent that such fee is paid by any source other than the Plan Sponsor. Such disclosures will reasonably comply with the obligations of a covered service provider under Section 408(b)(2) of the Employee Retirement Income Security Act, as amended ("ERISA").' },
    ],
  },
  {
    num: 'V', title: 'Fiduciary Responsibility, Plan Authority and Control',
    secs: [
      { num: '5.1', title: 'Fiduciary Identification', body: 'The Plan Sponsor agrees to identify for FBSI the Plan\'s named fiduciary and all other fiduciaries, including the Plan administrator and investment fiduciaries, including such fiduciary\'s name, address, telephone and electronic mail address and the role or authority of such fiduciary. All such communications regarding the fiduciaries will be in writing. In the event of a change in the identify of any fiduciary of the Plan, the Plan Sponsor will provide Notice to FBSI immediately of such change.' },
      { num: '5.2', title: 'Fiduciary Authority', body: 'The Plan Sponsor agrees that the fiduciary or fiduciaries identified in the above Section 5.1 have sole and exclusive discretionary authority and control over the assets and administration of the Plan and that FBSI and its officers, employees and agents have no discretionary authority, control or responsibility over the Plan or over the investment, disposition or administration of Plan assets. The Plan Sponsor acknowledges and agrees that FBSI and its officers, employees and agents are not a Plan "fiduciary" or "investment manager" or "Administrator" of the Plan, as those terms are defined in Section 3 of ERISA. The Plan Sponsor further agrees that no person or entity and no fiduciary shall take any actions or require any actions which might, as determined exclusively by FBSI, result in the classification of FBSI, or any of its officers, employees or agents as a fiduciary of the Plan for any purpose.' },
    ],
  },
  {
    num: 'VI', title: 'Limitation of Liability',
    secs: [
      { num: '6.1', title: 'Liability in General', body: 'FBSI shall only be liable for actual damages, up to the applicable limits stated herein, and only those solely and directly caused by the acts or omissions of FBSI and its employees, agents and affiliates, which constitute gross negligence. In the event that Plan Sponsor has any claim to assert against FBSI, Plan Sponsor must notify FBSI, in writing, within sixty (60) days of any act or omission for which it believes that FBSI has responsibility. FBSI shall be liable only for direct damages caused by any act or omission determined grossly negligent, and in no event shall FBSI be liable for any indirect, special, incidental or consequential damages, or any other damages, interest, taxes, fines or penalties, or investment losses suffered or incurred by the Plan Sponsor, the Plan, the Plan fiduciaries, or any participants and/or beneficiaries, or any other party in interest or any other party. Any liability of FBSI under this Agreement shall be limited to an amount equal to five (5) times the annual fee paid to FBSI for the year in which the alleged gross negligence occurs. In the event of a claim by anyone, including the Plan Sponsor, the Plan, the Plan fiduciaries, participants or beneficiaries, party in interest, or any other person or entity against FBSI, for which FBSI is not grossly negligent, the Plan Sponsor shall fully indemnify FBSI for any and all costs, expense, damages and its attorney\'s fees. FBSI shall not be liable for any acts or omissions with respect to the Plan, which were committed prior to the date of this Agreement.' },
      { num: '6.2', title: 'Plan Sponsor Responsibilities', body: 'Plan Sponsor agrees and FBSI assumes no responsibility for, any liability whatsoever, for any damage or consequence that result from the failure of Plan Sponsor or the Plan Sponsor\'s representative to provide timely and accurate data and information to FBSI, including specifically, any damage of any type or nature, whatsoever, including any tax, interest, penalty or fines incurred by the Plan Sponsor or the Plan participants or beneficiaries. Plan Sponsor is responsible, and FBSI is not responsible for any Plan compliance or other services outside the scope of the Services. Plan Sponsor agrees that it is responsible for all Plan legal compliance, accounting, and related professional services, including without limitation, the tax-qualified legal compliance regarding the plan documentation, amendments, the determination of controlled and affiliated services groups, determination of participating employers and related matters not specifically stated in the Services. Plan Sponsor acknowledges and agrees that it is responsible for all Plan contributions and that FBSI has no responsibility regarding the contributions to the Plan, whatsoever.' },
      { num: '6.3', title: 'Plan Document Services', body: 'Sponsor acknowledges and agrees that with respect to plan document services, FBSI provides sample forms and sample plan documentation and related determination letter filing as stated in Exhibit A. In the event that the Plan Sponsor utilizes the FBSI plan document services the Plan Sponsor may not add, delete, or modify the plan documents in any way without the prior written consent of FBSI. Plan Sponsor acknowledges and agrees that to the extent any additions, deletions, or modifications are made to any of the plan documents provided, without the written consent of FBSI, the Employer shall not be afforded any protections under this Agreement regarding the Services, including, without limitations, any Liability for loss hereunder. Plan Sponsor expressly acknowledges and agrees that the plan document services are for the convenience of the Plan Sponsor and that Plan Sponsor will have such documents reviewed and approved by its legal counsel as it deems appropriate, but in no event shall FBSI be responsible for the legal compliance of the plan documents for the Plan. Plan sponsor further agrees that in no event will the Plan Sponsor file a determination letter application with the Internal Revenue Service with respect to the Plan on Form 5300 (or successor thereto) as a custom plan document, unless specifically authorized by FBSI.' },
      { num: '6.4', title: 'Dispute Resolution', body: 'In the event that there is any dispute between Plan Sponsor and FBSI with respect to the terms of or the performance under this Agreement, both Plan Sponsor and FBSI and agree to cooperate and act in good faith. In the event of a claim by any other party, person or entity that refers or relates to this Agreement that includes FBSI, the Plan Sponsor and FBSI may agree to tender the defense of the case to the other and enter into a joint defense agreement, or other agreements as determined appropriate under the circumstances.' },
      { num: '6.5', title: 'Use of Third Parties', body: 'FBSI is not liable or responsible for the conduct of any third parties retained by the Plan, the Plan Sponsor, the Plan fiduciaries, parties-in-interest or any other person or entity providing services to the Plan, including any service providers recommended by FBSI, or arranged through FBSI, including third party actuarial, custodial, trustee or any similar types of services.' },
      { num: '6.6', title: 'Force Majeure', body: 'FBSI will not be liable or responsible in any way for any delays or failures in performance resulting from acts beyond reasonable control including without limitation, act of God, natural disasters, equipment malfunctions and extraordinary trading volume on any stock exchange that disrupts trading on the exchange.' },
    ],
  },
  {
    num: 'VII', title: 'Amendment and Assignment',
    secs: [
      { num: '7.1', title: 'Amendment', body: 'FBSI reserves the right to amend this Agreement at any time, for any reason, by notifying the Plan Sponsor, in writing, at least thirty (30) days prior to the effective date of such the amendment. Unless Plan Sponsor objects in writing to the proposed amendment to the Agreement before the date on which the amendment becomes effective, Plan Sponsor will be deemed to have agreed to the proposed amendment. If Plan Sponsor objects and gives written Notice under this Agreement before the proposed amendment becomes effective, Plan Sponsor will have sixty (60) days from the date of its written Notice of its objection to the proposed amendment within which to reach a new agreement with FBSI, or FBSI may terminate this Agreement within thirty (30) days following the effective date of the proposed amendment.' },
      { num: '7.2', title: 'Assignment', body: 'FBSI may assign this Agreement at any time, and the Plan Sponsor may assign this agreement with the written consent of FBSI.' },
    ],
  },
  {
    num: 'VIII', title: 'Term of Agreement',
    secs: [
      { num: '8.1', title: 'Term', body: 'This Agreement is effective for a full year from the Effective date and continues in effect until it is terminated under this Section VIII or Sections 4.2 and 7.1, by written Notice by either FBSI or the Plan Sponsor. In the event there is no Notice of termination, this Agreement will automatically renew for an additional year, unless it is amended in accordance with Section 7.1. This Agreement may be terminated at any time by either party with ninety (90) days advanced written Notice, except as provided in Sections 4.2 and 7.1.' },
      { num: '8.2', title: 'Fees on Termination', body: 'In the event of termination of the Agreement for any reason, all Fees payable to FBSI through the date of Termination will be paid in accordance with the terms of Section 4.2. FBSI reserves the right to require advanced payment of Fees in the event that the Agreement is to be terminated, in order to secure payment of the Fees in connection with a termination of this Agreement.' },
    ],
  },
  {
    num: 'IX', title: 'Notices',
    secs: [
      {
        num: '9.1', title: 'Notice',
        body: 'Any time a Notice is required under this Agreement, all Notices shall be addressed to the respective party to this Agreement as stated in this Section, unless either party has provided Notice to the other, in writing. Notices by electronic mail are acceptable under this Agreement, but are not deemed effective unless such electronic mail Notice is specifically acknowledged by the recipient. The Notice information is as follows:',
        address: ['Flexible Benefit Services, Inc.', '5521 Mayfield Rd.', 'Lyndhurst, OH  44124'],
      },
    ],
  },
  {
    num: 'X', title: 'Miscellaneous Terms',
    secs: [
      { num: '10.1', title: 'Disclosures of Fees Under ERISA', body: 'The Plan Sponsor and FBSI agree that the Agreement and Exhibit A provides complete disclosures regarding the Services and the compensation received by FBSI and that the Agreement terms serve to provide the full disclosures required to satisfy the requirements of ERISA Sections 408(b)(2) and 404(a)(5).' },
      { num: '10.2', title: 'Authorization', body: 'The Plan Sponsor acknowledges and represents that: (a) it is authorized to enter into this Agreement on behalf of the Plan; (b) each person who executes the Agreement has the authority to act on behalf of the Plan Sponsor and the Plan in connection with the adoption and approval of this Agreement; (c) all Plan expenses, excluding any expense related to Plan establishment, designed or termination, constitute a joint and several liability of the Plan and the Plan Sponsor until paid; and (d) the Plan\'s retained ERISA Section 3(21) investment advisor or ERISA Section 3(38) investment manager and any other retained financial professional or registered investment advisor, or Plan fiduciaries may view all records maintained by FBSI with respect to the Plan, and that Plan Sponsor will provide Notice to FBSI of the identity of such persons or entities, and shall keep FBSI apprised of any changes to such information.' },
      { num: '10.3', title: 'Complete Agreement', body: 'This Agreement supersedes all written and oral agreements, communications or negotiations among the parties and it constitutes the complete and full understanding and agreement of the parties with regard to the services to be provided pursuant to this Agreement, subject to any amendment to this Agreement undertaken pursuant to Section 7.1.' },
      { num: '10.4', title: 'No Third Party Rights', body: 'The parties agree that the Plan is a party to this Agreement. None of the provisions of this Agreement shall be for the benefit of, or enforceable by, any person, other than the Plan, the Plan Sponsor or FBSI, including, without limitation, any third party, fiduciary, party-in-interest, participant or any beneficiary of the Plan.' },
      { num: '10.5', title: 'Counterparts', body: 'This Agreement may be executed in any number of counterparts, each of which shall be deemed to be an original, but all counterparts, together, constitute only one Agreement.' },
      { num: '10.6', title: 'No Waiver', body: 'No waiver by any party of any failure or refusal to comply with an obligation hereunder shall be deemed a waiver of any other subsequent failure or refusal to comply with such term.' },
      { num: '10.7', title: 'Successors and Assigns', body: 'Subject to Section 7.2, this Agreement shall inure to the benefit of and shall be binding upon the successors and assigns.' },
      { num: '10.8', title: 'Enforceability, Jurisdiction and Arbitration', body: 'Each term and provision of the Agreement shall be valid and enforceable to the fullest extent permitted by law. If any term or provision of the Agreement shall to any extent be invalid or unenforceable, the remainder of the Agreement, other than any part that is held to be invalid or unenforceable, shall continue to be binding and effective. The laws of the State of Ohio shall govern this Agreement, except to the extent such laws are superseded by ERISA. Any claim, dispute, controversy or matter arising under or related to this Agreement shall be settled by arbitration in Cuyahoga County, Ohio, in accordance with the Commercial Arbitration Rules of the American Arbitration Association, and judgment upon the award rendered by the arbitrator(s) is final and binding and may be entered and enforced in any court having jurisdiction in Cuyahoga County, Ohio as the final binding determination of such dispute.' },
      { num: '10.9', title: 'Survival', body: 'The provisions in Sections 1.1, 1.2, 2.2, 4.1-4.3, 5.1, 6.1-6.4, 8.1, 8.2, 9.1, and 10.8 shall survive the termination of this Agreement for the period of the applicable statute of limitations under Ohio law, and all other terms of this Agreement may be used and applied in connection with the enforcement of such terms of this Agreement after its termination in order to enforce the Sections that survive hereunder.' },
    ],
  },
]

// ─── Recordkeeping fee tiers (shared by standard and solo-rk) ─────────────────

export const RK_TIERS = [
  { from: '$0', to: '$500,000', rate: '0.30%' },
  { from: '$500,001', to: '$1,000,000', rate: '0.27%' },
  { from: '$1,000,001', to: '$3,000,000', rate: '0.24%' },
  { from: '$3,000,001', to: '$5,000,000', rate: '0.21%' },
  { from: '$5,000,001', to: '$7,500,000', rate: '0.18%' },
  { from: '$7,500,001', to: '$10,000,000', rate: '0.15%' },
  { from: '$10,000,001', to: '& Above', rate: '0.12%' },
]

// ─── Exhibit B expense grid rows ─────────────────────────────────────────────

export const EXPENSE_ROWS: Array<{ label: string; sub?: boolean }> = [
  { label: 'Initial Plan Document' },
  { label: 'Restated document or amendments' },
  { label: 'Advisor fee' },
  { label: 'TPA charges' },
  { label: 'Base fee', sub: true },
  { label: 'Per participant charge', sub: true },
  { label: 'Recordkeeping charges' },
  { label: 'Base fee', sub: true },
  { label: 'Per participant charge', sub: true },
  { label: 'Trading fees exclusive of brokerage accounts' },
  { label: 'Distributions including any ACH wire fees' },
  { label: 'Termination', sub: true },
  { label: 'Retirement', sub: true },
  { label: 'Hardship', sub: true },
  { label: 'Loan', sub: true },
  { label: 'Required minimum', sub: true },
  { label: 'In-service', sub: true },
  { label: 'Qualified domestic relations order', sub: true },
  { label: 'ACH/Wire (direct pass-through)' },
  { label: 'Plan Termination Charges' },
  { label: 'Service Termination Charges' },
  { label: 'IRS, DOL Audits' },
  { label: 'Services as Requested' },
]
