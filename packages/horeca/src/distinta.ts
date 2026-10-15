import { readProductRef } from './product'

/**
 * The bill of materials ("distinta") of a scene, in the shape the CRM's `invia_distinta` RPC takes
 * (schema 1, see `crm_donà/docs/disegni-cad.md`). The CAD sends no prices: the CRM prices the quote.
 * Counting rules and the fingerprint mirror the Rust CAD (`horeca-cad`, `crates/horeca/src/distinta.rs`),
 * because the CRM compares fingerprints from both.
 */

export const MAX_ROWS = 2000
export const MAX_QUANTITY = 10_000

export type DistintaRow = { item_id: string; code: string; name: string; quantity: number }

export type Distinta = {
  /** CRM articles, sorted by code, then item_id. The only rows sent to the CRM. */
  rows: DistintaRow[]
  /** Articles not in the CRM catalog (empty item_id), counted by code and sorted by it. */
  local: DistintaRow[]
  /** Nodes with product data that cannot be read (e.g. an id that is not a uuid). */
  invalid: number
}

/** The node fields the count reads: any scene node fits. */
export type DistintaNode = {
  id: string
  type: string
  parentId?: string | null
  visible?: boolean
  metadata?: Record<string, unknown>
}

function isShown(node: DistintaNode, nodes: Readonly<Record<string, DistintaNode>>): boolean {
  const seen = new Set<string>()
  let current: DistintaNode | undefined = node
  while (current && !seen.has(current.id)) {
    if (current.visible === false) return false
    seen.add(current.id)
    current = current.parentId ? nodes[current.parentId] : undefined
  }
  return true
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Count the articles placed in the scene: one per visible node carrying product data. */
export function buildDistinta(nodes: Readonly<Record<string, DistintaNode>>): Distinta {
  const rows = new Map<string, DistintaRow>()
  const local = new Map<string, DistintaRow>()
  let invalid = 0
  for (const node of Object.values(nodes)) {
    const read = readProductRef(node.metadata)
    if (read.kind === 'none' || !isShown(node, nodes)) continue
    if (read.kind === 'invalid') {
      invalid++
      continue
    }
    const [bucket, key] =
      read.kind === 'article' ? [rows, read.ref.item_id] : [local, read.ref.code]
    const row = bucket.get(key)
    if (row) row.quantity++
    else bucket.set(key, { ...read.ref, quantity: 1 })
  }
  const byCode = (a: DistintaRow, b: DistintaRow) =>
    compare(a.code, b.code) || compare(a.item_id, b.item_id)
  return { rows: [...rows.values()].sort(byCode), local: [...local.values()].sort(byCode), invalid }
}

/**
 * SHA-256 (lowercase hex) of `item_id\tquantity\tcode\tname\n` per row, rows sorted by item_id.
 * Byte-for-byte the Rust CAD's `Distinta::hash`.
 */
export async function distintaHash(rows: readonly DistintaRow[]): Promise<string> {
  const text = [...rows]
    .sort((a, b) => compare(a.item_id, b.item_id))
    .map((r) => `${r.item_id}\t${r.quantity}\t${r.code}\t${r.name}\n`)
    .join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type DrawingRef = {
  /** Stable id of this drawing in the CRM (`drawings.drawing_id`). */
  drawing_id: string
  name: string
  account_id: string
  deal_id: string
}

export type InviaDistintaPayload = DrawingRef & {
  schema: 1
  items_hash: string
  items: DistintaRow[]
}

/** The `p` argument of `rpc('invia_distinta', { p })`, or why the CRM would refuse it. */
export async function inviaDistintaPayload(
  drawing: DrawingRef,
  distinta: Distinta,
): Promise<{ ok: true; payload: InviaDistintaPayload } | { ok: false; error: string }> {
  const { rows } = distinta
  if (rows.length === 0) return { ok: false, error: 'La distinta è vuota.' }
  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `La distinta ha ${rows.length} righe: il CRM ne accetta al massimo ${MAX_ROWS}.`,
    }
  }
  const tooMany = rows.find((r) => r.quantity > MAX_QUANTITY)
  if (tooMany) {
    return {
      ok: false,
      error: `La quantità di ${tooMany.code || tooMany.item_id} supera ${MAX_QUANTITY}.`,
    }
  }
  return {
    ok: true,
    payload: {
      schema: 1,
      ...drawing,
      items_hash: await distintaHash(rows),
      items: rows.map((r) => ({ ...r })),
    },
  }
}

function csvField(value: string | number): string {
  const text = String(value)
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** CSV for spreadsheets set up for Italy: `;` separated, with a BOM so Excel reads UTF-8. */
export function distintaCsv(distinta: Distinta): string {
  const lines = [
    ['Codice', 'Articolo', 'Quantità', 'ID articolo'],
    ...[...distinta.rows, ...distinta.local].map((r) => [r.code, r.name, r.quantity, r.item_id]),
  ]
  return `﻿${lines.map((line) => line.map(csvField).join(';')).join('\r\n')}\r\n`
}
