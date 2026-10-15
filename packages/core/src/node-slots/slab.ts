import type { SlotDeclaration } from '../registry/types'

export type SlabSlotId = 'surface' | 'side' | 'edge' | 'riser' | 'underside' | 'foundation'

// Declared default appearances for an unpainted slab in colored mode — a
// catalog `library:<id>` finish or a `#rrggbb` colour. Textures-off collapses
// both to the themed floor role (the escape hatch).
//
// `surface` (top face) keeps the wood floor default and the slot id used before
// the top/side split, so existing painted slabs keep their floor finish. `side`
// (walls + underside) defaults to a light grey so a slab's edges read as a
// distinct trim rather than wood end-grain.
export const SLAB_TOP_SLOT_DEFAULT = 'library:wood-woodplank48'
export const SLAB_SIDE_SLOT_DEFAULT = '#cccccc'

export const FOUNDATION_SLOT_DEFAULT = 'library:concrete-raw'

export function slabSlots(): SlotDeclaration[] {
  return [
    { slotId: 'foundation', label: 'Fondazione', default: FOUNDATION_SLOT_DEFAULT },
    { slotId: 'surface', label: 'Estradosso', default: SLAB_TOP_SLOT_DEFAULT },
    { slotId: 'side', label: 'Lati', default: SLAB_SIDE_SLOT_DEFAULT },
    { slotId: 'edge', label: 'Bordo del pavimento', default: SLAB_SIDE_SLOT_DEFAULT },
    { slotId: 'riser', label: 'Alzata', default: SLAB_SIDE_SLOT_DEFAULT },
    { slotId: 'underside', label: 'Intradosso', default: SLAB_SIDE_SLOT_DEFAULT },
  ]
}
