'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import { useHorecaCatalog } from './catalog-store'
import {
  type CrmAccount,
  type CrmConfig,
  type CrmDeal,
  crmConfigFromEnv,
  openCrmDeals,
  searchCrmAccounts,
  sendDistinta,
  uploadCrmPreview,
} from './crm'
import { asNewDrawing, crmLinkHostId, readCrmLink, relink, withCrmLink } from './crm-link'
import { buildDistinta, type DistintaNode, inviaDistintaPayload } from './distinta'
import { levelPlanEntries } from './plan-entries'
import { planToSvg, svgToPng } from './plan-image'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const INPUT =
  'h-8 w-full rounded-md border border-border/60 bg-background px-2 text-foreground text-xs outline-none focus:border-ring'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'
const ROW = 'w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent'

type Message = { text: string; error: boolean; details?: string[] }

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Keep the store's session in step with the one the last request used (it may be refreshed). */
const keepSession = (session: Parameters<typeof uploadCrmPreview>[1]) =>
  useHorecaCatalog.setState({ crmSession: session })

/** Choose customer and deal: a name search, then the customer's open deals. */
function LinkPicker({
  config,
  onPicked,
  onCancel,
}: {
  config: CrmConfig
  onPicked: (account: CrmAccount, deal: CrmDeal) => void
  onCancel?: () => void
}) {
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<CrmAccount[]>([])
  const [account, setAccount] = useState<CrmAccount | null>(null)
  const [deals, setDeals] = useState<CrmDeal[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search after a short pause in typing, from two letters on.
  useEffect(() => {
    if (account || query.trim().length < 2) {
      setAccounts([])
      return
    }
    let stale = false
    const timer = setTimeout(async () => {
      const session = useHorecaCatalog.getState().crmSession
      if (!session) return
      try {
        const result = await searchCrmAccounts(config, session, query)
        if (stale) return
        keepSession(result.session)
        setAccounts(result.accounts)
        setError(null)
      } catch (e) {
        if (!stale) setError(errorText(e))
      }
    }, 300)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [account, config, query])

  const pickAccount = async (picked: CrmAccount) => {
    setAccount(picked)
    setDeals(null)
    const session = useHorecaCatalog.getState().crmSession
    if (!session) return
    try {
      const result = await openCrmDeals(config, session, picked.id)
      keepSession(result.session)
      setDeals(result.deals)
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {account ? (
        <>
          <p className="text-xs">
            Cliente: <strong>{account.name}</strong>{' '}
            <button className="underline opacity-70" onClick={() => setAccount(null)} type="button">
              cambia
            </button>
          </p>
          {deals === null ? (
            <p className="text-xs opacity-60">Carico le trattative…</p>
          ) : deals.length === 0 ? (
            <p className="text-amber-500 text-xs">
              Nessuna trattativa aperta per questo cliente: creala nel CRM e riprova.
            </p>
          ) : (
            <div className="flex max-h-40 flex-col overflow-y-auto">
              <p className="text-xs opacity-60">Scegli la trattativa:</p>
              {deals.map((deal) => (
                <button
                  className={ROW}
                  key={deal.id}
                  onClick={() => onPicked(account, deal)}
                  type="button"
                >
                  {deal.title}
                  {deal.stage_name ? ` · ${deal.stage_name}` : ''}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <input
            className={INPUT}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Cerca il cliente (almeno 2 lettere)"
            value={query}
          />
          <div className="flex max-h-40 flex-col overflow-y-auto">
            {accounts.map((a) => (
              <button className={ROW} key={a.id} onClick={() => pickAccount(a)} type="button">
                {a.name}
                {a.city ? ` · ${a.city}` : ''}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="text-amber-500 text-xs">{error}</p>}
      {onCancel && (
        <button
          className="self-start text-xs underline opacity-70"
          onClick={onCancel}
          type="button"
        >
          Annulla
        </button>
      )}
    </div>
  )
}

/** The distinta to the CRM: customer and deal stored with the drawing, then one click to send. */
export function CrmSendSection() {
  const config = useMemo(crmConfigFromEnv, [])
  const session = useHorecaCatalog((s) => s.crmSession)
  const nodes = useScene((s) => s.nodes)
  const levelId = useViewer((s) => s.selection.levelId)
  const hostId = useMemo(() => crmLinkHostId(nodes), [nodes])
  const host = hostId
    ? (nodes[hostId] as { metadata?: unknown; name?: string } | undefined)
    : undefined
  const link = readCrmLink(host?.metadata)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  if (!config) return null

  const newDrawing = () => {
    if (!(hostId && link)) return
    useScene
      .getState()
      .updateNode(hostId, { metadata: withCrmLink(host?.metadata, asNewDrawing(link)) } as never)
    setConfirmNew(false)
    setMessage({
      text: 'Fatto: il prossimo invio crea un disegno nuovo nel CRM; quello di prima resta com’è.',
      error: false,
    })
  }

  const saveLink = (account: CrmAccount, deal: CrmDeal) => {
    if (!hostId) return
    const next = relink(link, account, deal)
    useScene.getState().updateNode(hostId, { metadata: withCrmLink(host?.metadata, next) } as never)
    setPicking(false)
    setMessage(null)
  }

  const send = async () => {
    if (!(link && session)) return
    setBusy(true)
    setMessage(null)
    try {
      const distinta = buildDistinta(
        useScene.getState().nodes as unknown as Record<string, DistintaNode>,
      )
      const drawingName = name.trim() || host?.name?.trim() || 'Disegno senza nome'
      const built = await inviaDistintaPayload(
        {
          drawing_id: link.drawing_id,
          name: drawingName,
          account_id: link.account_id,
          deal_id: link.deal_id,
        },
        distinta,
      )
      if (!built.ok) throw new Error(built.error)
      const sent = await sendDistinta(config, session, built.payload)
      keepSession(sent.session)
      const { changed, preview_path, non_trovati } = sent.result

      let previewNote = ''
      if (changed && preview_path && levelId) {
        // The picture is a courtesy: a failure is reported but the distinta is already sent.
        try {
          const svg = planToSvg(levelPlanEntries(levelId as AnyNodeId))
          if (svg) {
            const png = await svgToPng(svg)
            keepSession(await uploadCrmPreview(config, sent.session, preview_path, png))
          }
        } catch (e) {
          previewNote = ` Immagine della pianta non caricata (${errorText(e)}).`
        }
      }

      const byId = new Map(distinta.rows.map((r) => [r.item_id, r]))
      const missing = non_trovati.map((id) => {
        const row = byId.get(id.toLowerCase())
        return row ? `${row.code} – ${row.name}` : id
      })
      setMessage({
        text: changed
          ? `Distinta inviata: ${distinta.rows.length} righe a ${link.account_name} · ${link.deal_name}.${previewNote}`
          : 'Nessuna novità: il CRM ha già questa distinta per questa trattativa.',
        error: missing.length > 0 || previewNote !== '',
        details: missing.length
          ? [
              `${missing.length} articoli non sono nel catalogo del CRM (o sono disattivati):`,
              ...missing,
            ]
          : undefined,
      })
    } catch (e) {
      setMessage({ text: errorText(e), error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Invia al CRM</h3>
      {!session ? (
        <p className="text-xs opacity-60">Accedi al CRM qui sopra per inviare la distinta.</p>
      ) : !hostId ? (
        <p className="text-xs opacity-60">Il progetto è vuoto.</p>
      ) : picking || !link ? (
        <LinkPicker
          config={config}
          onCancel={link ? () => setPicking(false) : undefined}
          onPicked={saveLink}
        />
      ) : (
        <>
          <p className="text-xs">
            {link.account_name} · {link.deal_name}{' '}
            <button className="underline opacity-70" onClick={() => setPicking(true)} type="button">
              cambia
            </button>
          </p>
          <input
            className={INPUT}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={`Nome del disegno (${host?.name?.trim() || 'Disegno senza nome'})`}
            value={name}
          />
          <button className={BUTTON} disabled={busy} onClick={send} type="button">
            {busy ? 'Invio…' : 'Invia distinta al CRM'}
          </button>
          <p className="text-xs opacity-60">
            Senza prezzi: il preventivo si crea nel CRM. Gli articoli “non nel CRM” non vengono
            inviati.
          </p>
          {confirmNew ? (
            <div className="flex flex-col gap-1.5 text-xs">
              <p>
                Il progetto diventa un disegno nuovo nel CRM (stesso cliente e trattativa). Serve
                per una copia del progetto che non deve sovrascrivere l’originale.
              </p>
              <div className="flex gap-2">
                <button className={BUTTON} onClick={newDrawing} type="button">
                  Sì, nuovo disegno
                </button>
                <button className={BUTTON} onClick={() => setConfirmNew(false)} type="button">
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <button
              className="self-start text-xs underline opacity-70"
              onClick={() => setConfirmNew(true)}
              type="button"
            >
              Nuovo disegno nel CRM (per una copia del progetto)
            </button>
          )}
        </>
      )}
      {message && (
        <div className={`text-xs ${message.error ? 'text-amber-500' : 'opacity-80'}`}>
          <p>{message.text}</p>
          {message.details && (
            <ul className="mt-1 max-h-24 overflow-y-auto">
              {message.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
