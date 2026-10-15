import type { SlotDeclaration } from '../registry/types'
import { getCurtainWallConfig } from '../schema/nodes/curtain-wall'
import { WALL_SURFACE_SLOT_DEFAULTS, type WallNode } from '../schema/nodes/wall'

/**
 * A wall exposes two paintable faces — `a` (left of start → end) and `b` —
 * plus a skirting, crown and chair rail per face. Painting writes
 * `node.slots[slotId]` via `wallPaint` like every other kind; this declaration
 * surfaces the slot list + declared defaults for the picker and keeps walls on
 * the same `{ slotId, label, default }` contract. Paint regions and room
 * finishes are not slots: they live on `faceRegions` and on the zone.
 */
export function wallSlots(node?: WallNode): SlotDeclaration[] {
  if (node?.wallType === 'curtain') {
    const config = getCurtainWallConfig(node)
    return [
      { slotId: 'curtain-frame', label: 'Telaio', default: config.frameColor },
      { slotId: 'curtain-glass', label: 'Vetro', default: config.glassColor },
      { slotId: 'curtain-solid', label: 'Pannelli pieni', default: config.solidColor },
    ]
  }
  return [
    { slotId: 'a', label: 'Lato A', default: WALL_SURFACE_SLOT_DEFAULTS.a },
    { slotId: 'b', label: 'Lato B', default: WALL_SURFACE_SLOT_DEFAULTS.b },
    {
      slotId: 'aSkirting',
      label: 'Battiscopa (lato A)',
      default: WALL_SURFACE_SLOT_DEFAULTS.aSkirting,
    },
    {
      slotId: 'bSkirting',
      label: 'Battiscopa (lato B)',
      default: WALL_SURFACE_SLOT_DEFAULTS.bSkirting,
    },
    { slotId: 'aCrown', label: 'Cornice (lato A)', default: WALL_SURFACE_SLOT_DEFAULTS.aCrown },
    { slotId: 'bCrown', label: 'Cornice (lato B)', default: WALL_SURFACE_SLOT_DEFAULTS.bCrown },
    {
      slotId: 'aChairRail',
      label: 'Fascia paracolpi (lato A)',
      default: WALL_SURFACE_SLOT_DEFAULTS.aChairRail,
    },
    {
      slotId: 'bChairRail',
      label: 'Fascia paracolpi (lato B)',
      default: WALL_SURFACE_SLOT_DEFAULTS.bChairRail,
    },
    ...(node?.underpinning
      ? [
          {
            slotId: 'foundation',
            label: 'Fondazione',
            default: WALL_SURFACE_SLOT_DEFAULTS.foundation,
          },
        ]
      : []),
  ]
}
