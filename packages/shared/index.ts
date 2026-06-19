// @fbsi/shared — the single source of truth for fields, validation, and PDF rendering.
// Web, the dev scripts, and (later) the API import from this package root only,
// never from deep paths. This barrel IS the contract.

// Types + field schema
export * from './types'
export * from './schema/sharedCore'
export * from './schema/designConsiderations'
export * from './schema/operational'
export * from './schema/solo'
export * from './schema/plans'
export * from './schema/visibility'

// PDF documents + service-agreement content/fees
export * from './pdf/serviceAgreementContent'
export * from './pdf/QuestionnairePdf'
export * from './pdf/ServiceAgreementPdf'
export * from './pdf/OnboardingPackagePdf'

// PDF download helpers. generatePdf also re-exports `hasSla` (originally from
// serviceAgreementContent, already exported above), so export only the download
// functions explicitly to avoid an ambiguous star re-export.
export {
  downloadQuestionnairePdf,
  downloadServiceAgreementPdf,
  downloadOnboardingPackagePdf,
} from './pdf/generatePdf'
