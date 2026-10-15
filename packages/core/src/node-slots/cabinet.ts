import type { SlotDeclaration } from '../registry/types'

export type CabinetSlotId =
  | 'front'
  | 'carcass'
  | 'countertop'
  | 'plinth'
  | 'hardware'
  | 'glass'
  | 'appliance'
  | 'applianceInterior'

const FRONT_DEFAULT = 'library:preset-softwhite'
const CARCASS_DEFAULT = 'library:preset-softwhite'
const COUNTERTOP_DEFAULT = 'library:wood-finewood27'
const PLINTH_DEFAULT = 'library:preset-softwhite'
const HARDWARE_DEFAULT = 'library:metal-chrome'
const GLASS_DEFAULT = 'library:preset-glass'
const APPLIANCE_DEFAULT = 'library:metal-steel'
const APPLIANCE_INTERIOR_DEFAULT = 'library:preset-charcoal'

export function cabinetSlots(): SlotDeclaration[] {
  return [
    { slotId: 'front', label: 'Frontale', default: FRONT_DEFAULT },
    { slotId: 'carcass', label: 'Struttura', default: CARCASS_DEFAULT },
    { slotId: 'countertop', label: 'Piano di lavoro', default: COUNTERTOP_DEFAULT },
    { slotId: 'plinth', label: 'Zoccolo', default: PLINTH_DEFAULT },
    { slotId: 'hardware', label: 'Ferramenta', default: HARDWARE_DEFAULT },
    { slotId: 'glass', label: 'Vetro', default: GLASS_DEFAULT },
    { slotId: 'appliance', label: 'Elettrodomestico', default: APPLIANCE_DEFAULT },
    {
      slotId: 'applianceInterior',
      label: 'Interno elettrodomestico',
      default: APPLIANCE_INTERIOR_DEFAULT,
    },
  ]
}
