import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PlanType, FieldDef } from '../types'
import { getPlan } from '../schema/plans'
import { displayValue, indexFields, isSectionVisible, isVisible, parseTable, tableHasData } from '../schema/visibility'
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
  // Table field
  tableLabel: { fontSize: 10, color: '#475569', marginTop: 6, marginBottom: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#030D28', paddingVertical: 3, paddingHorizontal: 2 },
  tableHeaderCell: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold', paddingHorizontal: 2 },
  tableRow: { flexDirection: 'row', borderBottom: '0.3 solid #e2e8f0', paddingVertical: 3, paddingHorizontal: 2 },
  tableCell: { fontSize: 7, color: '#374151', paddingHorizontal: 2 },
  tableEmpty: { fontSize: 9, color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: '#94a3b8', flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5 solid #e2e8f0', paddingTop: 6 },
})

interface Props {
  planType: PlanType
  values: FormValues
}

function TableFieldView({ field, values }: { field: FieldDef; values: FormValues }) {
  const columns = field.columns ?? []
  const rows = parseTable(values[field.name]).filter((r) => Object.values(r).some((v) => (v ?? '').trim() !== ''))
  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <Text style={styles.tableLabel}>{field.label}</Text>
      {rows.length === 0 ? (
        <Text style={styles.tableEmpty}>None provided</Text>
      ) : (
        <View>
          <View style={styles.tableHeaderRow}>
            {columns.map((c) => (
              <Text key={c.key} style={[styles.tableHeaderCell, { flex: c.flex ?? 1 }]}>{c.label}</Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              {columns.map((c) => (
                <Text key={c.key} style={[styles.tableCell, { flex: c.flex ?? 1 }]}>{row[c.key] || '—'}</Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/** The Onboarding Summary as standalone Page(s) — reused by both the dedicated
 *  QuestionnairePdf document and the combined OnboardingPackagePdf. */
export function QuestionnairePages({ planType, values }: Props) {
  const plan = getPlan(planType)
  const byName = indexFields(plan.sections)

  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Retirement Plan Onboarding</Text>
          <Text style={styles.title}>{plan.name} — Onboarding Summary</Text>
        </View>

        {plan.sections.map((section) => {
          if (!isSectionVisible(section, values, byName)) return null
          const fields = section.fields.filter((f) => isVisible(f, values, byName))
          // Skip a section only if it has no visible fields with any content.
          const hasContent = fields.some((f) =>
            f.type === 'table' ? tableHasData(parseTable(values[f.name])) : displayValue(f, values) !== ''
          )
          if (!hasContent) return null

          return (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {fields.map((f) =>
                f.type === 'table' ? (
                  <TableFieldView key={f.name} field={f} values={values} />
                ) : (
                  <View key={f.name} style={styles.row} wrap={false}>
                    <Text style={styles.label}>{f.label}</Text>
                    <Text style={styles.value}>{displayValue(f, values) || '—'}</Text>
                  </View>
                )
              )}
            </View>
          )
        })}

        <View style={styles.footer} fixed>
          <Text>{plan.name} Onboarding Summary</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </>
  )
}

export function QuestionnairePdf({ planType, values }: Props) {
  const plan = getPlan(planType)
  return (
    <Document title={`${plan.name} Onboarding Summary`}>
      <QuestionnairePages planType={planType} values={values} />
    </Document>
  )
}
