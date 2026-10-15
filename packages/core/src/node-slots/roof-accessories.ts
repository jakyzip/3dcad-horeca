import type { SlotDeclaration } from '../registry/types'

const ACCESSORY_DEFAULT = 'library:preset-softwhite'
export const CUPOLA_LOUVERS_DEFAULT = 'library:preset-metal'

export function boxVentSlots(): SlotDeclaration[] {
  return [
    { slotId: 'base', label: 'Base', default: ACCESSORY_DEFAULT },
    { slotId: 'top', label: 'Sommità', default: ACCESSORY_DEFAULT },
  ]
}

export function cupolaSlots(): SlotDeclaration[] {
  return [
    { slotId: 'base', label: 'Base', default: ACCESSORY_DEFAULT },
    { slotId: 'body', label: 'Corpo', default: ACCESSORY_DEFAULT },
    { slotId: 'roof', label: 'Tetto', default: ACCESSORY_DEFAULT },
    { slotId: 'louvers', label: 'Lamelle', default: CUPOLA_LOUVERS_DEFAULT },
  ]
}

export function eyebrowVentSlots(): SlotDeclaration[] {
  return [
    { slotId: 'hood', label: 'Cappello', default: ACCESSORY_DEFAULT },
    { slotId: 'front', label: 'Lamelle', default: ACCESSORY_DEFAULT },
  ]
}

export function turbineVentSlots(): SlotDeclaration[] {
  return [
    { slotId: 'base', label: 'Base', default: ACCESSORY_DEFAULT },
    { slotId: 'head', label: 'Testa', default: ACCESSORY_DEFAULT },
  ]
}

export function gutterSlots(): SlotDeclaration[] {
  return [{ slotId: 'gutter', label: 'Grondaia', default: ACCESSORY_DEFAULT }]
}

export function downspoutSlots(): SlotDeclaration[] {
  return [{ slotId: 'surface', label: 'Superficie', default: ACCESSORY_DEFAULT }]
}
