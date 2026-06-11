import type { FieldDef, SectionDef } from '../types'
import { OTHER_VALUE, otherFieldName } from '../types'

export type FormValues = Record<string, string>

/** Does a single showWhen condition match the current values? */
function matches(condition: FieldDef['showWhen'], values: FormValues, byName: Map<string, FieldDef>): boolean {
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

/** Flat index of all fields across the given sections, keyed by name. */
export function indexFields(sections: SectionDef[]): Map<string, FieldDef> {
  const map = new Map<string, FieldDef>()
  for (const s of sections) for (const f of s.fields) map.set(f.name, f)
  return map
}

export interface FieldError {
  name: string
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validate currently-visible required fields. Returns list of errors. */
export function validate(sections: SectionDef[], values: FormValues): FieldError[] {
  const byName = indexFields(sections)
  const errors: FieldError[] = []
  for (const section of sections) {
    for (const field of section.fields) {
      if (!isVisible(field, values, byName)) continue
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
