// Core types for the schema-driven onboarding flow.
// One field definition drives the form UI, validation, and the PDF.

export type PlanType = '401k' | '403b' | '457b' | 'simpleira' | 'solo401k'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'date'
  | 'radio'
  | 'yesno'
  | 'table'

export interface FieldOption {
  value: string
  label: string
}

/** A single condition: show this field/section only when `field` equals one of `equals`. */
export interface ShowWhen {
  field: string
  equals: string | string[]
}

/** One column of a repeating-row `table` field. */
export interface TableColumn {
  key: string
  label: string
  /** Narrow set of input types valid inside a table cell. Defaults to text. */
  type?: 'text' | 'date' | 'email' | 'tel'
  placeholder?: string
  /** Relative flex weight for column width (default 1). */
  flex?: number
}

export interface FieldDef {
  /** Unique key — also the form field name and PDF data key. */
  name: string
  label: string
  type: FieldType
  required?: boolean
  /** For `radio`. `yesno` auto-generates Yes/No. */
  options?: FieldOption[]
  /** For `radio`: append an "Other" choice with a companion free-text input. */
  allowOther?: boolean
  placeholder?: string
  help?: string
  /** Conditional visibility. Field is hidden (and skipped in validation/PDF) unless met. */
  showWhen?: ShowWhen

  // --- `table` fields only ---
  /** Column definitions for a repeating-row table. */
  columns?: TableColumn[]
  /** Number of empty rows to seed a fresh table with (default 1). */
  minRows?: number
  /** Label for the "add row" button (default "Add Row"). */
  addRowLabel?: string
}

export interface SectionDef {
  id: string
  title: string
  description?: string
  /** Which sections a plan uses is decided in plans.ts, not here. */
  fields: FieldDef[]
  /** Conditional visibility for the whole section (skips the step + validation + PDF). */
  showWhen?: ShowWhen
}

/** Suffix used for the companion free-text input of an "Other" radio choice. */
export const OTHER_VALUE = '__other__'
export const otherFieldName = (name: string) => `${name}__other`

/** A single row of a `table` field: column key -> cell value. */
export type TableRow = Record<string, string>
