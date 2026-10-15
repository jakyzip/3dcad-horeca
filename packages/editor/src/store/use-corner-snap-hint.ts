import type { CornerBlockReason } from '@pascal-app/core'
import { create } from 'zustand'

/**
 * What the window being placed or dragged near a wall end says: `join` when a window already waits
 * on the other wall, `new` when one would be created, the reason when the end is not a corner a
 * window can wrap, null away from a wall end. The tools write it; the HUD reads it, so the hint is
 * there only inside the zone.
 */
export type CornerSnapHint = 'join' | 'new' | CornerBlockReason | null

export const useCornerSnapHint = create<{
  hint: CornerSnapHint
  setHint: (hint: CornerSnapHint) => void
}>((set) => ({
  hint: null,
  setHint: (hint) => set((state) => (state.hint === hint ? state : { hint })),
}))

/** One line each, in the HUD's voice: what is in the way, not what to do about it. */
export const CORNER_BLOCK_NOTES: Record<CornerBlockReason, string> = {
  free_end: 'Qui non arriva nessun muro',
  several_walls: 'Qui si incontrano tre o più muri',
  angle: 'I muri si incontrano con un angolo troppo acuto o troppo piatto',
  curved: 'Un muro curvo non accetta finestre d’angolo',
  curtain: 'Una facciata continua non accetta finestre d’angolo',
  no_room: 'Non c’è spazio per la finestra gemella sull’altro muro',
  in_the_way: 'Un’altra apertura occupa l’angolo',
  too_tall: 'La finestra già presente è più alta di questo muro',
}

export type CornerHintRow = { keys: string[]; label: string }

/** The HUD rows for a hint, shared by the placement tool and the move HUD. */
export function cornerHintRows(hint: CornerSnapHint): CornerHintRow[] {
  if (!hint) return []
  if (hint === 'join' || hint === 'new')
    return [
      {
        keys: ['Left click'],
        label: hint === 'join' ? 'Unisci come finestra d’angolo' : 'Finestra d’angolo',
      },
      { keys: ['Alt'], label: 'Posiziona senza aggancio all’angolo' },
    ]
  // The HUD's notice row, as for a placement that does not fit: a note, not a key to press.
  return [{ keys: ['!'], label: CORNER_BLOCK_NOTES[hint] }]
}
