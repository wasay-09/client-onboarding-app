// Public surface of the documents kernel slice. The store is an internal dependency
// of the cases + staff slices (no HTTP routes of its own yet).
export { DocumentStore, insertDocument, findLatest, type CreateDocumentInput } from './store'
export const ONBOARDING_PACKAGE = 'onboarding_package'
