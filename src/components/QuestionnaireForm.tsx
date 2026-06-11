import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { PlanType } from '../types'
import { getPlan } from '../schema/plans'
import { indexFields, isVisible, validate } from '../schema/visibility'
import type { FormValues } from '../schema/visibility'
import { Field } from './fields/Field'

interface Props {
  planType: PlanType
  onBack: () => void
  onComplete: (values: FormValues) => void
}

export function QuestionnaireForm({ planType, onBack, onComplete }: Props) {
  const plan = getPlan(planType)
  const methods = useForm<FormValues>({ defaultValues: {}, mode: 'onSubmit' })
  const { handleSubmit, watch } = methods
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Watch all values so conditional visibility re-evaluates as the user types.
  const values = watch()
  const byName = useMemo(() => indexFields(plan.sections), [plan])

  const onSubmit = (data: FormValues) => {
    const found = validate(plan.sections, data)
    if (found.length) {
      const map: Record<string, string> = {}
      for (const e of found) map[e.name] = e.message
      setErrors(map)
      document.getElementById(found[0].name)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setErrors({})
    onComplete(data)
  }

  return (
    <FormProvider {...methods}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-accent">
          ← Change plan type
        </button>
        <h1 className="mt-2 text-2xl font-bold text-navy">{plan.name} — Design Questionnaire</h1>
        <p className="mt-1 text-slate-600">
          Fields marked <span className="text-rose-500">*</span> are required.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8" noValidate>
          {plan.sections.map((section) => {
            const visibleFields = section.fields.filter((f) => isVisible(f, values, byName))
            if (!visibleFields.length) return null
            return (
              <fieldset key={section.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <legend className="px-2 text-lg font-semibold text-navy">{section.title}</legend>
                {section.description && (
                  <p className="mb-4 text-sm text-slate-500">{section.description}</p>
                )}
                <div className="space-y-5">
                  {visibleFields.map((field) => (
                    <Field key={field.name} field={field} value={values[field.name] ?? ''} error={errors[field.name]} />
                  ))}
                </div>
              </fieldset>
            )
          })}

          {Object.keys(errors).length > 0 && (
            <p className="text-sm font-medium text-rose-600">
              Please complete the highlighted required fields above.
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit"
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm
                transition hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent/40">
              Review &amp; Download PDF
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  )
}
