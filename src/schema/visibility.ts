import type { FieldDef, SectionDef, ShowWhen, TableRow } from '../types'
import { OTHER_VALUE, otherFieldName } from '../types'

export type FormValues = Record<string, string>

/** Does a single showWhen condition match the current values? */
function matches(condition: ShowWhen | undefined, values: FormValues, byName: Map<string, FieldDef>): boolean {
  if (!condition) return true
  const current = values[condition.field]
  const wanted = Array.isArray(condition.equals) ? condition.equals : [condition.equals]
  if (!wanted.includes(current)) return false
  // A field is only truly visible if the field it depends on is itself visible.
  const parent = byName.get(condition.field)
  if (parent) return isVisible(parent, values, byName)
  return true
}

export function isVisible(field: FieldDef, values: FormValues, byName: Map<string, FieldDef>): boolean {
  return matches(field.showWhen, values, byName)
}

/**
 * Is a whole section visible? Section conditions can reference fields from any
 * section, so callers should pass an index built across all of a plan's sections.
 */
export function isSectionVisible(section: SectionDef, values: FormValues, byName: Map<string, FieldDef>): boolean {
  return matches(section.showWhen, values, byName)
}

/** Flat index of all fields across the given sections, keyed by name. */
export function indexFields(sections: SectionDef[]): Map<string, FieldDef> {
  const map = new Map<string, FieldDef>()
  for (const s of sections) for (const f of s.fields) map.set(f.name, f)
  return map
}

// ─── Table (repeating-row) helpers ────────────────────────────────────────────
// Table data is stored as a JSON string under the field name so the rest of the
// app can keep treating FormValues as a flat string map.

export function parseTable(raw: string | undefined): TableRow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TableRow[]) : []
  } catch {
    return []
  }
}

export function serializeTable(rows: TableRow[]): string {
  return JSON.stringify(rows)
}

/** A row counts as filled if any of its cells has a non-empty value. */
export function tableHasData(rows: TableRow[]): boolean {
  return rows.some((row) => Object.values(row).some((v) => (v ?? '').trim() !== ''))
}

export interface FieldError {
  name: string
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validate currently-visible required fields in visible sections. Returns list of errors. */
export function validate(sections: SectionDef[], values: FormValues): FieldError[] {
  const byName = indexFields(sections)
  const errors: FieldError[] = []
  for (const section of sections) {
    if (!isSectionVisible(section, values, byName)) continue
    for (const field of section.fields) {
      if (!isVisible(field, values, byName)) continue

      if (field.type === 'table') {
        if (field.required && !tableHasData(parseTable(values[field.name]))) {
          errors.push({ name: field.name, message: 'Please add at least one row.' })
        }
        continue
      }

      const raw = values[field.name]
      const value = (raw ?? '').trim()

      if (field.required && !value) {
        errors.push({ name: field.name, message: 'This field is required.' })
        continue
      }
      if (value && field.type === 'email' && !EMAIL_RE.test(value)) {
        errors.push({ name: field.name, message: 'Enter a valid email address.' })
      }
      // "Other" radio choice requires its companion text.
      if (field.allowOther && value === OTHER_VALUE) {
        const other = (values[otherFieldName(field.name)] ?? '').trim()
        if (!other && field.required) {
          errors.push({ name: otherFieldName(field.name), message: 'Please specify.' })
        }
      }
    }
  }
  return errors
}

/** The display value for a field, resolving an "Other" choice to its text. */
export function displayValue(field: FieldDef, values: FormValues): string {
  const raw = (values[field.name] ?? '').trim()
  if (field.allowOther && raw === OTHER_VALUE) {
    return (values[otherFieldName(field.name)] ?? '').trim()
  }
  return raw
}
