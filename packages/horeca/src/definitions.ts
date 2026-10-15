import type {
  AnyNode,
  AnyNodeDefinition,
  Capabilities,
  NodeDefinition,
  ParametricDescriptor,
} from '@pascal-app/core'
import type { FloorplanNodeExtension } from '@pascal-app/editor'
import type { Object3D } from 'three'
import type { ZodObject, ZodType } from 'zod'
import type { DistintaNode } from './distinta'
import { bancoMarks, cellaMarks, equipmentFloorplan, lavelloMarks } from './floorplan'
import { buildBancoFrigoGeometry, buildCellaFrigoGeometry, buildLavelloGeometry } from './geometry'
import { ProductField } from './product-field'
import { equipmentSchedule } from './schedule'
import {
  BANCO_FRIGO,
  BancoFrigoNode,
  CELLA_FRIGO,
  CellaFrigoNode,
  type EquipmentNode,
  LAVELLO,
  LavelloNode,
} from './schema'

type EquipmentSpec<S extends ZodObject> = {
  kind: string
  schema: S
  label: string
  /** Schedule title: the kind in the plural. */
  plural: string
  description: string
  icon: string
  size: { width: number; depth: number; height: number }
  build: (node: EquipmentNode) => Object3D
  marks: (hw: number, hd: number) => Array<[number, number, number, number]>
  paletteOrder: number
}

const capabilities: Capabilities = {
  selectable: { hitVolume: 'bbox' },
  movable: { axes: ['x', 'z'], gridSnap: true },
  rotatable: { axes: ['y'], snapAngles: [Math.PI / 4] },
  duplicable: true,
  deletable: true,
  floorPlaced: {
    footprint: (node) => {
      const n = node as unknown as EquipmentNode
      return { dimensions: [n.width, n.height, n.depth], rotation: [0, n.rotation, 0] }
    },
  },
}

const parametrics: ParametricDescriptor<EquipmentNode> = {
  groups: [
    {
      label: 'Articolo',
      defaultExpanded: true,
      fields: [{ key: 'product', kind: 'custom', component: ProductField }],
    },
    {
      label: 'Dimensioni',
      fields: [
        { key: 'width', label: 'Larghezza', kind: 'number', unit: 'm', min: 0.2, step: 0.05 },
        { key: 'depth', label: 'Profondità', kind: 'number', unit: 'm', min: 0.2, step: 0.05 },
        { key: 'height', label: 'Altezza', kind: 'number', unit: 'm', min: 0.2, step: 0.05 },
      ],
    },
  ],
}

function defineEquipment<S extends ZodObject>(spec: EquipmentSpec<S>): AnyNodeDefinition {
  const definition: NodeDefinition<S> = {
    kind: spec.kind,
    schemaVersion: 1,
    schema: spec.schema,
    category: 'furnish',
    snapProfile: 'item',
    defaults: () =>
      ({
        object: 'node',
        parentId: null,
        visible: true,
        metadata: {},
        position: [0, 0, 0],
        rotation: 0,
        ...spec.size,
      }) as never,
    capabilities,
    parametrics: parametrics as never,
    geometry: (node) => spec.build(node as unknown as EquipmentNode),
    geometryKey: (node) => {
      const n = node as unknown as EquipmentNode
      return JSON.stringify([n.width, n.depth, n.height])
    },
    floorplan: (node, ctx) => equipmentFloorplan(node as unknown as EquipmentNode, ctx, spec.marks),
    tool: () =>
      import('./tool').then(({ placementToolFor }) => ({
        default: placementToolFor({
          kind: spec.kind,
          schema: spec.schema as unknown as ZodType<EquipmentNode>,
          build: spec.build,
        }),
      })),
    toolHints: [
      { key: 'Clic', label: 'Posiziona' },
      { key: 'R / T', label: 'Ruota ±45°' },
      { key: 'Esc', label: 'Esci' },
    ],
    presentation: {
      label: spec.label,
      description: spec.description,
      icon: { kind: 'url', src: spec.icon },
      paletteSection: 'furnish',
      paletteOrder: spec.paletteOrder,
    },
    extensions: {
      'pascal:editor/floorplan': {
        schedule: ({ siblings }) =>
          equipmentSchedule(spec.kind, spec.plural, siblings as unknown as DistintaNode[]),
      } satisfies FloorplanNodeExtension<AnyNode>,
    },
    mcp: {
      description: `${spec.description} Floor-placed: position is level-local meters (y at the base), rotation is yaw radians, width/depth/height in meters. The catalog article is metadata.product = { item_id (CRM catalog uuid), code, name }.`,
    },
  }
  // Plugin kinds sit outside the closed AnyNode union (see plugin-authoring.md).
  return definition as unknown as AnyNodeDefinition
}

export const bancoFrigoDefinition = defineEquipment({
  kind: BANCO_FRIGO,
  schema: BancoFrigoNode,
  label: 'Banco frigo',
  plural: 'Banchi frigo',
  description: 'Banco refrigerato in acciaio inox con piano di lavoro e porte frontali.',
  icon: '/icons/horeca/banco-frigo.svg',
  size: { width: 1.5, depth: 0.7, height: 0.85 },
  build: buildBancoFrigoGeometry as (node: EquipmentNode) => Object3D,
  marks: bancoMarks,
  paletteOrder: 10,
})

export const cellaFrigoDefinition = defineEquipment({
  kind: CELLA_FRIGO,
  schema: CellaFrigoNode,
  label: 'Cella frigo',
  plural: 'Celle frigo',
  description: 'Cella frigorifera modulare a pannelli, con porta sul fronte.',
  icon: '/icons/horeca/cella-frigo.svg',
  size: { width: 2, depth: 2, height: 2.2 },
  build: buildCellaFrigoGeometry as (node: EquipmentNode) => Object3D,
  marks: cellaMarks,
  paletteOrder: 20,
})

export const lavelloDefinition = defineEquipment({
  kind: LAVELLO,
  schema: LavelloNode,
  label: 'Lavello inox',
  plural: 'Lavelli',
  description: 'Lavello inox su mobile, con vasca e rubinetto.',
  icon: '/icons/horeca/lavello.svg',
  size: { width: 1.2, depth: 0.7, height: 0.9 },
  build: buildLavelloGeometry as (node: EquipmentNode) => Object3D,
  marks: lavelloMarks,
  paletteOrder: 30,
})

export const EQUIPMENT_DEFINITIONS = [bancoFrigoDefinition, cellaFrigoDefinition, lavelloDefinition]
export const EQUIPMENT_KINDS: readonly string[] = [BANCO_FRIGO, CELLA_FRIGO, LAVELLO]
