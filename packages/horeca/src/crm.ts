import type { CatalogArticle } from './catalog'

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
  init: { method?: string; token?: string; body?: unknown },
  options: Options,
): Promise<Response> {
  const headers: Record<string, string> = { apikey: config.key }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    return await (options.fetchImpl ?? fetch)(`${base(config)}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
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

/**
 * An authenticated GET: refreshes a session that expires within a minute, and after a 401 refreshes
 * and retries once. Returns the session in use, which may be new.
 */
async function authedGet(
  config: CrmConfig,
  session: CrmSession,
  path: string,
  options: Options,
): Promise<{ session: CrmSession; data: unknown }> {
  let current = session
  if (current.expires_at <= nowSeconds(options) + 60) {
    current = await token(
      config,
      'refresh_token',
      { refresh_token: current.refresh_token },
      options,
    )
  }
  let response = await send(config, path, { token: current.access_token }, options)
  if (response.status === 401) {
    current = await token(
      config,
      'refresh_token',
      { refresh_token: current.refresh_token },
      options,
    )
    response = await send(config, path, { token: current.access_token }, options)
    if (response.status === 401) throw new CrmError('Sessione scaduta: accedi di nuovo.', 'auth')
  }
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
