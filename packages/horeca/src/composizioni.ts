import { z } from 'zod'
import { ALLACCIAMENTI_METADATA_KEY } from './allacciamenti'
import { PRODUCT_METADATA_KEY } from './product'
import type { EquipmentNode } from './schema'

/**
 * Saved groups of equipment ("lavello + lavastoviglie + pensile"), reused in any project with
 * one click: sizes, options, catalog article and connections included, positions kept relative
 * to each other. Kept on this computer and shared as a .json file.
 */

/** The unit data a composition carries; ids, parents and the place in the scene are left out. */
const Elemento = z.object({
  type: z.string().startsWith('horeca:'),
  name: z.string().optional(),
  /** Plan offset from the composition's centre, metres (x, z). */
  offset: z.tuple([z.number(), z.number()]),
  rotation: z.number(),
  width: z.number(),
  depth: z.number(),
  height: z.number(),
  elevation: z.number().default(0),
  ripiano: z.boolean().optional(),
  gocciolatoio: z.boolean().optional(),
  /** Only the Ho.Re.Ca data: the article and the connections. */
  metadata: z.record(z.string(), z.unknown()).default({}),
})
export type Elemento = z.infer<typeof Elemento>

export const Composizione = z.object({
  id: z.string(),
  nome: z.string().min(1),
  creata: z.string(),
  elementi: z.array(Elemento).min(1),
})
export type Composizione = z.infer<typeof Composizione>

const KEPT_METADATA = [PRODUCT_METADATA_KEY, ALLACCIAMENTI_METADATA_KEY]

/** A composition from the selected units, centred on the middle of their footprint. */
export function composizioneDa(
  units: readonly EquipmentNode[],
  nome: string,
  now = new Date(),
): Composizione | null {
  if (!units.length || !nome.trim()) return null
  const xs = units.map((u) => u.position[0])
  const zs = units.map((u) => u.position[2])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2
  return {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    creata: now.toISOString(),
    elementi: units.map((u) => {
      const metadata: Record<string, unknown> = {}
      for (const key of KEPT_METADATA) {
        const value = (u.metadata as Record<string, unknown> | undefined)?.[key]
        if (value !== undefined) metadata[key] = structuredClone(value)
      }
      return {
        type: u.type,
        ...(u.name ? { name: u.name } : {}),
        offset: [round(u.position[0] - cx), round(u.position[2] - cz)] as [number, number],
        rotation: u.rotation,
        width: u.width,
        depth: u.depth,
        height: u.height,
        elevation: u.elevation ?? 0,
        ...(u.ripiano !== undefined ? { ripiano: u.ripiano } : {}),
        ...(u.gocciolatoio !== undefined ? { gocciolatoio: u.gocciolatoio } : {}),
        metadata,
      }
    }),
  }
}

const round = (v: number) => Math.round(v * 1e4) / 1e4

/** The units' data placed around `centre` (plan x, z), ready for each kind's schema. */
export function elementiIn(
  composizione: Composizione,
  centre: [number, number],
): Array<Record<string, unknown> & { type: string }> {
  return composizione.elementi.map(({ offset, ...e }) => ({
    ...e,
    metadata: structuredClone(e.metadata),
    position: [centre[0] + offset[0], 0, centre[1] + offset[1]],
  }))
}

export const FILE_FORMAT = '3dcad-horeca/composizioni'

export function composizioniToFile(list: readonly Composizione[]): string {
  return `${JSON.stringify({ format: FILE_FORMAT, version: 1, composizioni: list }, null, 2)}\n`
}

/**
 * Compositions from a file: the valid ones, with fresh ids so importing twice never clashes;
 * `scartate` counts the ones that don't parse.
 */
export function composizioniFromFile(text: string): {
  composizioni: Composizione[]
  scartate: number
} {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Il file non è un file di composizioni (JSON non valido).')
  }
  const list = (raw as { format?: unknown; composizioni?: unknown })?.composizioni
  if ((raw as { format?: unknown })?.format !== FILE_FORMAT || !Array.isArray(list))
    throw new Error('Il file non è un file di composizioni del 3DCadHo.Re.Ca.')
  const composizioni: Composizione[] = []
  let scartate = 0
  for (const entry of list) {
    const parsed = Composizione.safeParse(entry)
    if (parsed.success) composizioni.push({ ...parsed.data, id: crypto.randomUUID() })
    else scartate += 1
  }
  return { composizioni, scartate }
}
