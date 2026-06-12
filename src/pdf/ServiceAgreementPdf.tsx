import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PlanType } from '../types'
import type { FormValues } from '../schema/visibility'
import {
  ARTICLES, RK_TIERS, EXPENSE_ROWS,
  getSlaFees, parseSlaDate, selectSlaTemplate,
} from './serviceAgreementContent'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    paddingTop: 48, paddingBottom: 60, paddingHorizontal: 48,
    fontSize: 9, color: '#0f172a', fontFamily: 'Helvetica', lineHeight: 1.55,
  },
  header: { marginBottom: 18, borderBottom: '2 solid #030D28', paddingBottom: 10 },
  brand: { fontSize: 9, color: '#3B6FF5', fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#030D28', marginTop: 4 },
  docSub: { fontSize: 9, color: '#475569', marginTop: 3 },
  preamble: { marginBottom: 14, padding: 10, backgroundColor: '#f8fafc', borderLeft: '3 solid #3B6FF5' },
  preambleText: { fontSize: 9, lineHeight: 1.65 },
  bold: { fontFamily: 'Helvetica-Bold' },
  articleTitle: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#030D28',
    marginTop: 14, marginBottom: 6, backgroundColor: '#EEF2FB', padding: 5,
  },
  secRow: { flexDirection: 'row', marginBottom: 7 },
  secNum: { width: 34, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#030D28', flexShrink: 0 },
  secContent: { flex: 1 },
  secTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  secBody: { fontSize: 9, lineHeight: 1.55 },
  addressBlock: { marginTop: 6, marginLeft: 0, fontSize: 9, lineHeight: 1.5 },
  bulletRow: { flexDirection: 'row', marginBottom: 3, marginLeft: 8 },
  bulletDot: { width: 10, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9, lineHeight: 1.45 },
  subBulletRow: { flexDirection: 'row', marginBottom: 2, marginLeft: 20 },
  sigBlock: { marginTop: 22 },
  sigRow: { marginBottom: 20 },
  sigLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  sigLineRow: { flexDirection: 'row', gap: 20, marginBottom: 6 },
  sigLineGroup: { flex: 1 },
  sigLineCap: { fontSize: 8, color: '#64748b', marginBottom: 2 },
  sigLineValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', minHeight: 14, borderBottom: '0.5 solid #0f172a', paddingBottom: 2 },
  sigLineBlank: { minHeight: 14, borderBottom: '0.5 solid #0f172a' },
  exhibitDivider: {
    marginTop: 24, marginBottom: 16,
    borderTop: '2 solid #030D28', paddingTop: 10,
  },
  exhibitTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#030D28', marginBottom: 4 },
  exhibitSub: { fontSize: 9, color: '#475569', marginBottom: 10 },
  feeGroup: { marginBottom: 12 },
  feeGroupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#030D28', marginBottom: 4, borderBottom: '0.5 solid #94a3b8', paddingBottom: 2 },
  feeRow: { flexDirection: 'row', paddingVertical: 2, borderBottom: '0.3 solid #e2e8f0' },
  feeIndent: { width: 16 },
  feeLabel: { flex: 1, fontSize: 8, color: '#374151' },
  feeValue: { width: 72, textAlign: 'right', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  rkTierTable: { marginBottom: 8 },
  rkTierHeaderRow: { flexDirection: 'row', backgroundColor: '#030D28', paddingVertical: 3, paddingHorizontal: 4, marginBottom: 1 },
  rkTierHeaderCell: { flex: 1, color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  rkTierRow: { flexDirection: 'row', paddingVertical: 2, borderBottom: '0.3 solid #e2e8f0' },
  rkTierCell: { flex: 1, fontSize: 8, textAlign: 'center', color: '#374151' },
  note: { fontSize: 8, color: '#475569', marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' },
  expenseGrid: { marginTop: 10 },
  expenseHeaderRow: { flexDirection: 'row', backgroundColor: '#030D28', paddingVertical: 3, paddingHorizontal: 4, marginBottom: 1 },
  expenseHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },
  expenseHeaderLabel: { flex: 2 },
  expenseHeaderCol: { flex: 1, textAlign: 'center' },
  expenseRow: { flexDirection: 'row', paddingVertical: 3, borderBottom: '0.3 solid #e2e8f0' },
  expenseLabel: { flex: 2, fontSize: 8, color: '#374151' },
  expenseCol: { flex: 1, fontSize: 8, textAlign: 'center', color: '#64748b' },
  expenseSubRow: { flexDirection: 'row', paddingVertical: 2, borderBottom: '0.3 solid #f1f5f9' },
  expenseSubLabel: { flex: 2, fontSize: 8, color: '#374151', paddingLeft: 12 },
  expenseSubCol: { flex: 1, fontSize: 8, textAlign: 'center', color: '#64748b' },
  serviceSection: { marginTop: 10, marginBottom: 8 },
  serviceSectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#030D28', marginBottom: 6, borderBottom: '0.5 solid #94a3b8', paddingBottom: 2 },
  serviceGroupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4, marginTop: 8 },
  additionalServices: { fontSize: 9, lineHeight: 1.5, marginTop: 6 },
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    fontSize: 8, color: '#94a3b8',
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '0.5 solid #e2e8f0', paddingTop: 6,
  },
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function Bullet({ text }: { text: string }) {
  return (
    <View style={S.bulletRow}>
      <Text style={S.bulletDot}>{'•'}</Text>
      <Text style={S.bulletText}>{text}</Text>
    </View>
  )
}

function SignatureLine({ cap, value }: { cap: string; value?: string }) {
  return (
    <View style={S.sigLineGroup}>
      <Text style={S.sigLineCap}>{cap}</Text>
      {value
        ? <Text style={S.sigLineValue}>{value}</Text>
        : <View style={S.sigLineBlank} />
      }
    </View>
  )
}

function SignatureBlock({ label, trustee }: { label: string; trustee?: string }) {
  return (
    <View style={S.sigRow}>
      <Text style={S.sigLabel}>{label}</Text>
      <View style={S.sigLineRow}>
        <SignatureLine cap="(Print)" value={trustee} />
        <SignatureLine cap="Signature" />
        <SignatureLine cap="Date" />
      </View>
    </View>
  )
}

function RkFeeSection({
  annualAdmin, perParticipant, planDocFee, restateFee,
}: {
  annualAdmin: string; perParticipant: string; planDocFee: string; restateFee: string
}) {
  return (
    <>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Initial Plan Set-Up Costs</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Installation &amp; Set Up</Text><Text style={S.feeValue}>$0.00</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Plan Document Services</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Document One Time Fee (charged at event if new plan)</Text><Text style={S.feeValue}>{planDocFee}</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Amendment – Employer Initiation (charged at event)</Text><Text style={S.feeValue}>$125.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Restatement – Government Initiation (charged at event)</Text><Text style={S.feeValue}>{restateFee}</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Plan Administrative Services</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual Administrative Fee</Text><Text style={S.feeValue}>{annualAdmin}</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Per Participant Annual Administration Fee</Text><Text style={S.feeValue}>{perParticipant}</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Daily Valuation Annual Recordkeeping Fee</Text>
        <Text style={S.note}>
          The daily recordkeeping fee is based on total plan assets. The fee will be deducted from the plan assets on a monthly
          basis unless otherwise arranged. The fee is based on the graded criteria shown below.
        </Text>
        <View style={S.rkTierTable}>
          <View style={S.rkTierHeaderRow}>
            <Text style={[S.rkTierHeaderCell, { flex: 2 }]}>Plan Assets: From</Text>
            <Text style={[S.rkTierHeaderCell, { flex: 2 }]}>To</Text>
            <Text style={S.rkTierHeaderCell}>RK Fee</Text>
          </View>
          {RK_TIERS.map((t) => (
            <View key={t.from} style={S.rkTierRow}>
              <Text style={[S.rkTierCell, { flex: 2, textAlign: 'left', paddingLeft: 4 }]}>{t.from}</Text>
              <Text style={[S.rkTierCell, { flex: 2, textAlign: 'left', paddingLeft: 4 }]}>{t.to}</Text>
              <Text style={S.rkTierCell}>{t.rate}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Investment Custodian Fees</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual Custodial Fee</Text><Text style={S.feeValue}>0.05%</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Direct charges such as ACH fees, wire fees, any direct expenses charged by the fund</Text><Text style={S.feeValue}></Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Participant Withdrawal Services (if applicable)</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Participant Distribution – Death / Disability / Retirement</Text><Text style={S.feeValue}>$85.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Hardship Distribution</Text><Text style={S.feeValue}>$85.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>In-Service Distribution</Text><Text style={S.feeValue}>$85.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Qualified Domestic Relations Order</Text><Text style={S.feeValue}>$300.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Participant Loan Establishment</Text><Text style={S.feeValue}>$150.00</Text></View>
        <Text style={S.note}>The participant withdrawal services are charged directly to the participant at event of the requested withdrawal.</Text>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Miscellaneous Fees</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>408(b)(2) &amp; 404(a)(5) Compliance Annually</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual Fiduciary Packet</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>IRS Audit (if plan is audited)</Text><Text style={S.feeValue}>$500.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Termination Fee / Deconversion Fee</Text><Text style={S.feeValue}>$1,000.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Certified Trust Statement (If required for audit purposes)</Text><Text style={S.feeValue}>$1,000.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>ETF Fee (if used in fund lineup)</Text><Text style={S.feeValue}>0.15%</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Additional Elected Services</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Investment Plus (PIP) Annual</Text><Text style={S.feeValue}>$125.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Individual Brokerage Account Window (per account/per year)</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Payroll Remittance performed by FBSI</Text><Text style={S.feeValue}>$10/pay</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Gap Analysis Plan Level</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>AdvicePlus Gap Analysis Tool Annually</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Per Participant Charge Annually</Text><Text style={S.feeValue}>$5.00</Text></View>
        <Text style={S.note}>All 12b-1 and Sub-TA fees are credited back to the plan upon receipt in a fee only arrangement. Mid Atlantic Trust Company retains 10% for collecting the fee. The remaining 90% of the fees are credited back to the plan.</Text>
      </View>
    </>
  )
}

function SoloAnnualFeeSection() {
  return (
    <>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Initial Plan Set-Up Costs</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Installation &amp; Set Up</Text><Text style={S.feeValue}>$0.00</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Plan Document Services</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Document One Time Fee (charged at event if new plan)</Text><Text style={S.feeValue}>$500.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Amendment – Employer Initiation (charged at event)</Text><Text style={S.feeValue}>$100.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Plan Restatement – Government Initiation (charged at event)</Text><Text style={S.feeValue}>$500.00</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Plan Administrative Services</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual Administrative Fee</Text><Text style={S.feeValue}>$250.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual 5500 Filing Fee (if needed)</Text><Text style={S.feeValue}>$350.00</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Investment Custodian Fees (if applicable)</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual Custodial Fee</Text><Text style={S.feeValue}>N/A</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Direct charges such as ACH fees, wire fees, any direct expenses charged by the fund</Text><Text style={S.feeValue}></Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Participant Withdrawal Services (if applicable)</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Participant Distribution – Death / Disability / Retirement</Text><Text style={S.feeValue}>$100.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Hardship Distribution</Text><Text style={S.feeValue}>$100.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>In-Service Distribution</Text><Text style={S.feeValue}>$100.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Qualified Domestic Relations Order</Text><Text style={S.feeValue}>$300.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Participant Loan Establishment</Text><Text style={S.feeValue}>$150.00</Text></View>
        <Text style={S.note}>The participant withdrawal services are charged directly to the participant at event of the requested withdrawal.</Text>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Miscellaneous Fees</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>408(b)(2) &amp; 404(a)(5) Compliance Annually</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Annual Fiduciary Packet</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>IRS Audit (if plan is audited)</Text><Text style={S.feeValue}>$500.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Termination Fee / Deconversion Fee</Text><Text style={S.feeValue}>$1,000.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Certified Trust Statement (If required for audit purposes)</Text><Text style={S.feeValue}>$1,000.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>ETF Fee (if used in fund lineup)</Text><Text style={S.feeValue}>0.15%</Text></View>
      </View>
      <View style={S.feeGroup}>
        <Text style={S.feeGroupTitle}>Additional Elected Services</Text>
        <View style={S.feeRow}><Text style={S.feeLabel}>Individual Brokerage Account Window (per account/per year)</Text><Text style={S.feeValue}>$150.00</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Payroll Remittance performed by FBSI</Text><Text style={S.feeValue}>$10/pay</Text></View>
        <View style={S.feeRow}><Text style={S.feeLabel}>Gap Analysis Plan Level</Text><Text style={S.feeValue}>$150.00</Text></View>
        <Text style={S.note}>Any compensation paid by American Funds as TPA compensation will be deducted from total annual fees.</Text>
      </View>
    </>
  )
}

function RecordkeepingServices() {
  return (
    <View style={S.serviceSection}>
      <Text style={S.serviceSectionTitle}>Recordkeeping Services</Text>
      <Text style={S.secBody}>
        The following is a list of recordkeeping services to be provided by FBSI. These services shall be provided solely for the Plan under this Agreement. The services listed are comprehensive and may not apply in every plan situation. Some services may apply that are not listed below.
      </Text>
      <Text style={S.serviceGroupTitle}>I.  Installation</Text>
      <Bullet text="An Administration/Conversion Manual to facilitate transactions relating to the recordkeeping Plan" />
      <Bullet text="Establishment of the Plan and Participant Accounts on Recordkeeping system" />
      <Text style={S.serviceGroupTitle}>II.  Ongoing Recordkeeping</Text>
      <Bullet text="Access to the plan sponsor website to facilitate the transmission of participant and contribution information. Processing and allocating payroll deductions, Plan Sponsor contributions and rollover contributions to participants' accounts via the plan sponsor website. Processing name, address and other data changes submitted via the plan sponsor website." />
      <Bullet text="Daily Valuation of participant accounts" />
      <Bullet text="Daily reconciliation of account activity" />
      <Bullet text="Personal rate of return via participant website" />
      <Bullet text="Rebalance allocations quarterly, if elected by participant" />
      <Bullet text="Daily cash reconciliation" />
      <Bullet text="Field daily inquiries for enrollment, allocation changes, fund transfers, website questions, distributions, loan processing, and general retirement questions." />
      <Bullet text="Production of Quarterly Participant Statements, Transaction Confirmations, and Quarterly Plan Sponsor Reports" />
      <Bullet text="A website accessible to Plan Participants to review account information and execute transactions." />
      <Bullet text="Tracking of participant vested percentages" />
      <Bullet text="Tracking of amounts eligible for participant loans and/or hardship withdrawals" />
      <Bullet text="Processing participant withdrawals, including applicable federal withholding and mandatory state withholding, preparation of Form 1099-R, and withholding tax remittance and reporting." />
      <Bullet text="Processing of loan distributions and repayments" />
      <Bullet text="Processing of QDRO Distributions" />
    </View>
  )
}

function AdministrativeServices() {
  return (
    <View style={S.serviceSection}>
      <Text style={S.serviceSectionTitle}>Administrative Services</Text>
      <Text style={S.secBody}>
        The following is a list of additional plan administrative services to be provided by FBSI. None of the services can be relied on to detect error, fraud, or other illegal acts that may exist. However, we will inform you of any material errors that come to our attention and any fraud or other illegal acts that come to our attention, unless they are clearly inconsequential. These services shall be provided solely for the Plan under this Agreement. The services listed are comprehensive and may not apply in every plan situation.
      </Text>
      <Text style={S.serviceGroupTitle}>I.  Installation Services</Text>
      <Bullet text="Review and consultation of existing plan administration documents" />
      <Bullet text="Review and consultation of current plan design" />
      <Bullet text="Review and consultation of new plan design illustrations and subsequent versions" />
      <Bullet text="Assistance in completion of investment provider paperwork" />
      <Bullet text="De-Conversion manual and assistance in communication to previous investment, recordkeeping, and administration providers" />
      <Bullet text="Assistance in collection of administration documents from previous TPA" />
      <Bullet text="Assistance in transfer of assets and conversion of participant accounts" />
      <Bullet text="Transfer of assets assumes a singular cash transfer and liquidation report provided in an Excel format." />
      <Text style={S.serviceGroupTitle}>II.  Document Services</Text>
      <Bullet text="Assistance in the interpretation of current Plan Document" />
      <Bullet text="Preparation of plan document with Certificate of Resolution, Preparation of Summary Plan Description and related participant disclosures" />
      <Bullet text="Preparation of required regulatory amendments" />
      <Bullet text="Plan amendments" />
      <Bullet text="Preparation of Safe Harbor Notice" />
      <Text style={S.serviceGroupTitle}>III.  Annual Plan Services</Text>
      <Bullet text="Preparation of IRS Form 5500 Series and Schedules including Summary Annual Report" />
      <Bullet text="Testing for compliance with corresponding IRS Code Sections: 404 Deductibility Limitation, 410(b) Coverage, 401(a)(4) Coverage, 415 Annual Additions Limitation, 416 Top Heavy, 414(q) HCE determination, 401(k)/401(m) ADP/ACP, 402(g) Elective Deferral Limitation" />
      <Text style={S.serviceGroupTitle}>IV.  Allocation Services</Text>
      <Bullet text="Calculation of safe harbor and non-safe harbor allocations" />
      <Bullet text="Calculation of allocations satisfied by 401(a)(4) on a contribution or benefits basis" />
      <Bullet text="Coordination with Plan Sponsor in preliminary 401(a)(4) allocation for year-end allocation planning" />
      <Bullet text="Calculation of Plan Sponsor Matching Contribution" />
      <Text style={S.serviceGroupTitle}>V.  Distribution Services</Text>
      <Bullet text="Assistance in review and completion of investment provider distribution paperwork" />
      <Bullet text="Assistance in communication with plan participant" />
      <Bullet text="Assistance in verifying available participant assets for distribution" />
      <Bullet text="Assistance in calculating and/or verifying participant vested account balances" />
      <Bullet text="Assistance in determining available participant loan amount" />
      <Bullet text="Assistance in preparation of participant loan note and amortization schedule" />
      <Bullet text="Annual participant loan administration" />
      <Text style={S.serviceGroupTitle}>VI.  Consulting and Optional Miscellaneous Services</Text>
      <Bullet text="Annual balance forward valuation, recordkeeping and participant statements" />
      <Bullet text="Reconciliation of brokerage accounts outside of service provider platform" />
      <Bullet text="Reconciliation of multiple custodial accounts" />
      <Bullet text="Completion of Form 1099-R, Annual Form 945 and participant notices and elections required to be furnished under IRS regulations" />
      <Bullet text="Assistance in the review of Qualified Domestic Relation Orders (QDRO's)" />
      <Bullet text="Coordination with Certified Public Accountant when annual audited financial statements are required" />
      <Text style={S.serviceGroupTitle}>VII.  Additional Services</Text>
      <Text style={S.additionalServices}>
        Additional professional services requested by the Plan Sponsor, including, but not limited to, such services as specific regulatory research; revision of plan; review and revision of plan to meet current federal requirements; amendments to plan; termination of the plan; re-computing of plan information due to changes/errors in Plan Sponsor supplied data; plan design alternatives; interim valuations; prior year administrative service; IRS and/or Department of Labor (DOL) audits; plan mergers/spin offs and meetings with plan sponsor's legal counsel/accountant will be billed on an hourly basis at current hourly rates and shall be paid by the Plan Sponsor pursuant to the terms of this Agreement.
      </Text>
    </View>
  )
}

function ExhibitB() {
  return (
    <>
      <View style={S.exhibitDivider}>
        <Text style={S.exhibitTitle}>Exhibit B: Plan Expenses</Text>
        <Text style={S.exhibitSub}>Please indicate how the expenses of the Plan are to be paid.</Text>
      </View>
      <View style={S.expenseGrid}>
        <View style={S.expenseHeaderRow}>
          <Text style={[S.expenseHeaderCell, S.expenseHeaderLabel]}>Expense</Text>
          <Text style={[S.expenseHeaderCell, S.expenseHeaderCol]}>Employer</Text>
          <Text style={[S.expenseHeaderCell, S.expenseHeaderCol]}>Participant Direct Charge</Text>
          <Text style={[S.expenseHeaderCell, S.expenseHeaderCol]}>Assets (prorata)</Text>
          <Text style={[S.expenseHeaderCell, S.expenseHeaderCol]}>N/A</Text>
        </View>
        {EXPENSE_ROWS.map((r, i) => {
          const Row = r.sub ? S.expenseSubRow : S.expenseRow
          const Label = r.sub ? S.expenseSubLabel : S.expenseLabel
          return (
            <View key={i} style={Row}>
              <Text style={Label}>{r.label}</Text>
              <Text style={S.expenseCol}></Text>
              <Text style={S.expenseCol}></Text>
              <Text style={S.expenseCol}></Text>
              <Text style={S.expenseCol}></Text>
            </View>
          )
        })}
      </View>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  planType: PlanType
  values: FormValues
}

export function ServiceAgreementPdf({ planType, values }: Props) {
  const template = selectSlaTemplate(planType, values)
  const { day, month, year } = parseSlaDate(values.planEffectiveDate ?? '')
  const employer = values.companyName || '________________________________'
  const planName = values.planName || '________________________________'
  const trustee = values.planTrustee || ''

  const { isRkTemplate, serviceDescription, templateLabel, annualAdmin, perParticipant, planDocFee, restateFee } =
    getSlaFees(template)

  return (
    <Document title={`${planName} Service Agreement`}>
      <Page size="LETTER" style={S.page}>
        {/* ── Header ── */}
        <View style={S.header}>
          <Text style={S.brand}>Flexible Benefits Systems, Inc.</Text>
          <Text style={S.docTitle}>Service Agreement</Text>
          <Text style={S.docSub}>{templateLabel}</Text>
        </View>

        {/* ── Preamble ── */}
        <View style={S.preamble}>
          <Text style={S.preambleText}>
            {'This Service Agreement (the "Agreement") is entered into between Flexible Benefits Systems, Inc. ("FBSI") and '}
            <Text style={S.bold}>{employer}</Text>
            {', the employer and plan sponsor ("Plan Sponsor"), to provide ' + serviceDescription + ' for the '}
            <Text style={S.bold}>{planName}</Text>
            {' (the "Plan"), under the terms, conditions and limitations stated herein, effective as of the '}
            <Text style={S.bold}>{day}</Text>
            {' day of '}
            <Text style={S.bold}>{month}</Text>
            {', '}
            <Text style={S.bold}>{year}</Text>
            {' (the "Effective Date").'}
          </Text>
        </View>

        {/* ── Articles ── */}
        {ARTICLES.map((art) => (
          <View key={art.num}>
            <Text style={S.articleTitle}>Article {art.num} — {art.title}</Text>
            {art.secs.map((sec) => (
              <View key={sec.num} style={S.secRow}>
                <Text style={S.secNum}>{sec.num}</Text>
                <View style={S.secContent}>
                  <Text style={S.secTitle}>{sec.title}</Text>
                  <Text style={S.secBody}>{sec.body}</Text>
                  {sec.address && (
                    <View style={S.addressBlock}>
                      {sec.address.map((line) => (
                        <Text key={line} style={S.secBody}>{line}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* ── Article XI — Execution ── */}
        <Text style={S.articleTitle}>Article XI — Execution</Text>
        <Text style={S.secBody}>
          By executing the Agreement, the Plan Sponsor agrees and acknowledges that it has reviewed the Agreement and is legally authorized to enter into this Agreement on behalf of the Plan.
        </Text>
        <View style={S.sigBlock}>
          <SignatureBlock label="Employer" trustee={trustee} />
          <SignatureBlock label="Plan Sponsor (if different than Employer)" />
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text>Flexible Benefits Systems, Inc. — Service Agreement</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── Exhibit A ── */}
      <Page size="LETTER" style={S.page}>
        <View style={S.exhibitDivider}>
          <Text style={S.exhibitTitle}>Exhibit A: The "Services" and Fee Schedule</Text>
          <Text style={S.exhibitSub}>
            This Exhibit A lists the Fees and the Services. Fees and Services are stated below.
            {!isRkTemplate && ' Services include Administrative Services. Any compensation paid by American Funds as TPA compensation will be deducted from total annual fees.'}
            {isRkTemplate && ' Services include Recordkeeping Services, Administrative Services and Custodial fees.'}
          </Text>
        </View>

        {isRkTemplate
          ? <RkFeeSection annualAdmin={annualAdmin} perParticipant={perParticipant} planDocFee={planDocFee} restateFee={restateFee} />
          : <SoloAnnualFeeSection />
        }

        {/* Exhibit A signature block */}
        <View style={[S.sigBlock, { marginTop: 16 }]}>
          <Text style={[S.secBody, { marginBottom: 8 }]}>
            By executing below, the Plan Sponsor agrees and acknowledges the above stated fees and is legally authorized to enter into this Agreement and acknowledges and agrees to this Exhibit A.
          </Text>
          <SignatureBlock label="Plan Sponsor" trustee={trustee} />
        </View>

        {/* Service descriptions */}
        {isRkTemplate && <RecordkeepingServices />}
        <AdministrativeServices />

        <View style={S.footer} fixed>
          <Text>Flexible Benefits Systems, Inc. — Service Agreement — Exhibit A</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── Exhibit B ── */}
      <Page size="LETTER" style={S.page}>
        <ExhibitB />
        <View style={S.footer} fixed>
          <Text>Flexible Benefits Systems, Inc. — Service Agreement — Exhibit B</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
