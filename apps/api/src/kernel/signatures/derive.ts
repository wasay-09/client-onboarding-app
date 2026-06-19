import { hasSla, type FormValues, type PlanType } from '@fbsi/shared'

// Event types recorded in the append-only signature_event log.
export const SLA_SIGNATURE = 'sla_signature'
export const DATA_CERTIFICATION = 'data_certification'

/** One finalized signature/certification derived from a submission's answers. The
 *  server-side fields (signer user id, IP, user-agent, document hash) are added by the
 *  store at write time — this is only what the answers themselves assert. */
export interface SignatureEventDraft {
  eventType: string
  method: string
  signerName: string | null
  signerTitle: string | null
  consented: boolean
  consentAt: string | null
}

const t = (s: string | undefined): string | null => {
  const v = s?.trim()
  return v ? v : null
}

/**
 * Decide which finalized events a submission represents — the SERVER's re-check of the
 * client gates (validateSla / validateCertify in QuestionnaireForm), never trusting the
 * client to declare "signed". An SLA signature counts only when the signer consented,
 * said they're authorized, named themselves, drew/typed a signature, AND checked the sign
 * box. A data certification counts when the accuracy box is checked and signed by name.
 *
 * A 401(k)/403(b) submission can yield BOTH (it has an SLA step and a certify step); a
 * 457(b)/SIMPLE/Solo submission yields at most the certification. The delegate path
 * (slaSignerAuthorized === 'No') is "pending route", NOT a finalized signature — no event.
 */
export function deriveSignatureEvents(planType: PlanType, a: FormValues): SignatureEventDraft[] {
  const drafts: SignatureEventDraft[] = []

  if (
    hasSla(planType) &&
    a.esignConsent === 'Yes' &&
    a.slaSignerAuthorized === 'Yes' &&
    t(a.slaSignerName) &&
    t(a.slaSignatureImage) &&
    a.slaAcknowledged === 'Yes'
  ) {
    drafts.push({
      eventType: SLA_SIGNATURE,
      method: 'esign_signature_pad',
      signerName: t(a.slaSignerName),
      signerTitle: t(a.slaSignerTitle),
      consented: true,
      consentAt: t(a.esignConsentAt),
    })
  }

  if (a.dataCertified === 'Yes' && t(a.dataCertifiedBy)) {
    // Consent is captured at the certify step for non-SLA plans, at the SLA step for SLA
    // plans; either way esignConsent === 'Yes' is the recorded electronic-records consent.
    drafts.push({
      eventType: DATA_CERTIFICATION,
      method: 'attestation_checkbox',
      signerName: t(a.dataCertifiedBy),
      signerTitle: null,
      consented: a.esignConsent === 'Yes',
      consentAt: t(a.esignConsentAt) ?? t(a.dataCertifiedAt),
    })
  }

  return drafts
}
