import type { AnyNode } from '@pascal-app/core'
import {
  type Allacciamento,
  localPoint,
  planTransformOf,
  readAllacciamenti,
  type TipoAllacciamento,
  wallDimensions,
  wallFacesOf,
} from './allacciamenti'
import { readProductRef } from './product'
import type { EquipmentNode } from './schema'

/** One connection on the services sheet: its number on the plan and where it is. */
export type RigaAllacciamento = {
  n: number
  /** The unit it belongs to: the article code, else its name. */
  attrezzatura: string
  tipo: TipoAllacciamento
  /** Metres from the nearest wall face, and from the nearest face across it; null without one. */
  muro: number | null
  laterale: number | null
  altezza: number
  potenza?: number
}

const codice = (node: EquipmentNode) => {
  const read = readProductRef(node.metadata)
  const ref = read.kind === 'article' || read.kind === 'local' ? read.ref : null
  return ref?.code || ref?.name || node.name || ''
}

/**
 * Numbers every connection of the level, unit after unit in code order (so the table reads by
 * equipment), and measures each from the walls as the dimensions on screen do. `inizio` is the
 * first number of each unit, for its plan symbols.
 */
export function numeraAllacciamenti(
  units: readonly EquipmentNode[],
  walls: readonly AnyNode[],
): { inizio: Map<string, number>; righe: RigaAllacciamento[] } {
  const faces = wallFacesOf(walls)
  const ordered = [...units]
    .filter((u) => readAllacciamenti(u.metadata).length > 0)
    .sort((a, b) => codice(a).localeCompare(codice(b), 'it') || a.id.localeCompare(b.id))
  const inizio = new Map<string, number>()
  const righe: RigaAllacciamento[] = []
  for (const unit of ordered) {
    inizio.set(unit.id, righe.length + 1)
    const at = planTransformOf(unit)
    for (const a of readAllacciamenti(unit.metadata) as Allacciamento[]) {
      const [behind, across] = wallDimensions(at(...localPoint(unit, a)), faces)
      righe.push({
        n: righe.length + 1,
        attrezzatura: codice(unit),
        tipo: a.tipo,
        muro: behind?.distance ?? null,
        laterale: across?.distance ?? null,
        altezza: a.altezza,
        ...(a.potenza !== undefined ? { potenza: a.potenza } : {}),
      })
    }
  }
  return { inizio, righe }
}
