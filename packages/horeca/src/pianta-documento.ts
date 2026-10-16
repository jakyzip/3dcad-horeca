/**
 * What a document's plan shows of the services. The customer's sheet leaves the connections out,
 * the services sheet draws them all with their dimensions, and the DXF and the CRM preview take
 * everything as the user set it on screen. The sheet export draws each unit afresh (no cache), so
 * the plan builders read this while a document collects its geometry.
 */
export type ContenutoPianta = 'tutto' | 'cliente' | 'impianti'

let corrente: ContenutoPianta = 'tutto'
let numeri: ReadonlyMap<string, number> = new Map()

export const contenutoPianta = (): ContenutoPianta => corrente

/** On the services plan: the number of a unit's first connection (see `numeraAllacciamenti`). */
export const primoNumero = (id: string): number | undefined => numeri.get(id)

/** Runs `collect` with the plans drawn as `contenuto`, then puts the setting back. */
export function conContenutoPianta<T>(
  contenuto: ContenutoPianta,
  collect: () => T,
  numerazione: ReadonlyMap<string, number> = new Map(),
): T {
  const previous = [corrente, numeri] as const
  corrente = contenuto
  numeri = numerazione
  try {
    return collect()
  } finally {
    ;[corrente, numeri] = previous
  }
}
