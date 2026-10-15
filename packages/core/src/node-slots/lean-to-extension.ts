import type { SlotDeclaration } from '../registry/types'

export type LeanToSlotId = 'flashing' | 'ledger' | 'beam' | 'framing' | 'posts' | 'footings'

export const LEAN_TO_SLOT_DEFAULTS: Partial<Record<LeanToSlotId, string>> = {
  flashing: 'library:metal-steel',
  posts: 'library:concrete-plaster',
  footings: 'library:concrete-plaster',
}

export function leanToSlots(): SlotDeclaration[] {
  return [
    { slotId: 'flashing', label: 'Scossalina', default: LEAN_TO_SLOT_DEFAULTS.flashing },
    { slotId: 'ledger', label: 'Trave di banchina / alta', default: LEAN_TO_SLOT_DEFAULTS.ledger },
    { slotId: 'beam', label: 'Trave bassa', default: LEAN_TO_SLOT_DEFAULTS.beam },
    { slotId: 'framing', label: 'Orditura', default: LEAN_TO_SLOT_DEFAULTS.framing },
    { slotId: 'posts', label: 'Montanti', default: LEAN_TO_SLOT_DEFAULTS.posts },
    { slotId: 'footings', label: 'Plinti', default: LEAN_TO_SLOT_DEFAULTS.footings },
  ]
}
