import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { FieldDef, TableColumn, TableRow } from '@fbsi/shared'
import { OTHER_VALUE, otherFieldName, parseTable, serializeTable } from '@fbsi/shared'

interface Props {
  field: FieldDef
  error?: string
  /** Current value of this field (passed from parent which watches the form). */
  value: string
}

const inputClass =
  'mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm bg-white ' +
  'text-slate-800 placeholder-slate-400 transition-all duration-150 ' +
  'focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none hover:border-slate-300'

const cellInputClass =
  'block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs shadow-sm bg-white ' +
  'text-slate-800 placeholder-slate-400 transition-all duration-150 ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none hover:border-slate-300'

function emptyRow(columns: TableColumn[]): TableRow {
  const row: TableRow = {}
  for (const c of columns) row[c.key] = ''
  return row
}

function cellType(col: TableColumn): string {
  return col.type === 'date' ? 'date' : col.type === 'email' ? 'email' : col.type === 'tel' ? 'tel' : 'text'
}

/** A repeating-row table field. Rows are stored as a JSON string under field.name. */
function TableField({ field }: { field: FieldDef }) {
  const { getValues, setValue } = useFormContext()
  const columns = field.columns ?? []
  const minRows = field.minRows ?? 1

  const [rows, setRows] = useState<TableRow[]>(() => {
    const existing = parseTable(getValues(field.name))
    if (existing.length) return existing
    return Array.from({ length: minRows }, () => emptyRow(columns))
  })

  const commit = (next: TableRow[]) => {
    setRows(next)
    setValue(field.name, serializeTable(next), { shouldValidate: false, shouldDirty: true })
  }

  const updateCell = (rowIdx: number, key: string, val: string) => {
    commit(rows.map((r, i) => (i === rowIdx ? { ...r, [key]: val } : r)))
  }
  const addRow = () => commit([...rows, emptyRow(columns)])
  const removeRow = (rowIdx: number) => {
    const next = rows.filter((_, i) => i !== rowIdx)
    commit(next.length ? next : [emptyRow(columns)])
  }

  return (
    <div className="mt-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                  style={{ minWidth: `${(c.flex ?? 1) * 70}px` }}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 w-10" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-100 last:border-0 align-top">
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    <input
                      type={cellType(c)}
                      className={cellInputClass}
                      placeholder={c.placeholder}
                      value={row[c.key] ?? ''}
                      onChange={(e) => updateCell(rowIdx, c.key, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIdx)}
                    className="text-slate-300 hover:text-rose-500 transition-colors text-lg leading-none font-bold"
                    aria-label={`Remove row ${rowIdx + 1}`}
                    title="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-accent hover:text-accent active:scale-95"
      >
        <span className="text-sm leading-none">＋</span> {field.addRowLabel ?? 'Add Row'}
      </button>
    </div>
  )
}

export function Field({ field, error, value }: Props) {
  const { register } = useFormContext()
  const describedBy = error ? `${field.name}-error` : undefined

  const labelEl = (
    <label htmlFor={field.name} className="block text-sm font-semibold text-slate-800 tracking-tight">
      {field.label}
      {field.required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )

  let control: React.ReactNode

  if (field.type === 'table') {
    control = <TableField field={field} />
  } else if (field.type === 'textarea') {
    control = (
      <textarea
        id={field.name}
        rows={3}
        className={inputClass}
        placeholder={field.placeholder}
        aria-describedby={describedBy}
        {...register(field.name)}
      />
    )
  } else if (field.type === 'yesno') {
    control = (
      <div className="mt-2 flex rounded-xl border border-slate-200/80 p-1 bg-slate-50 w-fit gap-1 shadow-inner">
        {['Yes', 'No'].map((opt) => {
          const isSelected = value === opt
          return (
            <label
              key={opt}
              className={`flex items-center justify-center px-6 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'bg-white shadow text-navy font-bold ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <input
                type="radio"
                value={opt}
                className="sr-only"
                {...register(field.name)}
              />
              {opt}
            </label>
          )
        })}
      </div>
    )
  } else if (field.type === 'radio') {
    const options = [...(field.options ?? [])]
    control = (
      <div className="mt-2 flex flex-col gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'border-accent bg-accent/[0.03] ring-1 ring-accent text-navy shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:shadow-sm'
              }`}
            >
              <input
                type="radio"
                value={opt.value}
                className="mt-0.5 h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                {...register(field.name)}
              />
              <span className="text-sm font-semibold leading-tight">{opt.label}</span>
            </label>
          )
        })}
        {field.allowOther && (
          <div className="flex flex-col gap-2">
            <label
              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                value === OTHER_VALUE
                  ? 'border-accent bg-accent/[0.03] ring-1 ring-accent text-navy shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:shadow-sm'
              }`}
            >
              <input
                type="radio"
                value={OTHER_VALUE}
                className="h-4 w-4 text-accent border-slate-300 focus:ring-accent cursor-pointer"
                {...register(field.name)}
              />
              <span className="text-sm font-semibold leading-tight">Other</span>
            </label>
            {value === OTHER_VALUE && (
              <input
                type="text"
                className={inputClass}
                placeholder="Please specify"
                {...register(otherFieldName(field.name))}
              />
            )}
          </div>
        )}
      </div>
    )
  } else {
    const type =
      field.type === 'tel'
        ? 'tel'
        : field.type === 'email'
        ? 'email'
        : field.type === 'date'
        ? 'date'
        : 'text'
    control = (
      <input
        id={field.name}
        type={type}
        className={inputClass}
        placeholder={field.placeholder}
        aria-describedby={describedBy}
        {...register(field.name)}
      />
    )
  }

  return (
    <div className="group/field transition-all duration-150">
      {labelEl}
      {field.help && <p className="mt-1 text-xs text-slate-400 font-medium">{field.help}</p>}
      {control}
      {error && (
        <p id={describedBy} className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-rose-600 animate-pulse" />
          {error}
        </p>
      )}
    </div>
  )
}
