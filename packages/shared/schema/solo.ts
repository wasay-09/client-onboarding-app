import type { SectionDef } from '../types'

export const soloSection: SectionDef = {
  id: 'soloConfig',
  title: 'Solo 401(k) Configuration',
  fields: [
    {
      name: 'soloValuationType',
      label: 'Plan Administration Type',
      type: 'radio',
      required: true,
      options: [
        { value: 'daily', label: 'Daily Valued (Recordkeeping)' },
        { value: 'annual', label: 'Annual Balance Forward' },
      ],
      help: 'Daily Valued: assets tracked daily via a recordkeeping platform. Annual: administered on a balance-forward basis (e.g., American Funds).',
    },
  ],
}
