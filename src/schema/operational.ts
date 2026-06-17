import type { SectionDef } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Operational onboarding forms.
//
// Beyond the Plan Design Questionnaire, every plan onboarded onto FBSI's
// recordkeeping platform needs the same operational setup forms (per the
// "New Client Onboarding Checklist"). These are modeled here as additional
// sections that REUSE the shared-core fields already collected (company name,
// EIN, plan name, plan year end, effective date, etc.) — the "ask once"
// principle — and only prompt for what those forms add.
//
// Repeating-row data (additional contacts, trustees, payroll divisions, the
// fund lineup, the employee census) uses the `table` field type.
// ─────────────────────────────────────────────────────────────────────────────

// ── Plan Setup Form (recordkeeper / TRPC) ────────────────────────────────────
// Source: "Plan Setup Form_RK.md". Most identifying fields are already collected
// in the shared core; this section captures the recordkeeper-specific additions.

export const planSetupSection: SectionDef = {
  id: 'planSetup',
  title: 'Plan Setup (Recordkeeper)',
  party: 'Primary / Payroll Contact',
  description:
    'Recordkeeping details required to establish the plan on the platform. Company, EIN, plan name and dates already provided are reused automatically.',
  fields: [
    { name: 'trpcRepName', label: 'TRPC Representative Name (if known)', type: 'text' },
    { name: 'mailingAddressIfDifferent', label: 'U.S. Mailing Address (if different from company address)', type: 'textarea' },
    {
      name: 'newOrExistingPlan', label: 'Is this a New or Existing Plan?', type: 'radio', required: true,
      options: [
        { value: 'New', label: 'New Plan' },
        { value: 'Existing', label: 'Existing Plan (conversion)' },
      ],
    },
    { name: 'custodianTradeAgent', label: 'Custodian / Trade Agent', type: 'text' },
    { name: 'currentPlanAssets', label: 'Current Plan Assets ($)', type: 'text', placeholder: 'e.g. 1,250,000', help: 'Approximate total plan assets — also used to estimate the recordkeeping fee tier.' },
    { name: 'participantsWithBalance', label: 'Participants with a Balance', type: 'text', placeholder: 'e.g. 24' },
    { name: 'irsBusinessCode', label: '6-digit IRS Business Code', type: 'text', placeholder: '000000' },
    // Note: the Three-Digit Form 5500 Plan ID is the Plan Number already collected in
    // Plan Identification — not re-asked here (ask once).

    // Current provider — existing/conversion plans only.
    {
      name: 'currentRecordkeeper', label: 'Current/Existing Investment Recordkeeper (being replaced)', type: 'text',
      showWhen: { field: 'newOrExistingPlan', equals: 'Existing' },
    },
    {
      name: 'currentRkContact', label: 'Current Recordkeeper — Contact Name, Email & Phone', type: 'textarea',
      showWhen: { field: 'newOrExistingPlan', equals: 'Existing' },
    },
    {
      name: 'currentTpaSameAsRk', label: 'Is the current TPA the same company as the current Recordkeeper?', type: 'yesno',
      showWhen: { field: 'newOrExistingPlan', equals: 'Existing' },
    },
    {
      name: 'currentTpa', label: 'Current/Existing TPA (if different)', type: 'text',
      showWhen: { field: 'currentTpaSameAsRk', equals: 'No' },
    },
  ],
}

// ── Master Plan Contacts ─────────────────────────────────────────────────────
// Source: "FBSI Master Contact Setup Form.md" + Plan Setup contact section.
// Consolidated into a single canonical contact/trustee model to avoid asking the
// same people twice across the two source forms.

export const contactsSection: SectionDef = {
  id: 'contacts',
  title: 'Plan Contacts & Roles',
  party: 'Primary / Payroll Contact',
  description:
    'The people FBSI will work with on the plan, and the roles assigned to each. The Primary Plan Contact receives all role notifications by default.',
  fields: [
    { name: 'primaryContactName', label: 'Primary Plan Contact — Name', type: 'text', required: true },
    { name: 'primaryContactEmail', label: 'Primary Plan Contact — Email', type: 'email', required: true },
    { name: 'primaryContactPhone', label: 'Primary Plan Contact — Phone', type: 'tel', required: true },
    { name: 'primaryIsAuthorizedSigner', label: 'Is the Primary Contact an Authorized Signer on behalf of the Employer?', type: 'yesno', required: true },
    {
      name: 'additionalContacts', label: 'Additional Plan Contacts', type: 'table',
      addRowLabel: 'Add Contact',
      help: 'Assign specific roles (e.g., Payroll, Distributions, Loans, Compliance) to other employer representatives.',
      columns: [
        { key: 'name', label: 'Name', flex: 2 },
        { key: 'email', label: 'Email', type: 'email', flex: 3 },
        { key: 'phone', label: 'Phone', type: 'tel', flex: 2 },
        { key: 'roles', label: 'Role(s)', flex: 3, placeholder: 'Payroll, Loans…' },
      ],
    },
    {
      name: 'additionalTrustees', label: 'Additional Plan Trustees (contact details)', type: 'table',
      addRowLabel: 'Add Trustee',
      help: 'Plan Trustee #1 is the trustee named in Plan Identification. Add any additional trustees and their contact details here.',
      columns: [
        { key: 'name', label: 'Trustee Name', flex: 2 },
        { key: 'email', label: 'Email', type: 'email', flex: 3 },
        { key: 'phone', label: 'Phone', type: 'tel', flex: 2 },
      ],
    },
  ],
}

// ── Payroll Data ─────────────────────────────────────────────────────────────
// Source: "FBSI Payroll Data Forms.md".

const PAYROLL_FREQ = [
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Bi-Weekly', label: 'Bi-Weekly' },
  { value: 'Semi-Monthly', label: 'Semi-Monthly' },
  { value: 'Monthly', label: 'Monthly' },
]

export const payrollSection: SectionDef = {
  id: 'payroll',
  title: 'Payroll Data',
  party: 'Primary / Payroll Contact',
  description: 'How payroll is run, so FBSI can format the payroll import and set up ACH funding.',
  fields: [
    { name: 'separateDivisions', label: 'Does the plan provide payroll/funding for separate companies or divisions?', type: 'yesno', required: true },
    {
      name: 'divisions', label: 'Divisions', type: 'table',
      addRowLabel: 'Add Division',
      showWhen: { field: 'separateDivisions', equals: 'Yes' },
      columns: [
        { key: 'name', label: 'Company / Division Name', flex: 3 },
        { key: 'code', label: 'Division Code (6 char max)', flex: 2, placeholder: 'optional' },
      ],
    },
    {
      name: 'divisionFileHandling', label: 'If tracking divisions separately, how will payroll files be uploaded?', type: 'radio',
      showWhen: { field: 'separateDivisions', equals: 'Yes' },
      options: [
        { value: 'Separate file per division', label: 'Each division in a separate payroll file' },
        { value: 'One combined file', label: 'All divisions in one combined payroll file' },
      ],
    },
    { name: 'payrollFrequency', label: 'Payroll Frequency', type: 'radio', required: true, options: PAYROLL_FREQ },
    { name: 'payrollWhenPaid', label: 'When Paid (day of week, or dates for Semi-Monthly/Monthly)', type: 'text', required: true, placeholder: 'e.g. Friday, or 15th & last day' },
    { name: 'firstPayrollDate', label: 'Anticipated date of the first payroll to process with FBSI', type: 'date' },
    // Note: the basic payroll contact (Provider/Contact within your company/Email) is
    // already collected in the questionnaire's Existing Plan section — not re-asked here.

    // ACH authorization (signed authorization is returned separately/offline).
    { name: 'achBankName', label: 'ACH — Bank Name', type: 'text', help: 'Direct debit (ACH) is required to fund regular payroll contributions. A signed authorization will be returned separately. The payroll contact you already provided will receive ACH confirmations unless a different contact is named below.' },
    { name: 'achRoutingNumber', label: 'ACH — Bank Routing Number', type: 'text' },
    { name: 'achAccountNumber', label: 'ACH — Bank Account Number', type: 'text' },
    { name: 'achContactName', label: 'ACH Notification Contact — Name', type: 'text' },
    { name: 'achContactEmail', label: 'ACH Notification Contact — Email', type: 'email' },
  ],
}

// ── Financial Advisor Setup ──────────────────────────────────────────────────
// Source: "FBSI Financial Advisor Setup Form.md".

export const advisorSection: SectionDef = {
  id: 'advisor',
  title: 'Financial Advisor Setup',
  party: 'Financial Advisor',
  description:
    'The advisor’s firm, additional contacts, and how the advisor’s compensation is arranged. The primary advisor is the Financial Advisor (Broker) named in Company Information — not re-asked here.',
  fields: [
    { name: 'advisorFirmName', label: 'Advisor Firm Name', type: 'text', required: true },
    { name: 'advisorFirmAddress', label: 'Advisor Firm Address', type: 'textarea' },
    {
      name: 'additionalAdvisors', label: 'Additional Advisor Contacts', type: 'table',
      addRowLabel: 'Add Advisor Contact',
      columns: [
        { key: 'name', label: 'Name', flex: 2 },
        { key: 'email', label: 'Email', type: 'email', flex: 3 },
        { key: 'phone', label: 'Phone', type: 'tel', flex: 2 },
        { key: 'access', label: 'Web Access / Investment Changes?', flex: 3, placeholder: 'e.g. View only' },
      ],
    },
    {
      name: 'advisorFeeArrangement', label: 'Financial Advisor Fee Arrangement', type: 'radio', required: true,
      options: [
        { value: 'Option 1 — 12b-1 (Broker)', label: 'Option 1 — “Broker”: compensation consists of 12b-1 fees paid by the plan’s funds' },
        { value: 'Option 2 — Fee-Based (advisor invoices)', label: 'Option 2 — “Fee-Based”: the advisor firm calculates and invoices its fee directly' },
        { value: 'Option 3 — Fee-Based (FBSI calculates)', label: 'Option 3 — “Fee-Based”: FBSI calculates the fee each billing period and remits from plan assets' },
      ],
      help: 'Option 1 also requires the Broker of Record details in the Fund Setup section.',
    },
    {
      name: 'advisorBillingPeriod', label: 'Billing Period for the advisory fee', type: 'radio',
      showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' },
      options: [
        { value: 'Semi-Quarterly (default)', label: 'Semi-Quarterly (default)' },
        { value: 'Quarterly', label: 'Quarterly' },
      ],
    },
    { name: 'advisorFlatFee', label: 'Flat Annual Fee ($) — if applicable', type: 'text', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' } },
    { name: 'advisorPerParticipantFee', label: 'Annual Per-Participant Fee ($) — if applicable', type: 'text', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' } },
    { name: 'advisorAssetBasedFee', label: 'Annual Asset-Based Fee (%) — if applicable', type: 'text', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' } },
    { name: 'advisorMinFee', label: 'Minimum Annual Fee ($) — if applicable', type: 'text', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' } },
    {
      name: 'advisorTiered', label: 'Tiered Asset-Based Fee Schedule (optional)', type: 'table',
      addRowLabel: 'Add Tier',
      showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' },
      columns: [
        { key: 'from', label: 'From ($)', flex: 1 },
        { key: 'to', label: 'To ($)', flex: 1 },
        { key: 'pct', label: 'Annual Fee %', flex: 1 },
      ],
    },
    {
      name: 'advisorPaymentMethod', label: 'Advisory fee remitted by', type: 'radio',
      showWhen: { field: 'advisorFeeArrangement', equals: ['Option 2 — Fee-Based (advisor invoices)', 'Option 3 — Fee-Based (FBSI calculates)'] },
      options: [
        { value: 'ACH', label: 'ACH' },
        { value: 'Check', label: 'Check' },
      ],
    },
    {
      name: 'advisorFirstBilling', label: 'First Billing Period (new plan / new to FBSI)', type: 'radio',
      showWhen: { field: 'advisorFeeArrangement', equals: 'Option 3 — Fee-Based (FBSI calculates)' },
      options: [
        { value: 'Begin with current period', label: 'Apply beginning with the billing period of the asset transfer / first contribution' },
        { value: 'Begin next full period', label: 'Apply starting with the first full billing period after the transfer / first contribution' },
      ],
    },
    { name: 'advisorAssetsExcluded', label: 'Assets excluded from the advisory fee (e.g., self-directed brokerage) — if any', type: 'textarea' },
  ],
}

// ── Fund Setup ───────────────────────────────────────────────────────────────
// Source: "FBSI Fund Setup Request Form.md".

export const fundsSection: SectionDef = {
  id: 'funds',
  title: 'Fund Setup',
  party: 'Financial Advisor',
  description: 'The plan’s investment lineup, default fund(s), and (if applicable) Broker of Record.',
  fields: [
    {
      name: 'fundLineup', label: 'Fund Lineup', type: 'table', required: true,
      addRowLabel: 'Add Fund',
      columns: [
        { key: 'ticker', label: 'Ticker', flex: 1 },
        { key: 'fundName', label: 'Fund Name', flex: 3 },
        { key: 'cusip', label: 'CUSIP', flex: 2 },
        { key: 'etf', label: 'ETF? (Yes/No)', flex: 1 },
        { key: 'notes', label: 'Special Requests', flex: 2, placeholder: 'optional' },
      ],
    },
    {
      name: 'defaultFundType', label: 'Default Fund(s) — selection basis', type: 'radio', required: true,
      options: [
        { value: 'Single fund or Model Portfolios', label: 'A single fund (or Model Portfolios)' },
        { value: 'By date of birth', label: 'Multiple funds based on the participant’s date of birth' },
        { value: 'By age', label: 'Multiple funds based on the participant’s age' },
      ],
    },
    {
      name: 'defaultFunds', label: 'Default Fund(s)', type: 'table',
      addRowLabel: 'Add Default Fund',
      help: 'For age/DOB-based defaults, use the From/To columns for the age or date range.',
      columns: [
        { key: 'ticker', label: 'Ticker', flex: 1 },
        { key: 'fundName', label: 'Fund Name', flex: 3 },
        { key: 'cusip', label: 'CUSIP', flex: 2 },
        { key: 'from', label: 'From (age/date)', flex: 1, placeholder: 'optional' },
        { key: 'to', label: 'To (age/date)', flex: 1, placeholder: 'optional' },
      ],
    },
    { name: 'useModelPortfolios', label: 'Will the plan use Model Portfolios?', type: 'yesno' },
    { name: 'modelAutoRebalance', label: 'Should Model Portfolio balances be automatically rebalanced periodically?', type: 'yesno', showWhen: { field: 'useModelPortfolios', equals: 'Yes' } },
    { name: 'modelRebalanceFrequency', label: 'Rebalancing frequency', type: 'text', placeholder: 'e.g. Quarterly', showWhen: { field: 'modelAutoRebalance', equals: 'Yes' } },

    // Broker of Record — only when advisor is paid via 12b-1 (Option 1).
    { name: 'borRegisteredRep', label: 'Broker of Record — Registered Rep Name & Rep #', type: 'text', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 1 — 12b-1 (Broker)' }, help: 'Required when the advisor is compensated via 12b-1 fees.' },
    { name: 'borRepContact', label: 'Broker of Record — Rep Address, Email & Phone', type: 'textarea', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 1 — 12b-1 (Broker)' } },
    { name: 'borDealerName', label: 'Broker of Record — Broker/Dealer Name & NSCC #', type: 'text', showWhen: { field: 'advisorFeeArrangement', equals: 'Option 1 — 12b-1 (Broker)' } },
  ],
}

// ── Automatic Enrollment ─────────────────────────────────────────────────────
// Source: "Auto Enroll Form.md". Shown only when Design Considerations elects
// automatic enrollment (section-level showWhen on `autoEnrollment`).

export const autoEnrollSection: SectionDef = {
  id: 'autoEnroll',
  title: 'Automatic Enrollment',
  party: 'Primary / Payroll Contact',
  description: 'Automatic enrollment settings for the STP auto-enroll job.',
  showWhen: { field: 'autoEnrollment', equals: 'Yes' },
  fields: [
    { name: 'aeEffectiveDate', label: 'Requested Automatic Enrollment Effective Date', type: 'date', required: true },
    {
      name: 'aeContributionType', label: 'Automatic Enrollment option for new employees', type: 'radio', required: true,
      options: [
        { value: 'Pre-tax', label: 'Pre-tax' },
        { value: 'Roth', label: 'Roth' },
      ],
    },
    { name: 'aeInitialDeferralPct', label: 'Initial Deferral %', type: 'text', required: true, placeholder: 'e.g. 3' },
    { name: 'aeDelayDays', label: 'Delay automatic enrollment for ___ days following plan entry', type: 'text', placeholder: 'optional' },
    {
      name: 'aeExclusions', label: 'Exclude employees from Automatic Enrollment whose…', type: 'radio', required: true,
      options: [
        { value: 'No exclusions', label: 'No exclusions' },
        { value: 'Hire date prior to', label: 'Hire date is prior to a date' },
        { value: 'Plan entry date prior to', label: 'Plan entry date is prior to a date' },
      ],
    },
    {
      name: 'aeExclusionDate', label: 'Exclusion cutoff date', type: 'date',
      showWhen: { field: 'aeExclusions', equals: ['Hire date prior to', 'Plan entry date prior to'] },
    },
    { name: 'aeDoNotEnrollIfContributing', label: 'Do not enroll participants who already have contributions in payroll?', type: 'yesno', required: true },
    { name: 'aeComputeEquivalentRates', label: 'Compute equivalent rates for dollar contributions?', type: 'yesno' },
    {
      name: 'aeStpFrequency', label: 'Preferred day for the Auto Enroll (STP) process to run', type: 'radio', required: true, allowOther: true,
      options: [
        { value: 'Monthly — 1st of month', label: 'Monthly — 1st day of the month' },
        { value: 'Quarterly', label: 'Quarterly (01/01, 04/01, 07/01, 10/01)' },
      ],
    },
    {
      name: 'aeReportingFrequency', label: 'Preferred reporting frequency', type: 'radio', allowOther: true,
      options: [
        { value: 'Monthly — 1st of month', label: 'Monthly — 1st day of the month' },
        { value: 'Quarterly', label: 'Quarterly (01/01, 04/01, 07/01, 10/01)' },
      ],
    },
    {
      name: 'aeReportDelivery', label: 'Report delivery method', type: 'radio',
      options: [
        { value: 'Push to Sponsor web', label: 'Push reports to the Sponsor web (all contacts)' },
        { value: 'Email to contact', label: 'Email report to a contact' },
      ],
    },
    { name: 'aeAllowAcceleration', label: 'Allow Automatic Acceleration (auto-increase of deferral %)?', type: 'yesno', required: true },
    { name: 'aeAccelIncreasePct', label: 'Acceleration — Increase %', type: 'text', placeholder: 'e.g. 1', showWhen: { field: 'aeAllowAcceleration', equals: 'Yes' } },
    { name: 'aeAccelMaxPct', label: 'Acceleration — Maximum %', type: 'text', placeholder: 'e.g. 10', showWhen: { field: 'aeAllowAcceleration', equals: 'Yes' } },
    { name: 'aeAccelFrequency', label: 'Acceleration — Frequency', type: 'text', placeholder: 'e.g. Annually', showWhen: { field: 'aeAllowAcceleration', equals: 'Yes' } },
  ],
}

// ── Employee Census ──────────────────────────────────────────────────────────
// Source: "FBSI Census Import.md" — the column format FBSI expects. Clients may
// type rows here or submit the file separately; emails and DOB must be included.

export const censusSection: SectionDef = {
  id: 'census',
  title: 'Employee Census',
  party: 'Primary / Payroll Contact',
  description:
    'Employee data required to set up the plan. You can enter employees here or submit the census file separately — Email Address and Birth Date must be included for every employee.',
  fields: [
    {
      name: 'censusRows', label: 'Employee Census', type: 'table',
      addRowLabel: 'Add Employee',
      columns: [
        { key: 'ssn', label: 'SSN', flex: 2, placeholder: '123-45-6789' },
        { key: 'firstName', label: 'First Name', flex: 2 },
        { key: 'mi', label: 'M.I.', flex: 1 },
        { key: 'lastName', label: 'Last Name', flex: 2 },
        { key: 'address1', label: 'Address Line 1', flex: 3 },
        { key: 'address2', label: 'Address Line 2', flex: 2 },
        { key: 'city', label: 'City', flex: 2 },
        { key: 'state', label: 'State', flex: 1 },
        { key: 'postalCode', label: 'Postal Code', flex: 1 },
        { key: 'birthDate', label: 'Birth Date', flex: 2, placeholder: 'm/d/yyyy' },
        { key: 'hireDate', label: 'Hire Date', flex: 2, placeholder: 'm/d/yyyy' },
        { key: 'termDate', label: 'Term Date', flex: 2, placeholder: 'm/d/yyyy' },
        { key: 'rehireDate', label: 'Rehire Date', flex: 2, placeholder: 'm/d/yyyy' },
        { key: 'email', label: 'Email Address', type: 'email', flex: 3 },
      ],
    },
  ],
}
