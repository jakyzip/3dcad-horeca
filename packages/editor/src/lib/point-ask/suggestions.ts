import type { PointKind, PointTarget } from './types'

type SuggestionState = {
  /** A room with nothing in it. */
  empty?: boolean
  /** A window already stands where the wall was clicked. */
  hasWindowAtStation?: boolean
}

const CHIPS: Record<Exclude<PointKind, 'room' | 'wall'>, [string, string, string]> = {
  window: ['Allargala', 'Aggiungi una finestra uguale', 'Cambia il colore del telaio'],
  door: ['Inverti l’apertura', 'Trasformala in porta scorrevole', 'Allargala a 90 cm'],
  item: ['Sostituiscilo con qualcosa di simile', 'Mettilo contro il muro', 'Eliminalo'],
  roof: ['Cambia la pendenza', 'Trasformalo in tetto a padiglione', 'Cambia il manto di copertura'],
  stair: ['Ruotala di 90°', 'Aggiungi un corrimano', 'Allargala'],
  several: ['Rendili uguali', 'Allineali', 'Distanziali in modo uniforme'],
  area: ['Cosa non va qui?', 'Rendilo uguale al riferimento', 'Metti in ordine qui'],
  other: ['Dimmi cos’è', 'Cambia la finitura', 'Eliminalo'],
}

/**
 * Three chips chosen locally from the kind and the element's state, with no model call, so they
 * are there on the first frame and teach what Pascal can do here (spec 2.4).
 */
export function suggestionsFor(kind: PointKind, state: SuggestionState = {}): string[] {
  if (kind === 'room')
    return [
      state.empty ? 'Arreda questa stanza' : 'Riorganizza gli arredi',
      'Allungala di 1 m',
      'Cambia la finitura del pavimento',
    ]
  if (kind === 'wall')
    return [
      state.hasWindowAtStation ? 'Sposta la finestra lungo il muro' : 'Aggiungi una finestra qui',
      'Cambia la finitura su questo lato',
      'Spostalo di 50 cm',
    ]
  return [...CHIPS[kind]]
}

const THIS: Partial<Record<PointKind, string>> = {
  wall: 'questo muro',
  window: 'questa finestra',
  door: 'questa porta',
  item: 'questo oggetto',
  roof: 'questo tetto',
  stair: 'questa scala',
}

/** "Chiedi di Cucina…", "Chiedi di questa finestra…", "Chiedi di questi elementi…", "Chiedi di quest’area…". */
export function placeholderFor(targets: readonly PointTarget[]): string {
  if (targets.length === 0) return 'Chiedi di quest’area…'
  if (targets.length > 1) return 'Chiedi di questi elementi…'
  const [only] = targets as [PointTarget]
  if (only.kind === 'room') return `Chiedi di ${only.name}…`
  if (only.kind === 'area') return 'Chiedi di quest’area…'
  return `Chiedi di ${THIS[only.kind] ?? 'questo elemento'}…`
}

/** What the chips are chosen by, from a node's type. A region is an area whatever it holds. */
export function kindOf(nodeType: string, isRegion = false): PointKind {
  if (isRegion) return 'area'
  switch (nodeType) {
    case 'zone':
      return 'room'
    case 'wall':
      return 'wall'
    case 'window':
      return 'window'
    case 'door':
      return 'door'
    case 'item':
    case 'procedural-item':
    case 'imported-mesh':
    case 'column':
      return 'item'
    case 'roof':
    case 'roof-segment':
      return 'roof'
    case 'stair':
    case 'stair-segment':
      return 'stair'
    default:
      return 'other'
  }
}

export function kindForTargets(targets: readonly PointTarget[], isRegion = false): PointKind {
  if (isRegion || targets.length === 0) return 'area'
  if (targets.length > 1) return 'several'
  return (targets[0] as PointTarget).kind
}

const FOLLOW_UP_CHIPS: Record<PointKind, string[]> = {
  room: [
    'Aggiungi un tappeto',
    'Cambia il colore dei muri',
    'Appendi qualcosa ai muri',
    'Aggiungi più luce',
  ],
  wall: [
    'Aggiungi una porta qui',
    'Dipingi questo muro',
    'Appendici qualcosa',
    'Rendilo più spesso',
  ],
  window: [
    'Rendila più alta',
    'Spostala di 30 cm lungo il muro',
    'Cambia l’altezza del davanzale',
    'Aggiungi una finestra uguale',
  ],
  door: [
    'Allargala',
    'Spostala lungo il muro',
    'Cambia il colore',
    'Aggiungi una finestra accanto',
  ],
  item: ['Ruotalo di 90°', 'Ingrandiscilo', 'Cambia il colore', 'Aggiungine un altro'],
  roof: ['Aggiungi un lucernario', 'Allunga la gronda', 'Cambia il colore', 'Aggiungi un camino'],
  stair: ['Aggiungi un pianerottolo', 'Cambia le pedate', 'Spostala di 50 cm', 'Abbassa l’alzata'],
  several: ['Ingrandiscili', 'Cambia il loro colore', 'Raggruppali', 'Elimina il secondo'],
  area: [
    'Aggiungi qualcosa qui',
    'Libera questo spazio',
    'Rendilo più luminoso',
    'Cambia il pavimento qui',
  ],
  other: ['Ingrandiscilo', 'Cambia il colore', 'Spostalo di 50 cm', 'Duplicalo'],
}

const plain = (words: string) =>
  words
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/u, '')

/**
 * Three chips for asking again on what a turn just changed ("Change more"): the next things to
 * try, never the words that were just sent.
 */
export function followUpSuggestionsFor(kind: PointKind, justAsked: string): string[] {
  const sent = plain(justAsked)
  return FOLLOW_UP_CHIPS[kind].filter((chip) => plain(chip) !== sent).slice(0, 3)
}
