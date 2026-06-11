import { pdf } from '@react-pdf/renderer'
import type { PlanType } from '../types'
import { getPlan } from '../schema/plans'
import type { FormValues } from '../schema/visibility'
import { QuestionnairePdf } from './QuestionnairePdf'

/** Build the PDF, trigger a browser download, and return the file name used. */
export async function downloadQuestionnairePdf(planType: PlanType, values: FormValues): Promise<string> {
  const blob = await pdf(<QuestionnairePdf planType={planType} values={values} />).toBlob()

  const plan = getPlan(planType)
  const safePlanName = (values.planName || 'Plan').replace(/[^\w\-]+/g, '_').slice(0, 60)
  const fileName = `${safePlanName}-${plan.short.replace(/[^\w]+/g, '')}-Questionnaire.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return fileName
}
