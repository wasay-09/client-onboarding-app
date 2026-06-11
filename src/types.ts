// Core types for the schema-driven questionnaire.
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

export interface FieldOption {
  value: string
  label: string
}

/** A single condition: show this field only when `field` equals one of `equals`. */
export interface ShowWhen {
  field: string
  equals: string | string[]
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
}

export interface SectionDef {
  id: string
  title: string
  description?: string
  /** Which sections a plan uses is decided in plans.ts, not here. */
  fields: FieldDef[]
}

/** Suffix used for the companion free-text input of an "Other" radio choice. */
export const OTHER_VALUE = '__other__'
export const otherFieldName = (name: string) => `${name}__other`
