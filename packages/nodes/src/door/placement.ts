// The door tool's placement choices: the chips [O] Type and [L] Style.

import type { DoorNode, ToolHint } from '@pascal-app/core'
import {
  DOOR_STYLE_LABELS,
  DOOR_STYLES,
  DOOR_TYPE_SIZES,
  type DoorStyle,
  doorStyleLook,
  doorTypeFields,
} from '@pascal-app/core/building'
import { create } from 'zustand'

/** The door panel's Type row and the tool's Type chip (garage types live under the panel's Garage). */
export const doorTypeOptions = [
  { label: 'A battente', value: 'hinged', available: true },
  { label: 'Doppia', value: 'double', available: true },
  { label: 'Portafinestra', value: 'french', available: true },
  { label: 'A libro', value: 'folding', available: true },
  { label: 'A scomparsa', value: 'pocket', available: true },
  { label: 'Scorrevole esterna', value: 'barn', available: true },
  { label: 'Scorrevole', value: 'sliding', available: true },
] satisfies {
  label: string
  value: DoorNode['doorType']
  available: boolean
}[]

type PlacedDoorType = (typeof doorTypeOptions)[number]['value']

type DoorPlacementState = {
  type: PlacedDoorType
  style: DoorStyle
  cycleType(): void
  cycleStyle(): void
}

const next = <T>(list: readonly T[], value: T) => list[(list.indexOf(value) + 1) % list.length]!

export const useDoorPlacement = create<DoorPlacementState>((set, get) => ({
  type: 'hinged',
  style: 'panel',
  cycleType: () =>
    set({
      type: next(
        doorTypeOptions.map((option) => option.value),
        get().type,
      ),
    }),
  cycleStyle: () => set({ style: next(DOOR_STYLES, get().style) }),
}))

/** The door the tool places: the chips' type and style, written as add_door and the panel write them. */
export function placedDoorFields(): Partial<DoorNode> {
  const { type, style } = useDoorPlacement.getState()
  return { ...doorTypeFields(type), ...DOOR_TYPE_SIZES[type], ...doorStyleLook(style) }
}

export const DOOR_PLACEMENT_HINTS: ToolHint[] = [
  {
    key: 'O',
    label: 'Tipo',
    chip: {
      subscribe: (onChange) => useDoorPlacement.subscribe(onChange),
      value: () => useDoorPlacement.getState().type,
      cycle: () => useDoorPlacement.getState().cycleType(),
      labels: Object.fromEntries(
        doorTypeOptions.map((option) => [option.value, `Tipo: ${option.label}`]),
      ),
      tooltip: 'Tipo di porta: fai clic o premi O per cambiare',
    },
  },
  {
    key: 'L',
    label: 'Stile',
    chip: {
      subscribe: (onChange) => useDoorPlacement.subscribe(onChange),
      value: () => useDoorPlacement.getState().style,
      cycle: () => useDoorPlacement.getState().cycleStyle(),
      labels: Object.fromEntries(
        DOOR_STYLES.map((style) => [style, `Stile: ${DOOR_STYLE_LABELS[style]}`]),
      ),
      tooltip: 'Stile della porta: fai clic o premi L per cambiare',
    },
  },
]
