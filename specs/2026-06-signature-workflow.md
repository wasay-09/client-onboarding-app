# Spec: Signature workflow, onboarding package & typography

Status: implemented · Branch: `feat/signature-workflow-and-typography` · Date: 2026-06-17

Implements the client-side-feasible parts of the document/signature design review.
Backend-dependent parts are listed under "Deferred".

## What changed & why

### 1. Electronic-records consent (E-SIGN / UETA)
- **What:** A consent checkbox before any e-signature. Shown on the Service Agreement
  step for SLA plans; on the Review & Certify step for non-SLA plans (457b, SIMPLE).
  Captures `esignConsent` + `esignConsentAt`.
- **Why:** ESIGN/UETA require recorded consent to transact electronically for an
  e-signature to be enforceable.

### 2. Signer delegation (form-filler ≠ signer) + signature pad
- **What:** On the SA step, "Are you authorized to sign on behalf of the Plan Sponsor?"
  - **Yes** → sign now: `slaSignerName`, `slaSignerTitle`, a **draw-or-type signature pad**
    (`SignaturePad.tsx` → PNG `slaSignatureImage`), `slaAcknowledged`, `slaSignedAt`.
  - **No** → capture authorized signer (`slaDelegateName/Email/Title`); SA marked *pending route*.
- **Signature pad:** Type mode renders the legal name in script; Draw mode is a canvas. Both
  export a PNG embedded into the SA signature line via `@react-pdf` `Image` (falls back to
  `/s/ Name` text if absent). The drawing is cosmetic — legal weight comes from intent
  (checkbox) + consent + audit, not the image form.
- **Why:** The SA must be executed by someone authorized to bind the company (often a
  Trustee), who is usually not the person entering data. This is the decisive workflow gap.

### 3. Certify (don't sign) the questionnaire
- **What:** New final step `{ kind: 'certify' }` for every plan: review summary + certify
  data accurate (`dataCertified`, `dataCertifiedBy`, `dataCertifiedAt`).
- **Why:** The questionnaire is a data record, not a contract. SA §2.2 = FBSI relies on
  accuracy → an attestation is the right instrument, not a legal signature.

### 4. Combined "Onboarding Package" PDF
- **What:** `OnboardingPackagePdf` = execution/certification cover page + Service Agreement
  (if any) + Onboarding Summary, in one Document. Primary download at the end; individual
  docs still downloadable. SA execution blocks now reflect the captured e-signature.
- **Why:** Keep documents separate (different signers/retention/routing) but bundle them in
  one envelope with one courtesy copy. The cover page is the audit/execution record.

### 5. Role groundwork
- **What:** `Party` type + optional `SectionDef.party`; set per section; shown as a
  "Typically completed by" hint.
- **Why:** Prepares multi-party routing/assignment (later phase) without building it yet.

### 6. Professional typography
- **What:** Web UI font Plus Jakarta Sans → **Inter** (tabular figures + `cv11`/`ss01`).
- **Why:** Inter is the neutral, trustworthy fintech standard. PDFs stay on Helvetica
  (built-in, embedded, no runtime font fetch).

## Key files
- `src/components/QuestionnaireForm.tsx` — consent + signer branch + certify step + validators (`validateSla`, `validateCertify`).
- `src/components/SignaturePad.tsx` — draw-or-type signature → PNG data URL (new).
- `src/pdf/OnboardingPackagePdf.tsx` — combined package + cover page (new).
- `src/pdf/ServiceAgreementPdf.tsx` / `QuestionnairePdf.tsx` — split into reusable `*Pages` + thin `*Pdf` Document wrappers.
- `src/pdf/serviceAgreementContent.ts` — `formatTimestamp()`.
- `src/pdf/generatePdf.tsx` — `downloadOnboardingPackagePdf()`.
- `src/App.tsx` — package is primary deliverable; done screen shows SA signed/pending status.
- `src/types.ts`, `src/schema/*.ts` — `Party` + `party`.
- Typography: `src/index.css`, `tailwind.config.js`, `index.html`.

## Data keys added to FormValues (flat string map → flows to PDFs)
`esignConsent`, `esignConsentAt`, `slaSignerAuthorized`, `slaSignerName`, `slaSignerTitle`,
`slaSignatureImage` (PNG data URL), `slaSignedAt`, `slaDelegateName`, `slaDelegateEmail`,
`slaDelegateTitle`, `dataCertified`, `dataCertifiedBy`, `dataCertifiedAt`.
(`slaAcknowledged` pre-existing.)

## Deferred (need a backend or e-sign vendor — NOT built)
- Legally-binding signature with real identity (email OTP), tamper-evident hash, full audit
  trail, and emailing the signing link to a delegated signer. Today the "send to signer" path
  only **captures intent + marks pending**; nothing is actually emailed.
- Multi-party collaboration: inviting the advisor / payroll contact to complete their sections.
- Later signature events (plan documents, custodial/MATC, advisor RIA) by the Trustee.
- Recommended approach when adding: embed an ESIGN/UETA e-sign API (e.g. Anvil) for legal
  docs; keep the self-built checkbox certification for the questionnaire.

## Verify
`npm run build` (typecheck + build) · `npm run smoke` (per-plan PDF gen) ·
`npx vite-node scripts/generate_draft_pdfs.tsx` (emits the 3 draft PDFs incl. package).
