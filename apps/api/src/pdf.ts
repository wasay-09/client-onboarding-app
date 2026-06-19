import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { OnboardingPackagePdf, type FormValues, type PlanType } from '@fbsi/shared'

/**
 * Render the canonical Onboarding Package PDF server-side, reusing the exact same
 * @fbsi/shared components the client uses. This server-made PDF is the one stored
 * and served (invariant: the canonical/signed document is server-made).
 */
export async function renderOnboardingPackage(
  planType: PlanType,
  values: FormValues,
): Promise<Uint8Array> {
  // OnboardingPackagePdf renders a @react-pdf <Document>; cast to the element type
  // renderToBuffer expects (its props type is the Document's, not the component's).
  const element = createElement(OnboardingPackagePdf, { planType, values }) as Parameters<
    typeof renderToBuffer
  >[0]
  return renderToBuffer(element)
}
