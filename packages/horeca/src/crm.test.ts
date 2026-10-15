import { describe, expect, test } from 'bun:test'
import type { CatalogArticle } from './catalog'
import {
  type CrmSession,
  crmLogin,
  fetchCrmCatalog,
  mergeCrmCatalog,
  openCrmDeals,
  searchCrmAccounts,
  sendDistinta,
  uploadCrmPreview,
} from './crm'
import type { InviaDistintaPayload } from './distinta'

const config = { url: 'https://crm.example.supabase.co/', key: 'sb_publishable_test' }
const A = 'a0000000-0000-4000-8000-000000000001'
const B = 'b0000000-0000-4000-8000-000000000002'
const CAT = 'c0000000-0000-4000-8000-000000000003'

type Call = { url: string; init: RequestInit }
function fakeFetch(handler: (url: string, init: RequestInit) => { status: number; body: unknown }) {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    const { status, body } = handler(url, init)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { calls, fetchImpl }
}

const tokenBody = (access: string) => ({
  access_token: access,
  refresh_token: `r-${access}`,
  expires_in: 3600,
  user: { id: 'u1', email: 'jacopo@example.com' },
})

describe('crmLogin', () => {
  test('signs in with email and password and keeps no password', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, body: tokenBody('t1') }))
    const session = await crmLogin(config, ' jacopo@example.com ', 'segreta', {
      fetchImpl,
      now: 1000,
    })
    expect(session).toEqual({
      access_token: 't1',
      refresh_token: 'r-t1',
      expires_at: 4600,
      email: 'jacopo@example.com',
    })
    expect(calls[0]!.url).toBe('https://crm.example.supabase.co/auth/v1/token?grant_type=password')
    expect(calls[0]!.init.headers).toMatchObject({ apikey: 'sb_publishable_test' })
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      email: 'jacopo@example.com',
      password: 'segreta',
    })
  })

  test('wrong credentials read as such', async () => {
    const { fetchImpl } = fakeFetch(() => ({
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
    }))
    await expect(crmLogin(config, 'a@b.it', 'x', { fetchImpl, now: 0 })).rejects.toThrow(
      'Email o password sbagliate.',
    )
  })
})

describe('fetchCrmCatalog', () => {
  const session: CrmSession = {
    access_token: 't1',
    refresh_token: 'r-t1',
    expires_at: 10_000,
    email: '',
  }
  const item = (over: Record<string, unknown>) => ({
    id: A,
    code: 'BF-150',
    name: 'Banco frigo',
    width_mm: 1500,
    depth_mm: 700,
    height_mm: 850,
    category_id: CAT,
    active: true,
    updated_at: '2026-10-15T10:00:00Z',
    ...over,
  })

  test('first sync reads every page, with category names', async () => {
    const pages = [
      Array.from({ length: 1000 }, (_, i) =>
        item({ id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, code: `C${i}` }),
      ),
      [item({ id: B, code: 'LAST', updated_at: '2026-10-15T11:00:00Z' })],
    ]
    const { calls, fetchImpl } = fakeFetch((url) => {
      if (url.includes('/catalog_categories'))
        return { status: 200, body: [{ id: CAT, name: 'Banchi' }] }
      const offset = Number(new URL(url).searchParams.get('offset'))
      return { status: 200, body: pages[offset / 1000] ?? [] }
    })
    const result = await fetchCrmCatalog(config, session, null, { fetchImpl, now: 0 })
    expect(result.upserts).toHaveLength(1001)
    expect(result.upserts.at(-1)).toEqual({
      item_id: B,
      code: 'LAST',
      name: 'Banco frigo',
      category: 'Banchi',
      width_mm: 1500,
      depth_mm: 700,
      height_mm: 850,
      source: 'crm',
    })
    expect(result.removed).toEqual([])
    expect(result.since).toBe('2026-10-15T11:00:00Z')
    const catalogCalls = calls.filter((c) => c.url.includes('/catalog_items'))
    expect(catalogCalls).toHaveLength(2)
    expect(catalogCalls[0]!.init.headers).toMatchObject({ Authorization: 'Bearer t1' })
    // No deleted-rows query on a first sync: there is nothing local to delete.
    expect(calls.some((c) => c.url.includes('deleted_rows'))).toBe(false)
  })

  test('a delta asks for changes since the last sync; inactive and deleted rows are removed', async () => {
    const { calls, fetchImpl } = fakeFetch((url) => {
      if (url.includes('/catalog_categories')) return { status: 200, body: [] }
      if (url.includes('/deleted_rows')) return { status: 200, body: [{ row_id: B }] }
      return { status: 200, body: [item({ active: false, updated_at: '2026-10-16T09:00:00Z' })] }
    })
    const result = await fetchCrmCatalog(config, session, '2026-10-15T11:00:00Z', {
      fetchImpl,
      now: 0,
    })
    expect(result.upserts).toEqual([])
    expect(result.removed.sort()).toEqual([A, B])
    expect(result.since).toBe('2026-10-16T09:00:00Z')
    const url = new URL(calls.find((c) => c.url.includes('/catalog_items'))!.url)
    expect(url.searchParams.get('updated_at')).toBe('gt.2026-10-15T11:00:00Z')
  })

  test('an expired token is refreshed once and the request retried', async () => {
    let first = true
    const { calls, fetchImpl } = fakeFetch((url) => {
      if (url.includes('grant_type=refresh_token')) return { status: 200, body: tokenBody('t2') }
      if (url.includes('/catalog_categories')) return { status: 200, body: [] }
      if (first) {
        first = false
        return { status: 401, body: { message: 'JWT expired' } }
      }
      return { status: 200, body: [] }
    })
    const result = await fetchCrmCatalog(config, session, null, { fetchImpl, now: 0 })
    expect(result.session.access_token).toBe('t2')
    expect(calls.filter((c) => c.url.includes('refresh_token'))).toHaveLength(1)
  })
})

describe('mergeCrmCatalog', () => {
  const crm = (item_id: string, code: string): CatalogArticle => ({
    item_id,
    code,
    name: code,
    category: '',
    width_mm: null,
    depth_mm: null,
    height_mm: null,
    source: 'crm',
  })

  test('upserts by CRM id, removes deleted ones, leaves file articles alone', () => {
    const file: CatalogArticle = { ...crm('', 'FILE'), source: 'file' }
    const merged = mergeCrmCatalog([file, crm(A, 'OLD'), crm(B, 'GONE')], {
      upserts: [crm(A, 'NEW')],
      removed: [B],
    })
    expect(merged.map((a) => a.code)).toEqual(['FILE', 'NEW'])
  })
})

describe('sending the distinta', () => {
  const session: CrmSession = {
    access_token: 't1',
    refresh_token: 'r1',
    expires_at: 99_999,
    email: 'x',
  }
  const payload: InviaDistintaPayload = {
    schema: 1,
    drawing_id: 'd0000000-0000-4000-8000-000000000004',
    name: 'Laboratorio',
    account_id: A,
    deal_id: B,
    items_hash: 'a'.repeat(64),
    items: [{ item_id: CAT, code: 'BF-150', name: 'Banco frigo', quantity: 2 }],
  }

  test('customers by name, with PostgREST syntax stripped', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({
      status: 200,
      body: [{ id: A, name: 'Bar', city: 'Treviso' }],
    }))
    const { accounts } = await searchCrmAccounts(config, session, 'Bar (Rossi), *', {
      fetchImpl,
      now: 0,
    })
    expect(accounts[0]!.name).toBe('Bar')
    expect(decodeURIComponent(calls[0]!.url)).toContain(
      '/rest/v1/accounts?select=id,name,city&name=ilike.*Bar  Rossi*&order=name',
    )
    expect(calls[0]!.init.headers).toMatchObject({ Authorization: 'Bearer t1' })
  })

  test('open deals of a customer', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, body: [] }))
    await openCrmDeals(config, session, A, { fetchImpl, now: 0 })
    expect(calls[0]!.url).toContain(
      `/rest/v1/v_deals?select=id,title,stage_name&account_id=eq.${A}&outcome=eq.open`,
    )
  })

  test('posts { p } to the rpc and reads the answer', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({
      status: 200,
      body: { changed: true, preview_path: 'org/disegni/d/pianta.png', non_trovati: [CAT] },
    }))
    const { result } = await sendDistinta(config, session, payload, { fetchImpl, now: 0 })
    expect(result).toEqual({
      changed: true,
      preview_path: 'org/disegni/d/pianta.png',
      non_trovati: [CAT],
    })
    expect(calls[0]!.url).toBe('https://crm.example.supabase.co/rest/v1/rpc/invia_distinta')
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ p: payload })
  })

  test('a refusal comes back with the CRM’s words', async () => {
    const { fetchImpl } = fakeFetch(() => ({
      status: 404,
      body: { code: 'P0002', message: 'Trattativa non trovata' },
    }))
    await expect(sendDistinta(config, session, payload, { fetchImpl, now: 0 })).rejects.toThrow(
      'Trattativa non trovata',
    )
  })

  test('the plan picture is upserted at the given path', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, body: { Key: 'x' } }))
    await uploadCrmPreview(config, session, '/org 1/disegni/d/pianta.png', new Blob(['png']), {
      fetchImpl,
      now: 0,
    })
    expect(calls[0]!.url).toBe(
      'https://crm.example.supabase.co/storage/v1/object/crm-files/org%201/disegni/d/pianta.png',
    )
    expect(calls[0]!.init.headers).toMatchObject({
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    })
  })
})
