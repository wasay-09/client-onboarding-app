import { useEffect, useRef, useState } from 'react'

// A draw-or-type signature pad. Both modes produce a PNG data URL so the rest of
// the app (and the PDF) treats the signature uniformly as an image — no special
// fonts to register on the PDF side. The legal "intent to sign" is still the
// checkbox next to this control; the image is the visible mark (ESIGN/UETA).

interface Props {
  /** Current signature as a PNG data URL ('' when none). */
  value: string
  onChange: (dataUrl: string) => void
  /** Drives the "Type" mode rendering — typically the signer's typed legal name. */
  typedName: string
}

// Internal canvas resolution (2× the ~520×150 display size for crisp export).
const CW = 1040
const CH = 300

export function SignaturePad({ value, onChange, typedName }: Props) {
  const [mode, setMode] = useState<'type' | 'draw'>('type')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const inked = useRef(false)
  // Keep onChange stable for the effect below (parent passes a fresh closure each render).
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // One-time canvas setup (sizing resets context state, so configure strokes here).
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = CW
    c.height = CH
    const g = c.getContext('2d')!
    g.lineWidth = 4.5
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#0f172a'
  }, [])

  const drawTyped = (text: string) => {
    const c = canvasRef.current
    if (!c) return
    const g = c.getContext('2d')!
    g.clearRect(0, 0, c.width, c.height)
    if (text.trim()) {
      g.fillStyle = '#0f172a'
      g.font = "italic 120px 'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive"
      g.textBaseline = 'middle'
      g.fillText(text.trim(), 36, CH / 2)
      inked.current = true
    } else {
      inked.current = false
    }
  }

  // Render the typed name as the signature whenever we're in Type mode or it changes.
  useEffect(() => {
    if (mode !== 'type') return
    drawTyped(typedName)
    onChangeRef.current(typedName.trim() ? canvasRef.current!.toDataURL('image/png') : '')
  }, [mode, typedName])

  const posOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return
    e.preventDefault()
    drawing.current = true
    last.current = posOf(e)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || mode !== 'draw') return
    e.preventDefault()
    const g = canvasRef.current!.getContext('2d')!
    const p = posOf(e)
    g.beginPath()
    g.moveTo(last.current!.x, last.current!.y)
    g.lineTo(p.x, p.y)
    g.stroke()
    last.current = p
    inked.current = true
  }
  const onUp = () => {
    if (mode !== 'draw' || !drawing.current) return
    drawing.current = false
    last.current = null
    if (inked.current) onChange(canvasRef.current!.toDataURL('image/png'))
  }

  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    inked.current = false
    onChange('')
  }

  const pickMode = (m: 'type' | 'draw') => {
    if (m === mode) return
    setMode(m)
    if (m === 'draw') clear() // start from a blank pad; the type effect handles 'type'
  }

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      active ? 'bg-white shadow text-navy ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'
    }`

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200/80 p-1 bg-slate-50 w-fit gap-1 shadow-inner">
          <button type="button" onClick={() => pickMode('type')} className={tabClass(mode === 'type')}>Type</button>
          <button type="button" onClick={() => pickMode('draw')} className={tabClass(mode === 'draw')}>Draw</button>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="relative mt-2 rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className={`block w-full h-[150px] touch-none ${mode === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
        />
        {/* Baseline guide (CSS only — not part of the exported image) */}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-slate-200" />
        {!value && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-slate-300">
            {mode === 'draw' ? 'Draw your signature above' : 'Type your name above to generate a signature'}
          </span>
        )}
      </div>
    </div>
  )
}
