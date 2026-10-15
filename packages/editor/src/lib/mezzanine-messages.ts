import { CROSSING_MESSAGE } from './floor-region-geometry'

// Short labels for what core refuses a mezzanine — drawing, moving, turning,
// copying, pushing an edge or adding its stair all read the same words.

export const MEZZANINE_OUTSIDE_MESSAGE = 'Fuori dalla stanza'
export const MEZZANINE_TOO_SMALL_MESSAGE = 'Almeno 1 m²'
export const MEZZANINE_OVERLAP_MESSAGE = 'Si sovrappone a un soppalco'
export const MEZZANINE_ELEVATION_MESSAGE = 'Troppo alto o troppo basso'
export const MEZZANINE_FAILED_MESSAGE = 'Qui non si può aggiungere un soppalco'
export const MEZZANINE_NO_STAIR_MESSAGE = 'Non c’è spazio per la scala'

const CONFLICT_MESSAGES: Record<string, string> = {
  'outside-host': MEZZANINE_OUTSIDE_MESSAGE,
  'overlaps-mezzanine': MEZZANINE_OVERLAP_MESSAGE,
  'mezzanine-overlap': MEZZANINE_OVERLAP_MESSAGE,
  'too-small': MEZZANINE_TOO_SMALL_MESSAGE,
  'self-intersecting': CROSSING_MESSAGE,
  'mezzanine-elevation': MEZZANINE_ELEVATION_MESSAGE,
  'no-room-for-stair': MEZZANINE_NO_STAIR_MESSAGE,
}

/** The label for a core mezzanine conflict code, or null when it is not one of them. */
export function mezzanineConflictMessage(code: string | undefined): string | null {
  return (code && CONFLICT_MESSAGES[code]) || null
}
