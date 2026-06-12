import { pdf } from '@react-pdf/renderer'
import type { PlanType } from '../types'
import { getPlan } from '../schema/plans'
import type { FormValues } from '../schema/visibility'
import { QuestionnairePdf } from './QuestionnairePdf'
import { ServiceAgreementPdf } from './ServiceAgreementPdf'
import { selectSlaTemplate, hasSla } from './serviceAgreementContent'

/** Build the questionnaire PDF, trigger a browser download, and return the file name used. */
export async function downloadQuestionnairePdf(planType: PlanType, values: FormValues): Promise<string> {
  const blob = await pdf(<QuestionnairePdf planType={planType} values={values} />).toBlob()

  const plan = getPlan(planType)
  const safePlanName = (values.planName || 'Plan').replace(/[^\w-]+/g, '_').slice(0, 60)
  const fileName = `${safePlanName}-${plan.short.replace(/[^\w]+/g, '')}-Questionnaire.pdf`

  triggerDownload(blob, fileName)
  return fileName
}

/** Build the service agreement PDF, trigger a browser download, and return the file name used.
 *  Returns null for plan types that do not have a service agreement template. */
export async function downloadServiceAgreementPdf(planType: PlanType, values: FormValues): Promise<string | null> {
  if (!hasSla(planType)) return null

  const template = selectSlaTemplate(planType, values)
  const blob = await pdf(<ServiceAgreementPdf planType={planType} values={values} />).toBlob()

  const plan = getPlan(planType)
  const safePlanName = (values.planName || 'Plan').replace(/[^\w-]+/g, '_').slice(0, 60)
  const templateSuffix =
    template === 'solo-annual' ? 'SoloAnnual'
    : template === 'solo-rk' ? 'SoloRK'
    : 'RK-TPA'
  const fileName = `${safePlanName}-${plan.short.replace(/[^\w]+/g, '')}-ServiceAgreement-${templateSuffix}.pdf`

  triggerDownload(blob, fileName)
  return fileName
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revocation: revoking synchronously after click() can produce a 0-byte
  // download in Firefox before the browser has read the blob bytes.
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export { hasSla }
