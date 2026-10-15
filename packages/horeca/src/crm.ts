import type { CatalogArticle } from './catalog'
import type { InviaDistintaPayload } from './distinta'

/**
 * Read access to the user's CRM (`crm_donà`, Supabase): sign-in and the article catalog. Same
 * requests as the Rust CAD (`horeca-cad-crm/crates/crm/src/client.rs`). Plain `fetch`, no SDK.
 * The address and the public key come from configuration, never from code (CLAUDE.md, rule 5).
 */

export type CrmConfig = { url: string; key: string }

export type CrmSession = {
  access_token: string
  refresh_token: string
  /** Unix seconds. */
  expires_at: number
  email: string
}

type Options = { fetchImpl?: typeof fetch; now?: number }

const PAGE = 1000
const ITEM_FIELDS = 'id,code,name,width_mm,depth_mm,height_mm,category_id,active,updated_at'

/** The configured CRM, or null when this installation has none. */
export function crmConfigFromEnv(): CrmConfig | null {
  // Spelled out so Next.js inlines them in the browser bundle.
  const url = process.env.NEXT_PUBLIC_CRM_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_CRM_SUPABASE_KEY ?? ''
  return url && key ? { url, key } : null
}

export class CrmError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rejected' | 'server' | 'network',
  ) {
    super(message)
  }
}

const base = (config: CrmConfig) => config.url.replace(/\/+$/, '')
const nowSeconds = (options: Options) => options.now ?? Math.floor(Date.now() / 1000)

async function send(
  config: CrmConfig,
  path: string,
  init: {
    method?: string
    token?: string
    body?: unknown
    raw?: { data: Blob; type: string }
    headers?: Record<string, string>
  },
  options: Options,
): Promise<Response> {
  const headers: Record<string, string> = { apikey: config.key, ...init.headers }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init.raw) headers['Content-Type'] = init.raw.type
  const body = init.raw
    ? init.raw.data
    : init.body !== undefined
      ? JSON.stringify(init.body)
      : undefined
  try {
    return await (options.fetchImpl ?? fetch)(`${base(config)}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(body !== undefined ? { body } : {}),
    })
  } catch {
    throw new CrmError('Il CRM non risponde: controlla la connessione.', 'network')
  }
}

async function messageOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const text = body?.error_description ?? body?.msg ?? body?.message ?? body?.error
  return typeof text === 'string' && text ? text : `errore ${response.status}`
}

async function token(
  config: CrmConfig,
  grant: 'password' | 'refresh_token',
  body: Record<string, string>,
  options: Options,
): Promise<CrmSession> {
  const response = await send(
    config,
    `/auth/v1/token?grant_type=${grant}`,
    { method: 'POST', body },
    options,
  )
  if (response.status === 400 || response.status === 401) {
    const message = await messageOf(response)
    throw new CrmError(
      /invalid login/i.test(message)
        ? 'Email o password sbagliate.'
        : `Accedi di nuovo (${message}).`,
      'auth',
    )
  }
  if (!response.ok)
    throw new CrmError(`Il CRM ha risposto: ${await messageOf(response)}.`, 'server')
  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    user?: { email?: string }
  }
  if (!data.access_token) throw new CrmError('Il CRM non ha dato una sessione.', 'server')
  const expiresIn = Math.min(Math.max(data.expires_in ?? 3600, 60), 86_400)
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? '',
    expires_at: nowSeconds(options) + expiresIn,
    email: data.user?.email ?? '',
  }
}

/** Sign in with the CRM user's email and password. The password is used once and not kept. */
export function crmLogin(
  config: CrmConfig,
  email: string,
  password: string,
  options: Options = {},
) {
  return token(config, 'password', { email: email.trim(), password }, options)
}

type AuthedInit = Omit<Parameters<typeof send>[2], 'token'>

/**
 * An authenticated request: refreshes a session that expires within a minute, and after a 401
 * refreshes and retries once. Returns the session in use, which may be new, and the response.
 */
async function authed(
  config: CrmConfig,
  session: CrmSession,
  path: string,
  init: AuthedInit,
  options: Options,
): Promise<{ session: CrmSession; response: Response }> {
  let current = session
  const refresh = () =>
    token(config, 'refresh_token', { refresh_token: current.refresh_token }, options)
  if (current.expires_at <= nowSeconds(options) + 60) current = await refresh()
  let response = await send(config, path, { ...init, token: current.access_token }, options)
  if (response.status === 401) {
    current = await refresh()
    response = await send(config, path, { ...init, token: current.access_token }, options)
    if (response.status === 401) throw new CrmError('Sessione scaduta: accedi di nuovo.', 'auth')
  }
  return { session: current, response }
}

/** An authenticated GET of JSON. */
async function authedGet(
  config: CrmConfig,
  session: CrmSession,
  path: string,
  options: Options,
): Promise<{ session: CrmSession; data: unknown }> {
  const { session: current, response } = await authed(config, session, path, {}, options)
  if (response.status === 403) throw new CrmError(await messageOf(response), 'auth')
  if (!response.ok)
    throw new CrmError(`Il CRM ha risposto: ${await messageOf(response)}.`, 'server')
  return { session: current, data: await response.json() }
}

type CrmItem = {
  id: string
  code: string | null
  name: string | null
  width_mm: number | null
  depth_mm: number | null
  height_mm: number | null
  category_id: string | null
  active: boolean
  updated_at: string
}

export type CrmCatalogDelta = {
  /** Active articles to add or update. */
  upserts: CatalogArticle[]
  /** CRM ids to drop: deactivated or deleted in the CRM. */
  removed: string[]
  /** Pass back as `since` on the next sync. */
  since: string | null
  /** True for a first (full) sync: CRM articles missing from it are stale. */
  full: boolean
  session: CrmSession
}

/** Read the CRM catalog: everything when `since` is null, else what changed after it. */
export async function fetchCrmCatalog(
  config: CrmConfig,
  session: CrmSession,
  since: string | null,
  options: Options = {},
): Promise<CrmCatalogDelta> {
  let current = session
  const get = async (path: string) => {
    const result = await authedGet(config, current, path, options)
    current = result.session
    return result.data
  }

  const categories = (await get('/rest/v1/catalog_categories?select=id,name&limit=10000')) as {
    id: string
    name: string
  }[]
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : ''
  const items: CrmItem[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = (await get(
      `/rest/v1/catalog_items?select=${ITEM_FIELDS}&order=updated_at.asc,id.asc&limit=${PAGE}&offset=${offset}${filter}`,
    )) as CrmItem[]
    items.push(...page)
    if (page.length < PAGE) break
  }

  const removed = items.filter((i) => !i.active).map((i) => i.id)
  if (since) {
    for (let offset = 0; ; offset += PAGE) {
      const page = (await get(
        `/rest/v1/deleted_rows?select=row_id&table_name=eq.catalog_items&deleted_at=gt.${encodeURIComponent(since)}&order=deleted_at.asc,row_id.asc&limit=${PAGE}&offset=${offset}`,
      )) as { row_id: string }[]
      removed.push(...page.map((r) => r.row_id))
      if (page.length < PAGE) break
    }
  }

  const upserts = items
    .filter((i) => i.active && (i.code ?? '').trim())
    .map(
      (i): CatalogArticle => ({
        item_id: i.id.toLowerCase(),
        code: (i.code ?? '').trim(),
        name: (i.name ?? '').trim(),
        category: i.category_id ? (categoryName.get(i.category_id) ?? '') : '',
        width_mm: i.width_mm,
        depth_mm: i.depth_mm,
        height_mm: i.height_mm,
        source: 'crm',
      }),
    )
  const latest = items.reduce<string | null>(
    (max, i) => (max === null || i.updated_at > max ? i.updated_at : max),
    since,
  )
  return { upserts, removed, since: latest, full: since === null, session: current }
}

/** Apply a delta to the local catalog: CRM articles by id; articles from files are untouched. */
export function mergeCrmCatalog(
  articles: readonly CatalogArticle[],
  delta: Pick<CrmCatalogDelta, 'upserts' | 'removed'> & { full?: boolean },
): CatalogArticle[] {
  const gone = new Set(delta.removed)
  const updated = new Map(delta.upserts.map((a) => [a.item_id, a]))
  const kept = articles.filter((a) => {
    if (a.source !== 'crm') return true
    if (delta.full) return false
    return !gone.has(a.item_id) && !updated.has(a.item_id)
  })
  return [...kept, ...delta.upserts]
}

export type CrmAccount = { id: string; name: string; city: string | null }
export type CrmDeal = { id: string; title: string; stage_name: string | null }

/** Customers whose name contains `query` (the CRM's own row rules limit them to the user's company). */
export async function searchCrmAccounts(
  config: CrmConfig,
  session: CrmSession,
  query: string,
  options: Options = {},
): Promise<{ session: CrmSession; accounts: CrmAccount[] }> {
  // PostgREST reads * , ( ) inside a filter value as syntax.
  const q = query
    .replace(/[*,()]/g, ' ')
    .trim()
    .slice(0, 60)
  const { session: current, data } = await authedGet(
    config,
    session,
    `/rest/v1/accounts?select=id,name,city&name=ilike.${encodeURIComponent(`*${q}*`)}&order=name&limit=20`,
    options,
  )
  return { session: current, accounts: data as CrmAccount[] }
}

/** The customer's open deals, newest first. */
export async function openCrmDeals(
  config: CrmConfig,
  session: CrmSession,
  accountId: string,
  options: Options = {},
): Promise<{ session: CrmSession; deals: CrmDeal[] }> {
  const { session: current, data } = await authedGet(
    config,
    session,
    `/rest/v1/v_deals?select=id,title,stage_name&account_id=eq.${encodeURIComponent(accountId)}&outcome=eq.open&order=created_at.desc&limit=50`,
    options,
  )
  return { session: current, deals: data as CrmDeal[] }
}

export type InviaDistintaResult = {
  /** False when the CRM already had this very distinta for this deal. */
  changed: boolean
  /** Where the plan picture goes in the `crm-files` bucket. */
  preview_path: string
  /** Article ids the CRM catalog does not have (or has switched off). */
  non_trovati: string[]
}

/** `rpc('invia_distinta', { p })`. Refusals come back with the CRM's own words. */
export async function sendDistinta(
  config: CrmConfig,
  session: CrmSession,
  payload: InviaDistintaPayload,
  options: Options = {},
): Promise<{ session: CrmSession; result: InviaDistintaResult }> {
  const { session: current, response } = await authed(
    config,
    session,
    '/rest/v1/rpc/invia_distinta',
    { method: 'POST', body: { p: payload } },
    options,
  )
  if (response.status === 400 || response.status === 404)
    throw new CrmError(`Il CRM ha rifiutato la distinta: ${await messageOf(response)}.`, 'rejected')
  if (response.status === 403) throw new CrmError(await messageOf(response), 'auth')
  if (!response.ok)
    throw new CrmError(`Il CRM ha risposto: ${await messageOf(response)}.`, 'server')
  const data = (await response.json()) as Partial<InviaDistintaResult>
  return {
    session: current,
    result: {
      changed: data.changed === true,
      preview_path: typeof data.preview_path === 'string' ? data.preview_path : '',
      non_trovati: Array.isArray(data.non_trovati) ? data.non_trovati.map(String) : [],
    },
  }
}

/** Upload (or replace) the plan picture at the path `invia_distinta` returned. */
export async function uploadCrmPreview(
  config: CrmConfig,
  session: CrmSession,
  path: string,
  png: Blob,
  options: Options = {},
): Promise<CrmSession> {
  const clean = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  const { session: current, response } = await authed(
    config,
    session,
    `/storage/v1/object/crm-files/${clean}`,
    { method: 'POST', raw: { data: png, type: 'image/png' }, headers: { 'x-upsert': 'true' } },
    options,
  )
  if (!response.ok)
    throw new CrmError(
      `Immagine della pianta non caricata: ${await messageOf(response)}.`,
      'server',
    )
  return current
}
