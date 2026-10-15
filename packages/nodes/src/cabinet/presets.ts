import type { CabinetModuleNode, CabinetNode } from '@pascal-app/core'
import { CABINET_METRIC_DEFAULTS } from '@pascal-app/core'
import {
  COOKTOP_STANDARD_WIDTH,
  cooktopCabinetStack,
  DISHWASHER_STANDARD_WIDTH,
  FRIDGE_COLUMN_HEIGHT,
  FRIDGE_COLUMN_WIDTH,
  fridgeCabinetStack,
  MICROWAVE_STANDARD_WIDTH,
  newCabinetCompartment,
  SINK_STANDARD_WIDTH,
  sinkCabinetStack,
} from './stack'

export type CabinetPresetId =
  | 'base-door'
  | 'drawer-base'
  | 'dishwasher'
  | 'cooktop-gas'
  | 'cooktop-induction'
  | 'sink-base'
  | 'tall-pantry'
  | 'oven-tower'
  | 'fridge-single'

export type CabinetPreset = {
  id: CabinetPresetId
  label: string
  createPatch: (run?: CabinetNode) => Partial<CabinetModuleNode>
}

const baseShared = (run?: CabinetNode): Partial<CabinetModuleNode> => ({
  cabinetType: 'base',
  depth: run?.depth ?? CABINET_METRIC_DEFAULTS.depth,
  carcassHeight: run?.carcassHeight ?? CABINET_METRIC_DEFAULTS.carcassHeight,
  plinthHeight: run?.plinthHeight ?? CABINET_METRIC_DEFAULTS.plinthHeight,
  toeKickDepth: run?.toeKickDepth ?? 0.075,
  countertopThickness: 0,
  countertopOverhang: run?.countertopOverhang ?? 0.02,
  showPlinth: false,
  withCountertop: false,
})

const runDepth = (run?: CabinetNode) => run?.depth ?? CABINET_METRIC_DEFAULTS.depth
const runCarcassHeight = (run?: CabinetNode) =>
  run?.carcassHeight ?? CABINET_METRIC_DEFAULTS.carcassHeight

export const CABINET_PRESETS: CabinetPreset[] = [
  {
    id: 'base-door',
    label: 'Base',
    createPatch: (run) => ({
      ...baseShared(run),
      name: 'Base Cabinet',
      width: 0.5,
      handleStyle: 'bar',
      handlePosition: 'auto',
      frontOverlay: 'full',
      stack: [
        { ...newCabinetCompartment('drawer'), height: 0.44, drawerCount: 3 },
        { ...newCabinetCompartment('door'), doorType: 'double', shelfCount: 2 },
      ],
    }),
  },
  {
    id: 'drawer-base',
    label: 'Cassettiera',
    createPatch: (run) => ({
      ...baseShared(run),
      name: 'Cassettiera',
      width: 0.5,
      handleStyle: 'bar',
      handlePosition: 'top',
      frontOverlay: 'full',
      stack: [{ ...newCabinetCompartment('drawer'), drawerCount: 3 }],
    }),
  },
  {
    id: 'dishwasher',
    label: 'Lavastoviglie',
    createPatch: (run) => ({
      ...baseShared(run),
      name: 'Lavastoviglie',
      width: DISHWASHER_STANDARD_WIDTH,
      handleStyle: 'bar',
      handlePosition: 'top',
      frontOverlay: 'full',
      stack: [{ ...newCabinetCompartment('dishwasher'), height: runCarcassHeight(run) }],
    }),
  },
  {
    id: 'cooktop-gas',
    label: 'Piano a gas',
    createPatch: (run) => ({
      ...baseShared(run),
      name: 'Base con piano a gas',
      width: COOKTOP_STANDARD_WIDTH,
      handleStyle: 'bar',
      handlePosition: 'top',
      frontOverlay: 'full',
      stack: cooktopCabinetStack('cooktop-gas'),
    }),
  },
  {
    id: 'cooktop-induction',
    label: 'Induzione',
    createPatch: (run) => ({
      ...baseShared(run),
      name: 'Base con piano a induzione',
      width: COOKTOP_STANDARD_WIDTH,
      handleStyle: 'bar',
      handlePosition: 'top',
      frontOverlay: 'full',
      stack: cooktopCabinetStack('cooktop-induction'),
    }),
  },
  {
    id: 'sink-base',
    label: 'Lavello',
    createPatch: (run) => ({
      ...baseShared(run),
      name: 'Base lavello',
      width: SINK_STANDARD_WIDTH,
      handleStyle: 'bar',
      handlePosition: 'auto',
      frontOverlay: 'full',
      stack: sinkCabinetStack(),
    }),
  },
  {
    id: 'tall-pantry',
    label: 'Colonna dispensa',
    createPatch: (run) => ({
      cabinetType: 'tall',
      name: 'Colonna dispensa',
      width: 0.5,
      depth: run?.depth ?? CABINET_METRIC_DEFAULTS.depth,
      carcassHeight: 2.07,
      plinthHeight: CABINET_METRIC_DEFAULTS.plinthHeight,
      toeKickDepth: 0.075,
      countertopThickness: 0,
      countertopOverhang: run?.countertopOverhang ?? 0.02,
      showPlinth: false,
      withCountertop: false,
      handleStyle: 'bar',
      handlePosition: 'auto',
      frontOverlay: 'full',
      stack: [{ ...newCabinetCompartment('door'), doorType: 'double', shelfCount: 4 }],
    }),
  },
  {
    id: 'oven-tower',
    label: 'Colonna forno',
    createPatch: (run) => ({
      cabinetType: 'tall',
      name: 'Colonna forno',
      width: MICROWAVE_STANDARD_WIDTH,
      depth: run?.depth ?? CABINET_METRIC_DEFAULTS.depth,
      carcassHeight: 2.07,
      plinthHeight: CABINET_METRIC_DEFAULTS.plinthHeight,
      toeKickDepth: 0.075,
      countertopThickness: 0,
      countertopOverhang: run?.countertopOverhang ?? 0.02,
      showPlinth: false,
      withCountertop: false,
      handleStyle: 'bar',
      handlePosition: 'top',
      frontOverlay: 'full',
      stack: [
        { ...newCabinetCompartment('drawer'), height: 0.42, drawerCount: 2 },
        newCabinetCompartment('oven'),
        newCabinetCompartment('microwave'),
        { ...newCabinetCompartment('door'), doorType: 'double', shelfCount: 2 },
      ],
    }),
  },
  {
    id: 'fridge-single',
    label: 'Frigorifero',
    createPatch: (run) => ({
      cabinetType: 'tall',
      name: 'Frigorifero a una porta',
      width: FRIDGE_COLUMN_WIDTH,
      depth: runDepth(run),
      carcassHeight: FRIDGE_COLUMN_HEIGHT,
      plinthHeight: CABINET_METRIC_DEFAULTS.plinthHeight,
      toeKickDepth: 0.075,
      countertopThickness: 0,
      countertopOverhang: run?.countertopOverhang ?? 0.02,
      showPlinth: false,
      withCountertop: false,
      handleStyle: 'bar',
      handlePosition: 'center',
      frontOverlay: 'full',
      stack: fridgeCabinetStack('fridge-single'),
    }),
  },
]

export function cabinetPresetById(id: CabinetPresetId): CabinetPreset {
  return CABINET_PRESETS.find((preset) => preset.id === id) ?? CABINET_PRESETS[0]!
}
