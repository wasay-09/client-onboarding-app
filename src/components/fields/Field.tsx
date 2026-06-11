import { useFormContext } from 'react-hook-form'
import type { FieldDef } from '../../types'
import { OTHER_VALUE, otherFieldName } from '../../types'

interface Props {
  field: FieldDef
  error?: string
  /** Current value of this field (passed from parent which watches the form). */
  value: string
}

const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none'

export function Field({ field, error, value }: Props) {
  const { register } = useFormContext()
  const describedBy = error ? `${field.name}-error` : undefined

  const labelEl = (
    <label htmlFor={field.name} className="block text-sm font-semibold text-slate-800">
      {field.label}
      {field.required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )

  let control: React.ReactNode

  if (field.type === 'textarea') {
    control = (
      <textarea id={field.name} rows={3} className={inputClass} placeholder={field.placeholder}
        aria-describedby={describedBy} {...register(field.name)} />
    )
  } else if (field.type === 'yesno') {
    control = (
      <div className="mt-2 flex gap-6">
        {['Yes', 'No'].map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" value={opt} className="h-4 w-4 text-accent focus:ring-accent"
              {...register(field.name)} />
            {opt}
          </label>
        ))}
      </div>
    )
  } else if (field.type === 'radio') {
    const options = [...(field.options ?? [])]
    control = (
      <div className="mt-2 space-y-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="radio" value={opt.value} className="mt-0.5 h-4 w-4 text-accent focus:ring-accent"
              {...register(field.name)} />
            <span>{opt.label}</span>
          </label>
        ))}
        {field.allowOther && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" value={OTHER_VALUE} className="h-4 w-4 text-accent focus:ring-accent"
                {...register(field.name)} />
              Other:
            </label>
            <input type="text" className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm
              disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="please specify"
              disabled={value !== OTHER_VALUE}
              {...register(otherFieldName(field.name))} />
          </div>
        )}
      </div>
    )
  } else {
    const type = field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'
    control = (
      <input id={field.name} type={type} className={inputClass} placeholder={field.placeholder}
        aria-describedby={describedBy} {...register(field.name)} />
    )
  }

  return (
    <div>
      {labelEl}
      {field.help && <p className="mt-0.5 text-xs text-slate-500">{field.help}</p>}
      {control}
      {error && (
        <p id={describedBy} className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}
