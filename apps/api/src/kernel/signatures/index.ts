// Public surface of the signatures kernel slice — the append-only ESIGN/UETA audit log.
// The insert helper is composed into DocumentStore.create (atomic with the document);
// findEventsByCase is reused by the staff slice; SignatureStore is the owner read surface.
export { SignatureStore, insertSignatureEvent, findEventsByCase, type RecordSignatureInput } from './store'
export { deriveSignatureEvents, SLA_SIGNATURE, DATA_CERTIFICATION, type SignatureEventDraft } from './derive'
