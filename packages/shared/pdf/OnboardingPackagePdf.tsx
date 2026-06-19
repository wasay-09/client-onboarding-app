import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PlanType } from '../types'
import { getPlan } from '../schema/plans'
import type { FormValues } from '../schema/visibility'
import { hasSla, formatTimestamp, parseSlaDate } from './serviceAgreementContent'
import { ServiceAgreementPages } from './ServiceAgreementPdf'
import { QuestionnairePages } from './QuestionnairePdf'

// ─────────────────────────────────────────────────────────────────────────────
// Combined "Onboarding Package" — the single courtesy copy bundling the separate
// canonical documents (Service Agreement + Onboarding Summary) behind one cover
// page that records execution & certification (the audit trail). The individual
// documents are still generated separately for the file/recordkeeper; this is the
// client-facing convenience copy. See specs/.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 60, paddingHorizontal: 48, fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica', lineHeight: 1.5 },
  header: { marginBottom: 18, borderBottom: '2 solid #030D28', paddingBottom: 10 },
  brand: { fontSize: 9, color: '#3B6FF5', fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#030D28', marginTop: 4 },
  sub: { fontSize: 9, color: '#475569', marginTop: 3 },
  metaBox: { marginTop: 4, marginBottom: 16, padding: 10, backgroundColor: '#f8fafc', borderLeft: '3 solid #3B6FF5' },
  metaRow: { flexDirection: 'row', paddingVertical: 2 },
  metaLabel: { width: 120, color: '#475569' },
  metaValue: { flex: 1, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#030D28', marginTop: 14, marginBottom: 6, backgroundColor: '#EEF2FB', padding: 5 },
  contentsRow: { flexDirection: 'row', paddingVertical: 3, borderBottom: '0.3 solid #e2e8f0' },
  contentsNum: { width: 18, fontFamily: 'Helvetica-Bold', color: '#3B6FF5' },
  contentsText: { flex: 1, color: '#374151' },
  recRow: { flexDirection: 'row', paddingVertical: 5, borderBottom: '0.5 solid #e2e8f0' },
  recLabel: { width: 150, color: '#475569', fontFamily: 'Helvetica-Bold' },
  recValue: { flex: 1, color: '#0f172a' },
  recStatusOk: { color: '#047857', fontFamily: 'Helvetica-Bold' },
  recStatusPending: { color: '#b45309', fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 8, color: '#64748b', marginTop: 14, lineHeight: 1.45, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: '#94a3b8', flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5 solid #e2e8f0', paddingTop: 6 },
})

interface Props {
  planType: PlanType
  values: FormValues
}

function RecordRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={S.recRow}>
      <Text style={S.recLabel}>{label}</Text>
      <Text style={S.recValue}>{children}</Text>
    </View>
  )
}

function CoverPage({ planType, values }: Props) {
  const plan = getPlan(planType)
  const employer = values.companyName || '—'
  const planName = values.planName || '—'
  const planHasSla = hasSla(planType)
  const { day, month, year } = parseSlaDate(values.planEffectiveDate ?? '')
  const effectiveDate = values.planEffectiveDate ? `${month} ${day}, ${year}` : '—'

  const consentAt = formatTimestamp(values.esignConsentAt)
  const certifiedAt = formatTimestamp(values.dataCertifiedAt)
  const signedAt = formatTimestamp(values.slaSignedAt)

  const signerName = (values.slaSignerName || '').trim()
  const signerTitle = (values.slaSignerTitle || '').trim()
  const eSigned = values.slaAcknowledged === 'Yes' && values.slaSignerAuthorized === 'Yes'
  const delegated = values.slaSignerAuthorized === 'No'

  return (
    <Page size="LETTER" style={S.page}>
      <View style={S.header}>
        <Text style={S.brand}>Flexible Benefits Systems, Inc.</Text>
        <Text style={S.title}>Onboarding Package</Text>
        <Text style={S.sub}>{plan.name} — execution &amp; certification record</Text>
      </View>

      <View style={S.metaBox}>
        <View style={S.metaRow}><Text style={S.metaLabel}>Plan Sponsor</Text><Text style={S.metaValue}>{employer}</Text></View>
        <View style={S.metaRow}><Text style={S.metaLabel}>Plan</Text><Text style={S.metaValue}>{planName}</Text></View>
        <View style={S.metaRow}><Text style={S.metaLabel}>Effective Date</Text><Text style={S.metaValue}>{effectiveDate}</Text></View>
      </View>

      <Text style={S.sectionTitle}>Contents of this Package</Text>
      <View style={S.contentsRow}><Text style={S.contentsNum}>1.</Text><Text style={S.contentsText}>Execution &amp; Certification Record (this page)</Text></View>
      {planHasSla && (
        <View style={S.contentsRow}><Text style={S.contentsNum}>2.</Text><Text style={S.contentsText}>Service Agreement, including Exhibit A (Fee Schedule) and Exhibit B (Plan Expenses)</Text></View>
      )}
      <View style={S.contentsRow}><Text style={S.contentsNum}>{planHasSla ? '3.' : '2.'}</Text><Text style={S.contentsText}>Onboarding Summary (all information provided)</Text></View>

      <Text style={S.sectionTitle}>Execution &amp; Certification Record</Text>

      <RecordRow label="Electronic Records Consent">
        {consentAt
          ? <Text style={S.recStatusOk}>Accepted — {consentAt}</Text>
          : <Text style={S.recStatusPending}>Not recorded</Text>}
      </RecordRow>

      <RecordRow label="Service Agreement">
        {!planHasSla ? (
          'Not applicable for this plan type.'
        ) : eSigned ? (
          <Text style={S.recStatusOk}>
            Signed electronically by {signerName || '—'}{signerTitle ? `, ${signerTitle}` : ''}{signedAt ? ` — ${signedAt}` : ''}
          </Text>
        ) : delegated ? (
          <Text style={S.recStatusPending}>
            Acknowledged by preparer; pending signature — to be routed to {(values.slaDelegateName || '—')}
            {values.slaDelegateEmail ? ` (${values.slaDelegateEmail})` : ''} for execution.
          </Text>
        ) : (
          <Text style={S.recStatusPending}>Reviewed on screen; signature pending.</Text>
        )}
      </RecordRow>

      <RecordRow label="Data Certification">
        {certifiedAt
          ? <Text style={S.recStatusOk}>Certified accurate by {(values.dataCertifiedBy || '—')} — {certifiedAt}</Text>
          : <Text style={S.recStatusPending}>Not recorded</Text>}
      </RecordRow>

      <Text style={S.note}>
        This cover page is a portal-generated summary of the electronic consent, signature, and certification events
        captured during onboarding. Electronic signatures are made under the federal ESIGN Act and applicable UETA. This
        package is provided as a convenience copy; the Service Agreement and Onboarding Summary are also retained as
        separate documents. The Service Agreement is the binding contract and, per its terms, must be executed by a
        person authorized to act on behalf of the Plan Sponsor.
      </Text>

      <View style={S.footer} fixed>
        <Text>Flexible Benefits Systems, Inc. — Onboarding Package</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  )
}

export function OnboardingPackagePdf({ planType, values }: Props) {
  const plan = getPlan(planType)
  return (
    <Document title={`${plan.name} Onboarding Package`}>
      <CoverPage planType={planType} values={values} />
      {hasSla(planType) && <ServiceAgreementPages planType={planType} values={values} />}
      <QuestionnairePages planType={planType} values={values} />
    </Document>
  )
}
