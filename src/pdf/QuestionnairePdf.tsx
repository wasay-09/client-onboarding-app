import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PlanType } from '../types'
import { getPlan } from '../schema/plans'
import { displayValue, indexFields, isVisible } from '../schema/visibility'
import type { FormValues } from '../schema/visibility'

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica' },
  header: { marginBottom: 18, borderBottom: '2 solid #030D28', paddingBottom: 10 },
  brand: { fontSize: 9, color: '#3B6FF5', fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#030D28', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#030D28', marginBottom: 8, backgroundColor: '#EEF2FB', padding: 5 },
  row: { flexDirection: 'row', borderBottom: '0.5 solid #e2e8f0', paddingVertical: 4 },
  label: { width: '52%', color: '#475569', paddingRight: 8 },
  value: { width: '48%', fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: '#94a3b8', flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5 solid #e2e8f0', paddingTop: 6 },
})

interface Props {
  planType: PlanType
  values: FormValues
}

export function QuestionnairePdf({ planType, values }: Props) {
  const plan = getPlan(planType)
  const byName = indexFields(plan.sections)

  return (
    <Document title={`${plan.name} Design Questionnaire`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Retirement Plan Onboarding</Text>
          <Text style={styles.title}>{plan.name} — Design Questionnaire</Text>
        </View>

        {plan.sections.map((section) => {
          const rows = section.fields
            .filter((f) => isVisible(f, values, byName))
            .map((f) => ({ label: f.label, value: displayValue(f, values) }))
          if (!rows.length) return null
          return (
            <View key={section.id} style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {rows.map((r) => (
                <View key={r.label} style={styles.row}>
                  <Text style={styles.label}>{r.label}</Text>
                  <Text style={styles.value}>{r.value || '—'}</Text>
                </View>
              ))}
            </View>
          )
        })}

        <View style={styles.footer} fixed>
          <Text>{plan.name} Design Questionnaire</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
