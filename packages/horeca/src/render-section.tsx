'use client'

import { useState } from 'react'
import { RENDER_WIDTHS, requestRender } from './render-store'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'

const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** The 3D view as a picture: framed by the user, drawn bigger, without editing aids. */
export function RenderSection() {
  const [width, setWidth] = useState(RENDER_WIDTHS[0]!.width)
  const [withLabels, setWithLabels] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const render = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const png = await requestRender(width, withLabels)
      const url = URL.createObjectURL(png)
      Object.assign(document.createElement('a'), {
        href: url,
        download: `render-${stamp()}.png`,
      }).click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage({ text: 'Render salvato.', error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Render</h3>
      <p className="text-xs opacity-60">
        Inquadra la vista 3D come vuoi l’immagine: il render la ridisegna in alta risoluzione, senza
        griglia, guide e selezione.
      </p>
      <select
        className="h-8 rounded-md border border-border/60 bg-background px-2 text-foreground text-xs"
        onChange={(e) => setWidth(Number(e.target.value))}
        value={width}
      >
        {RENDER_WIDTHS.map((r) => (
          <option key={r.width} value={r.width}>
            {r.label}
          </option>
        ))}
      </select>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          checked={withLabels}
          onChange={(e) => setWithLabels(e.target.checked)}
          type="checkbox"
        />
        Con i nomi delle attrezzature
      </label>
      <button className={BUTTON} disabled={busy} onClick={render} type="button">
        {busy ? 'Render in corso…' : 'Render (PNG)'}
      </button>
      {message && (
        <p className={`text-xs ${message.error ? 'text-amber-500' : 'opacity-80'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
