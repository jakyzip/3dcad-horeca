'use client'

import { type AnyNode, type AnyNodeId, getLevelDisplayName, useScene } from '@pascal-app/core'
import { exportSheetsToPdf, resolveSheetRotationDeg } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { riepilogoImpianti } from './allacciamenti'
import { crmLinkHostId, readCrmLink } from './crm-link'
import { EQUIPMENT_KINDS } from './definitions'
import { buildDistinta, type DistintaNode } from './distinta'
import { logoDataUrl, useHorecaIntestazione } from './intestazione-store'
import { levelPlanEntries } from './plan-entries'
import { idProgettoDaUrl, useHorecaRenders } from './render-archivio'
import { requestRender, useHorecaRender } from './render-store'
import { type FormatoTavola, type Intestazione, tavolaPages } from './tavola'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const INPUT =
  'h-8 w-full rounded-md border border-border/60 bg-background px-2 text-foreground text-xs outline-none focus:border-ring'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'

/** Per-project sheet data (customer when not linked to the CRM, revision), on the site. */
export const TAVOLA_METADATA_KEY = 'tavola'
type DatiTavola = { cliente?: string; revisione?: number }

const readTavola = (metadata: unknown): DatiTavola => {
  const raw = (metadata as Record<string, unknown> | undefined)?.[TAVOLA_METADATA_KEY]
  if (!raw || typeof raw !== 'object') return {}
  const v = raw as Record<string, unknown>
  return {
    cliente: typeof v.cliente === 'string' ? v.cliente : undefined,
    revisione: typeof v.revisione === 'number' ? v.revisione : undefined,
  }
}

const RENDER_TIMEOUT_MS = 30_000

const dataUrlOf = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** A render of the current 3D view as a data URL with its proportions; null when the view can't make one. */
async function renderPerTavola(): Promise<{ dataUrl: string; aspect: number } | null> {
  const blob = await Promise.race([
    requestRender(1920, false),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), RENDER_TIMEOUT_MS)),
  ])
  if (!blob) {
    // The 3D view never picked the request up (e.g. hidden): drop it so the next render can run.
    useHorecaRender.setState({ request: null })
    return null
  }
  const dataUrl = await dataUrlOf(blob)
  const bitmap = await createImageBitmap(blob)
  const aspect = bitmap.width / bitmap.height
  bitmap.close()
  return { dataUrl, aspect }
}

const FIELDS: ReadonlyArray<{ key: Exclude<keyof Intestazione, 'logo'>; label: string }> = [
  { key: 'nome', label: 'Nome dell’azienda' },
  { key: 'indirizzo', label: 'Indirizzo' },
  { key: 'telefono', label: 'Telefono' },
  { key: 'email', label: 'Email' },
  { key: 'piva', label: 'Partita IVA' },
]

/** The company's data and logo, kept on this computer. */
function IntestazioneEditor() {
  const intestazione = useHorecaIntestazione((s) => s.intestazione)
  const set = useHorecaIntestazione((s) => s.set)
  const [error, setError] = useState<string | null>(null)

  const onLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      set({ logo: await logoDataUrl(file) })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {FIELDS.map(({ key, label }) => (
        <input
          className={INPUT}
          key={key}
          onChange={(e) => set({ [key]: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={label}
          value={intestazione[key]}
        />
      ))}
      <div className="flex items-center gap-2">
        {intestazione.logo && (
          <img alt="Logo" className="h-8 max-w-24 object-contain" src={intestazione.logo} />
        )}
        <label className={`${BUTTON} flex cursor-pointer items-center`}>
          {intestazione.logo ? 'Cambia logo' : 'Carica il logo'}
          <input
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={onLogo}
            type="file"
          />
        </label>
        {intestazione.logo && (
          <button
            className="underline opacity-70"
            onClick={() => set({ logo: null })}
            type="button"
          >
            Togli
          </button>
        )}
      </div>
      {error && <p className="text-amber-500">{error}</p>}
    </div>
  )
}

/** The customer's sheet: plan, render, equipment and services under the title block, as a PDF. */
export function TavolaSection() {
  const nodes = useScene((s) => s.nodes) as Record<string, AnyNode>
  const levelId = useViewer((s) => s.selection.levelId)
  const hostId = useMemo(() => crmLinkHostId(nodes), [nodes])
  const host = hostId ? nodes[hostId] : undefined
  const dati = readTavola(host?.metadata)
  const link = readCrmLink(host?.metadata)
  const [formato, setFormato] = useState<FormatoTavola>('A3')
  const [conRender, setConRender] = useState(true)
  const [aperta, setAperta] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [progetto, setProgetto] = useState('')
  const renders = useHorecaRenders((s) => s.renders)
  const scelti = useMemo(() => renders.filter((r) => r.nellaTavola), [renders])

  // The project's name lives with the saved scene, not in the drawing: ask the editor's API.
  useEffect(() => {
    const id = idProgettoDaUrl()
    useHorecaRenders.getState().carica(id)
    if (!id) return
    fetch(`/api/scenes/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((meta: { name?: string } | null) => meta?.name && setProgetto(meta.name))
      .catch(() => {})
  }, [])

  const cliente = dati.cliente ?? link?.account_name ?? ''
  const revisione = dati.revisione ?? 0
  const saveDati = (patch: DatiTavola) => {
    if (!hostId) return
    useScene.getState().updateNode(hostId, {
      metadata: {
        ...(host?.metadata as Record<string, unknown> | undefined),
        [TAVOLA_METADATA_KEY]: { ...dati, ...patch },
      },
    } as never)
  }

  const crea = async () => {
    if (!levelId) return
    setBusy(true)
    setMessage(null)
    try {
      const state = useScene.getState().nodes as Record<string, AnyNode>
      const entries = levelPlanEntries(levelId as AnyNodeId, false, { automaticDimensions: true })
      // The renders chosen in the gallery; without any, one of the current view if asked.
      const fresh = !scelti.length && conRender ? await renderPerTavola() : null
      const renders = scelti.length
        ? await Promise.all(
            scelti.map(async (r) => ({
              dataUrl: await dataUrlOf(r.png),
              aspect: r.width / r.height,
            })),
          )
        : fresh
          ? [fresh]
          : []
      const equipment = Object.values(state).filter((n) => EQUIPMENT_KINDS.includes(n.type))
      const distinta = buildDistinta(state as unknown as Record<string, DistintaNode>)
      const riepilogo = riepilogoImpianti(equipment as Array<{ metadata?: unknown }>)
      const level = state[levelId] as unknown as
        | Parameters<typeof getLevelDisplayName>[0]
        | undefined
      const nomeProgetto = progetto || host?.name || 'Progetto'
      const pages = tavolaPages(
        formato,
        {
          pianta: {
            model: entries.flatMap((e) => (e.model ? [e.model] : [])),
            annotations: entries.flatMap((e) => (e.annotations ? [e.annotations] : [])),
            rotationDeg: resolveSheetRotationDeg(state as never, levelId as AnyNodeId),
          },
          renders,
          elenco: [...distinta.rows, ...distinta.local],
          impianti: Object.values(riepilogo.conteggi).some((n) => n > 0) ? riepilogo : null,
        },
        useHorecaIntestazione.getState().intestazione,
        {
          progetto: nomeProgetto,
          cliente,
          data: new Intl.DateTimeFormat('it-IT').format(new Date()),
          revisione,
          piano: level ? getLevelDisplayName(level) : '',
        },
      )
      const nomeFile = `Tavola ${cliente || nomeProgetto} rev${revisione}`.replace(
        /[\\/:*?"<>|]+/g,
        '-',
      )
      await exportSheetsToPdf(pages, `${nomeFile}.pdf`, nomeProgetto)
      setMessage({
        text:
          !scelti.length && conRender && !fresh
            ? 'PDF creato, ma senza render: la vista 3D non ha risposto (prova a passare alla vista 3D).'
            : `PDF creato: ${pages.length === 1 ? '1 foglio' : `${pages.length} pagine`}.`,
        error: !scelti.length && conRender && !fresh,
      })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Tavola per il cliente</h3>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <label className="col-span-2 flex flex-col gap-0.5">
          <span className="opacity-70">Cliente{link ? ' (dal CRM, modificabile)' : ''}</span>
          <input
            className={INPUT}
            onBlur={(e) => {
              if (e.target.value !== cliente) saveDati({ cliente: e.target.value })
            }}
            onKeyDown={(e) => e.stopPropagation()}
            defaultValue={cliente}
            key={cliente}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="opacity-70">Formato</span>
          <select
            className={INPUT}
            onChange={(e) => setFormato(e.target.value as FormatoTavola)}
            value={formato}
          >
            <option value="A3">A3, pianta ed elenco in un foglio</option>
            <option value="A4">A4, una pagina per parte</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="opacity-70">Revisione</span>
          <input
            className={INPUT}
            inputMode="numeric"
            min={0}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isInteger(n) && n >= 0) saveDati({ revisione: n })
            }}
            onKeyDown={(e) => e.stopPropagation()}
            type="number"
            value={revisione}
          />
        </label>
      </div>
      {scelti.length ? (
        <p className="text-xs opacity-80">
          {scelti.length === 1
            ? 'Con 1 render della sezione Render.'
            : `Con ${scelti.length} render della sezione Render (il primo accanto alla pianta).`}
        </p>
      ) : (
        <label className="flex items-center gap-2 text-xs">
          <input
            checked={conRender}
            onChange={(e) => setConRender(e.target.checked)}
            type="checkbox"
          />
          Con un render della vista 3D attuale (inquadrala prima come vuoi)
        </label>
      )}
      <button className={BUTTON} disabled={busy || !levelId} onClick={crea} type="button">
        {busy ? 'Preparazione del PDF…' : 'Crea PDF'}
      </button>
      <button
        className="self-start text-xs underline opacity-70"
        onClick={() => setAperta(!aperta)}
        type="button"
      >
        {aperta ? 'Chiudi i dati dell’azienda' : 'Dati dell’azienda e logo'}
      </button>
      {aperta && <IntestazioneEditor />}
      {message && (
        <p className={`text-xs ${message.error ? 'text-amber-500' : 'opacity-80'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
