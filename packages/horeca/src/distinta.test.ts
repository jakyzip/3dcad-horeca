import { describe, expect, test } from 'bun:test'
import {
  buildDistinta,
  type DistintaNode,
  distintaCsv,
  distintaHash,
  inviaDistintaPayload,
} from './distinta'
import { readProductRef } from './product'

const A = 'a0000000-0000-4000-8000-000000000001'
const B = 'b0000000-0000-4000-8000-000000000002'

let counter = 0
function node(product: unknown, extra: Partial<DistintaNode> = {}): DistintaNode {
  counter++
  return {
    id: `n_${counter}`,
    type: 'horeca:sink',
    parentId: null,
    visible: true,
    metadata: product === undefined ? {} : { product },
    ...extra,
  }
}
const byId = (...nodes: DistintaNode[]) => Object.fromEntries(nodes.map((n) => [n.id, n]))

describe('readProductRef', () => {
  test('a node without product data is not an article', () => {
    expect(readProductRef({})).toEqual({ kind: 'none' })
    expect(readProductRef(undefined)).toEqual({ kind: 'none' })
  })

  test('an article id must be a uuid; it is lower-cased and the texts trimmed', () => {
    expect(
      readProductRef({ product: { item_id: A.toUpperCase(), code: ' TAV ', name: ' Tavolo ' } }),
    ).toEqual({ kind: 'article', ref: { item_id: A, code: 'TAV', name: 'Tavolo' } })
  })

  test('product data with a broken id is invalid, not silently dropped', () => {
    expect(readProductRef({ product: { item_id: 'not-a-uuid', code: 'X' } })).toEqual({
      kind: 'invalid',
    })
    expect(readProductRef({ product: 'TAV' })).toEqual({ kind: 'invalid' })
  })

  test('code and name may be missing', () => {
    expect(readProductRef({ product: { item_id: A } })).toEqual({
      kind: 'article',
      ref: { item_id: A, code: '', name: '' },
    })
  })
})

describe('buildDistinta', () => {
  test('counts each article once per placed node, sorted by code', () => {
    const tav = { item_id: B, code: 'TAV', name: 'Tavolo' }
    const cel = { item_id: A, code: 'CEL', name: 'Cella' }
    const distinta = buildDistinta(
      byId(node(tav), node(cel), node(tav), node(tav), node(undefined)),
    )
    expect(distinta.rows).toEqual([
      { item_id: A, code: 'CEL', name: 'Cella', quantity: 1 },
      { item_id: B, code: 'TAV', name: 'Tavolo', quantity: 3 },
    ])
    expect(distinta.invalid).toBe(0)
  })

  test('the first code and name seen for an article win', () => {
    const distinta = buildDistinta(
      byId(
        node({ item_id: A, code: 'CEL', name: 'Cella' }),
        node({ item_id: A, code: 'OLD', name: 'Vecchio' }),
      ),
    )
    expect(distinta.rows).toEqual([{ item_id: A, code: 'CEL', name: 'Cella', quantity: 2 }])
  })

  test('hidden nodes, and nodes under a hidden parent, are left out', () => {
    const tav = { item_id: B, code: 'TAV', name: 'Tavolo' }
    const hiddenGroup = node(undefined, { visible: false })
    const distinta = buildDistinta(
      byId(
        node(tav),
        node(tav, { visible: false }),
        hiddenGroup,
        node(tav, { parentId: hiddenGroup.id }),
      ),
    )
    expect(distinta.rows).toEqual([{ item_id: B, code: 'TAV', name: 'Tavolo', quantity: 1 }])
  })

  test('counts invalid product data apart', () => {
    const distinta = buildDistinta(byId(node({ item_id: 'xyz' }), node({ item_id: A })))
    expect(distinta.invalid).toBe(1)
    expect(distinta.rows).toHaveLength(1)
  })

  test('a parent cycle does not hang', () => {
    const a = node({ item_id: A }, { id: 'loop_a', parentId: 'loop_b' })
    const b = node(undefined, { id: 'loop_b', parentId: 'loop_a' })
    expect(buildDistinta(byId(a, b)).rows).toHaveLength(1)
  })
})

describe('distintaHash', () => {
  // The same pinned value as the Rust CAD (horeca-cad, distinta.rs `impronta_fissata`): the CRM
  // compares hashes from both, so they must agree byte for byte.
  test('matches the Rust CAD fingerprint', async () => {
    const rows = [
      { item_id: B, code: 'TAV', name: 'Tavolo', quantity: 3 },
      { item_id: A, code: 'CEL', name: 'Cella', quantity: 1 },
    ]
    expect(await distintaHash(rows)).toBe(
      'ae16a77287ef4e6c4978835234bf490dbf6f17c2cee0cd5741cbf43b6d092157',
    )
  })

  test('does not depend on row order', async () => {
    const rows = [
      { item_id: B, code: 'TAV', name: 'Tavolo', quantity: 3 },
      { item_id: A, code: 'CEL', name: 'Cella', quantity: 1 },
    ]
    expect(await distintaHash([...rows].reverse())).toBe(await distintaHash(rows))
  })
})

describe('inviaDistintaPayload', () => {
  const drawing = {
    drawing_id: 'd0000000-0000-4000-8000-000000000003',
    name: 'Bar Rossi',
    account_id: 'c0000000-0000-4000-8000-000000000004',
    deal_id: 'e0000000-0000-4000-8000-000000000005',
  }

  test('builds schema 1 with the fingerprint', async () => {
    const distinta = buildDistinta(byId(node({ item_id: A, code: 'CEL', name: 'Cella' })))
    const result = await inviaDistintaPayload(drawing, distinta)
    expect(result).toEqual({
      ok: true,
      payload: {
        schema: 1,
        ...drawing,
        items_hash: await distintaHash(distinta.rows),
        items: [{ item_id: A, code: 'CEL', name: 'Cella', quantity: 1 }],
      },
    })
  })

  test('refuses what the CRM would refuse', async () => {
    const tooMany = {
      rows: [{ item_id: A, code: 'CEL', name: 'Cella', quantity: 10_001 }],
      invalid: 0,
    }
    expect(await inviaDistintaPayload(drawing, tooMany)).toEqual({
      ok: false,
      error: 'La quantità di CEL supera 10000.',
    })
    const rows = Array.from({ length: 2001 }, (_, i) => ({
      item_id: `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      code: `C${i}`,
      name: 'X',
      quantity: 1,
    }))
    expect(await inviaDistintaPayload(drawing, { rows, invalid: 0 })).toEqual({
      ok: false,
      error: 'La distinta ha 2001 righe: il CRM ne accetta al massimo 2000.',
    })
    expect(await inviaDistintaPayload(drawing, { rows: [], invalid: 0 })).toEqual({
      ok: false,
      error: 'La distinta è vuota.',
    })
  })
})

describe('distintaCsv', () => {
  test('semicolon separated with a BOM, quoting where needed', () => {
    const csv = distintaCsv({
      rows: [{ item_id: A, code: 'TAV;2', name: 'Tavolo "inox"', quantity: 3 }],
      invalid: 0,
    })
    expect(csv).toBe(`﻿Codice;Articolo;Quantità;ID articolo\r\n"TAV;2";"Tavolo ""inox""";3;${A}\r\n`)
  })
})
