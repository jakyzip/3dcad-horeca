import type { SlotDeclaration } from '../registry/types'
import type { StairNode } from '../schema/nodes/stair'

export type StairSlotId = 'treads' | 'body' | 'railing' | 'infill'

export const STAIR_TREADS_SLOT_DEFAULT = 'library:wood-woodplank48'
export const STAIR_BODY_SLOT_DEFAULT = 'library:preset-lightgrey'
export const STAIR_RAILING_SLOT_DEFAULT = 'library:metal-steel'

/** A flight's own treads and body, over the stair's. */
export function stairSegmentSlots(): SlotDeclaration[] {
  return [
    { slotId: 'treads', label: 'Pedate', default: STAIR_TREADS_SLOT_DEFAULT },
    { slotId: 'body', label: 'Struttura', default: STAIR_BODY_SLOT_DEFAULT },
  ]
}

export function stairSlots(node: StairNode): SlotDeclaration[] {
  const slots: SlotDeclaration[] = stairSegmentSlots()

  if (node.railingMode && node.railingMode !== 'none') {
    slots.push({ slotId: 'railing', label: 'Ringhiera', default: STAIR_RAILING_SLOT_DEFAULT })
  }

  if (node.railingMode !== 'none' && node.railingStyle === 'glass')
    slots.push({
      slotId: 'infill',
      label: 'Tamponamento in vetro',
      default: 'library:preset-glass',
    })
  if (node.handrail && node.handrail.mode !== 'none' && node.railingMode === 'none')
    slots.push({ slotId: 'railing', label: 'Corrimano', default: STAIR_RAILING_SLOT_DEFAULT })
  return slots
}
