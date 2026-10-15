'use client'

import { useEffect, useState } from 'react'
import {
  idProgettoDaUrl,
  nomeFile,
  type RenderSalvato,
  useHorecaRenders,
  zipDeiRender,
} from './render-archivio'
import { RENDER_WIDTHS, requestRender } from './render-store'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const ICON_BUTTON =
  'flex h-6 min-w-6 items-center justify-center rounded bg-black/60 px-1 text-[11px] text-white hover:bg-black/80'

function Miniatura({ render, index }: { render: RenderSalvato; index: number }) {
  const url = useHorecaRenders((s) => s.urls[render.id])
  const { elimina, setNellaTavola } = useHorecaRenders.getState()
  return (
    <li className="relative overflow-hidden rounded-md border border-border/60">
      <a href={url} rel="noreferrer" target="_blank" title="Apri a tutta grandezza">
        <img
          alt={`Render ${index + 1}`}
          className="aspect-video w-full bg-black/20 object-cover"
          src={url}
        />
      </a>
      <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[11px] text-white">
        {index + 1}
      </span>
      <div className="absolute top-1 right-1 flex gap-1">
        <button
          className={ICON_BUTTON}
          onClick={() => download(render.png, nomeFile(index))}
          title="Scarica"
          type="button"
        >
          ↓
        </button>
        <button
          className={ICON_BUTTON}
          onClick={() => elimina(render.id)}
          title="Elimina"
          type="button"
        >
          ✕
        </button>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 px-1.5 py-1 text-[11px]">
        <input
          checked={render.nellaTavola}
          onChange={(e) => setNellaTavola(render.id, e.target.checked)}
          type="checkbox"
        />
        Nella tavola
      </label>
    </li>
  )
}

/** The project's renders: kept here, downloaded together, chosen for the customer's sheet. */
function Galleria() {
  const renders = useHorecaRenders((s) => s.renders)
  const error = useHorecaRenders((s) => s.error)
  const [busy, setBusy] = useState(false)
  if (!renders.length && !error) return null

  const scaricaTutti = async () => {
    setBusy(true)
    try {
      download(await zipDeiRender(renders), 'render.zip')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {renders.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-1.5">
            {renders.map((r, i) => (
              <Miniatura index={i} key={r.id} render={r} />
            ))}
          </ul>
          <div className="flex gap-2">
            <button className={BUTTON} disabled={busy} onClick={scaricaTutti} type="button">
              {busy ? 'Preparo lo zip…' : `Scarica tutti (${renders.length})`}
            </button>
            <button
              className={BUTTON}
              onClick={() => {
                if (
                  window.confirm(`Eliminare tutti i ${renders.length} render di questo progetto?`)
                )
                  useHorecaRenders.getState().svuota()
              }}
              type="button"
            >
              Elimina tutti
            </button>
          </div>
        </>
      )}
      {error && <p className="text-amber-500 text-xs">{error}</p>}
    </div>
  )
}

/** The 3D view as a picture: framed by the user, drawn bigger, without editing aids. */
export function RenderSection() {
  const [width, setWidth] = useState(RENDER_WIDTHS[0]!.width)
  const [withLabels, setWithLabels] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    useHorecaRenders.getState().carica(idProgettoDaUrl())
  }, [])

  const render = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await useHorecaRenders.getState().aggiungi(await requestRender(width, withLabels))
      setMessage({
        text: 'Render aggiunto qui sotto. Cambia inquadratura e rifallo per averne altri.',
        error: false,
      })
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
        griglia, guide e selezione. I render restano qui, in questo progetto: scaricali quando vuoi,
        e quelli segnati “Nella tavola” finiscono nel PDF per il cliente.
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
        {busy ? 'Render in corso…' : 'Fai un render'}
      </button>
      {message && (
        <p className={`text-xs ${message.error ? 'text-amber-500' : 'opacity-80'}`}>
          {message.text}
        </p>
      )}
      <Galleria />
    </section>
  )
}
