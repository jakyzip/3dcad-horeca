import type { FloorplanSchedule } from '@pascal-app/editor'
import { buildDistinta, type DistintaNode } from './distinta'

/**
 * The plan sheet's table for one equipment kind: its articles on the level, counted like the
 * distinta. Nodes without an article are listed together so they are not forgotten.
 */
export function equipmentSchedule(
  kind: string,
  title: string,
  siblings: ReadonlyArray<DistintaNode>,
): FloorplanSchedule | null {
  if (siblings.length === 0) return null
  const distinta = buildDistinta(Object.fromEntries(siblings.map((node) => [node.id, node])))
  const listed = [...distinta.rows, ...distinta.local]
  const counted = listed.reduce((sum, row) => sum + row.quantity, 0)
  const withoutArticle = siblings.length - counted - distinta.invalid
  const rows = [
    ...distinta.rows.map((row) => ({
      id: row.item_id,
      cells: { code: row.code, name: row.name, quantity: String(row.quantity) },
    })),
    ...distinta.local.map((row) => ({
      id: `locale:${row.code}`,
      cells: { code: row.code, name: `${row.name} (non nel CRM)`, quantity: String(row.quantity) },
    })),
  ]
  if (withoutArticle > 0) {
    rows.push({
      id: 'senza-articolo',
      cells: { code: '—', name: 'Senza articolo', quantity: String(withoutArticle) },
    })
  }
  const issues: string[] = []
  if (distinta.invalid > 0) {
    issues.push(`${distinta.invalid} elementi hanno dati articolo non validi e non sono contati.`)
  }
  return {
    id: `horeca-${kind}`,
    title,
    columns: [
      { key: 'code', label: 'Codice', weight: 1 },
      { key: 'name', label: 'Articolo', weight: 3 },
      { key: 'quantity', label: 'Quantità', weight: 1 },
    ],
    rows,
    ...(issues.length > 0 ? { issues } : {}),
  }
}
