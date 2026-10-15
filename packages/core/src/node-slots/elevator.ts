import type { SlotDeclaration } from '../registry/types'
import type { ElevatorNode } from '../schema/nodes/elevator'
import {
  getResolvedElevatorDoorPanelStyle,
  getResolvedElevatorShaftStyle,
} from '../systems/elevator/elevator-geometry'

export type ElevatorSlotId = 'cab' | 'doors' | 'shaft' | 'glass'

export const ELEVATOR_CAB_SLOT_DEFAULT = 'library:preset-softwhite'
export const ELEVATOR_DOORS_SLOT_DEFAULT = 'library:metal-steel'
export const ELEVATOR_SHAFT_SLOT_DEFAULT = 'library:preset-lightgrey'
export const ELEVATOR_GLASS_SLOT_DEFAULT = 'library:preset-glass'

export function elevatorSlots(node: ElevatorNode): SlotDeclaration[] {
  const slots: SlotDeclaration[] = [
    { slotId: 'cab', label: 'Cabina', default: ELEVATOR_CAB_SLOT_DEFAULT },
    { slotId: 'doors', label: 'Porte', default: ELEVATOR_DOORS_SLOT_DEFAULT },
    { slotId: 'shaft', label: 'Vano', default: ELEVATOR_SHAFT_SLOT_DEFAULT },
  ]

  const hasGlass =
    getResolvedElevatorShaftStyle(node.shaftStyle) === 'glass' ||
    getResolvedElevatorDoorPanelStyle(node.doorPanelStyle) === 'glass-frame'

  if (hasGlass)
    slots.push({ slotId: 'glass', label: 'Vetro', default: ELEVATOR_GLASS_SLOT_DEFAULT })

  return slots
}
