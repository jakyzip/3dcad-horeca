'use client'

import { nodeRegistry, useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import { type CatalogArticle, parseCatalogFile } from './catalog'
import { categoryKey, placementFor, shapeForCategory, useHorecaCatalog } from './catalog-store'
import { crmConfigFromEnv } from './crm'
import { EQUIPMENT_KINDS } from './definitions'
import {
  buildDistinta,
  type Distinta,
  type DistintaNode,
  type DistintaRow,
  distintaCsv,
  distintaHash,
} from './distinta'

function armTool(kind: string, defaults: Record<string, unknown> | null = null) {
  const editor = useEditor.getState()
  useViewer.getState().setSelection({ selectedIds: [], zoneId: null })
  editor.setPhase('building')
  editor.setCatalogCategory(null)
  editor.setToolDefaults(kind, defaults)
  editor.setMode('build')
  editor.setTool(kind)
}

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The scene's distinta as JSON in the CRM's `invia_distinta` shape. The drawing, customer and deal
 * ids come with the CRM link (phase 4); until then they are left out. Local articles are not sent.
 */
async function distintaJson(distinta: Distinta, name: string): Promise<string> {
  const items = distinta.rows
  return `${JSON.stringify({ schema: 1, name, items_hash: await distintaHash(items), items }, null, 2)}\n`
}

const kindLabel = (kind: string) => nodeRegistry.get(kind)?.presentation?.label ?? kind

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const INPUT =
  'h-8 w-full rounded-md border border-border/60 bg-background px-2 text-foreground text-xs outline-none focus:border-ring'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'

function CatalogSection() {
  const articles = useHorecaCatalog((s) => s.articles)
  const shapes = useHorecaCatalog((s) => s.shapes)
  const [query, setQuery] = useState('')
  const [report, setReport] = useState<{ added: number; errors: string[] } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { articles: read, errors } = parseCatalogFile(file.name, await file.text())
    if (read.length > 0) useHorecaCatalog.getState().importArticles(read)
    setReport({ added: read.length, errors })
  }

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (a: CatalogArticle) =>
      words.every((w) => `${a.code} ${a.name} ${a.category}`.toLowerCase().includes(w))
    return articles.filter(matches).slice(0, 100)
  }, [articles, query])

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Catalogo</h3>
      <input
        accept=".csv,.json,text/csv,application/json"
        className="hidden"
        onChange={onFile}
        ref={fileInput}
        type="file"
      />
      <button className={BUTTON} onClick={() => fileInput.current?.click()} type="button">
        Importa catalogo da file (CSV o JSON)
      </button>
      {report && (
        <div className="flex flex-col gap-1 text-xs">
          <p className="opacity-80">
            {report.added} articoli importati
            {report.errors.length > 0 ? `, ${report.errors.length} righe scartate:` : '.'}
          </p>
          {report.errors.length > 0 && (
            <ul className="max-h-24 overflow-y-auto text-amber-500">
              {report.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {articles.length === 0 ? (
        <p className="text-xs opacity-60">
          Nessun articolo. Il file deve avere almeno la colonna "codice"; le altre colonne
          riconosciute sono nome, categoria, larghezza_mm, profondita_mm, altezza_mm e id_crm.
        </p>
      ) : (
        <>
          <input
            className={INPUT}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={`Cerca tra ${articles.length} articoli`}
            value={query}
          />
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {visible.map((article) => {
              const kind = shapeForCategory(shapes, article.category)
              const size = [article.width_mm, article.depth_mm, article.height_mm]
                .map((mm) => (mm === null ? '?' : Math.round(mm / 10)))
                .join('×')
              return (
                <li key={`${article.source}:${article.code}`}>
                  <button
                    className="flex w-full flex-col rounded-md border border-border/40 px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => {
                      const placement = placementFor(article, shapes)
                      armTool(placement.kind, placement.defaults)
                    }}
                    title={`Piazza come ${kindLabel(kind)}`}
                    type="button"
                  >
                    <span className="font-medium">
                      <span className="font-mono">{article.code}</span> {article.name}
                    </span>
                    <span className="opacity-60">
                      {article.category || 'Senza categoria'} · {size} cm · {kindLabel(kind)}
                      {article.item_id ? '' : ' · non nel CRM'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function CrmSection() {
  const config = useMemo(crmConfigFromEnv, [])
  const session = useHorecaCatalog((s) => s.crmSession)
  const syncedAt = useHorecaCatalog((s) => s.crmSyncedAt)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  if (!config) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className={HEADING}>CRM</h3>
        <p className="text-xs opacity-60">
          CRM non configurato: servono NEXT_PUBLIC_CRM_SUPABASE_URL e NEXT_PUBLIC_CRM_SUPABASE_KEY
          in .env.local.
        </p>
      </section>
    )
  }

  const run = async (task: () => Promise<string>) => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ text: await task(), error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    } finally {
      setBusy(false)
    }
  }
  const sync = async () => {
    const { updated, removed } = await useHorecaCatalog.getState().crmSync(config)
    return `Catalogo aggiornato: ${updated} articoli nuovi o cambiati, ${removed} tolti.`
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>CRM</h3>
      {session ? (
        <>
          <p className="text-xs opacity-80">Connesso come {session.email || 'utente del CRM'}.</p>
          <div className="flex gap-2">
            <button className={BUTTON} disabled={busy} onClick={() => run(sync)} type="button">
              {busy ? 'Aggiorno…' : 'Aggiorna catalogo dal CRM'}
            </button>
            <button
              className={BUTTON}
              disabled={busy}
              onClick={() => useHorecaCatalog.getState().crmSignOut()}
              type="button"
            >
              Esci
            </button>
          </div>
          {syncedAt && (
            <p className="text-xs opacity-60">
              Ultimo aggiornamento: {new Date(syncedAt).toLocaleString('it-IT')}
            </p>
          )}
        </>
      ) : (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await useHorecaCatalog.getState().crmSignIn(config, email, password)
              setPassword('')
              return sync()
            })
          }}
        >
          <input
            autoComplete="username"
            className={INPUT}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Email del CRM"
            type="email"
            value={email}
          />
          <input
            autoComplete="current-password"
            className={INPUT}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Password"
            type="password"
            value={password}
          />
          <button className={BUTTON} disabled={busy || !email || !password} type="submit">
            {busy ? 'Accesso…' : 'Accedi e scarica il catalogo'}
          </button>
        </form>
      )}
      {message && (
        <p className={message.error ? 'text-amber-500 text-xs' : 'text-xs opacity-80'}>
          {message.text}
        </p>
      )}
    </section>
  )
}

function ShapesSection() {
  const articles = useHorecaCatalog((s) => s.articles)
  const shapes = useHorecaCatalog((s) => s.shapes)
  const categories = useMemo(() => {
    const byKey = new Map<string, string>()
    for (const a of articles) {
      const key = categoryKey(a.category)
      if (key && !byKey.has(key)) byKey.set(key, a.category.trim())
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'it'))
  }, [articles])
  if (categories.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Forma per categoria</h3>
      {categories.map((category) => (
        <label className="flex items-center justify-between gap-2 text-xs" key={category}>
          <span className="truncate" title={category}>
            {category}
          </span>
          <select
            className="h-7 max-w-[55%] rounded-md border border-border/60 bg-background px-1 text-foreground text-xs"
            onChange={(event) => useHorecaCatalog.getState().setShape(category, event.target.value)}
            value={shapeForCategory(shapes, category)}
          >
            {EQUIPMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
      ))}
    </section>
  )
}

function DistintaRows({ rows, local }: { rows: DistintaRow[]; local?: boolean }) {
  return (
    <>
      {rows.map((row) => (
        <tr className="border-border/40 border-t" key={`${row.item_id}:${row.code}`}>
          <td className="py-1 pr-2 font-mono">{row.code || '—'}</td>
          <td className="py-1 pr-2">
            {row.name || '—'}
            {local && <span className="text-amber-500"> · non nel CRM</span>}
          </td>
          <td className="py-1 text-right tabular-nums">{row.quantity}</td>
        </tr>
      ))}
    </>
  )
}

function DistintaSection() {
  const nodes = useScene((s) => s.nodes)
  const distinta = useMemo(
    () => buildDistinta(nodes as unknown as Record<string, DistintaNode>),
    [nodes],
  )
  const empty = distinta.rows.length === 0 && distinta.local.length === 0
  const name = 'distinta'

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Distinta</h3>
      {empty ? (
        <p className="text-xs opacity-60">
          Nessun articolo. Inserisci un articolo dal catalogo, oppure piazza un’attrezzatura e
          compila codice e articolo nell’inspector.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left opacity-60">
              <th className="py-1 font-normal">Codice</th>
              <th className="py-1 font-normal">Articolo</th>
              <th className="py-1 text-right font-normal">Q.tà</th>
            </tr>
          </thead>
          <tbody>
            <DistintaRows rows={distinta.rows} />
            <DistintaRows local rows={distinta.local} />
          </tbody>
        </table>
      )}
      {distinta.local.length > 0 && (
        <p className="text-amber-500 text-xs">
          Gli articoli non nel CRM sono nel CSV e nel PDF, ma non nel JSON per il CRM.
        </p>
      )}
      {distinta.invalid > 0 && (
        <p className="text-amber-500 text-xs">
          {distinta.invalid} elementi hanno un ID CRM non valido e non sono contati.
        </p>
      )}
      <div className="flex gap-2">
        <button
          className={BUTTON}
          disabled={empty}
          onClick={() => download(`${name}.csv`, 'text/csv;charset=utf-8', distintaCsv(distinta))}
          type="button"
        >
          Scarica CSV
        </button>
        <button
          className={BUTTON}
          disabled={distinta.rows.length === 0}
          onClick={async () =>
            download(`${name}.json`, 'application/json', await distintaJson(distinta, name))
          }
          type="button"
        >
          Scarica JSON
        </button>
      </div>
    </section>
  )
}

/** Sidebar panel: catalog, shapes per category, free placement, the distinta. */
export default function HorecaPanel() {
  return (
    <div className="flex flex-col gap-5 p-3 text-sidebar-foreground text-sm">
      <CrmSection />
      <CatalogSection />
      <ShapesSection />
      <section className="flex flex-col gap-2">
        <h3 className={HEADING}>Attrezzature senza articolo</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {EQUIPMENT_KINDS.map((kind) => {
            const presentation = nodeRegistry.get(kind)?.presentation
            return (
              <button
                className={`${BUTTON} flex items-center gap-2 text-left`}
                key={kind}
                onClick={() => armTool(kind)}
                type="button"
              >
                {presentation?.icon.kind === 'url' && (
                  <img alt="" className="h-5 w-5" src={presentation.icon.src} />
                )}
                <span className="truncate">{presentation?.label ?? kind}</span>
              </button>
            )
          })}
        </div>
      </section>
      <DistintaSection />
    </div>
  )
}
