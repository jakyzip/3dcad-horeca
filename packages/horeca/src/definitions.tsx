import type {
  AnyNode,
  AnyNodeDefinition,
  Capabilities,
  NodeDefinition,
  ParametricDescriptor,
  ParamField,
} from '@pascal-app/core'
import type { FloorplanNodeExtension } from '@pascal-app/editor'
import type { Object3D } from 'three'
import type { ZodObject, ZodType } from 'zod'
import type { DistintaNode } from './distinta'
import {
  bancoMarks,
  cellaMarks,
  diagonaleMarks,
  equipmentFloorplan,
  genericoMarks,
  lavelloMarks,
} from './floorplan'
import {
  buildBancoFrigoGeometry,
  buildCellaFrigoGeometry,
  buildGenericoGeometry,
  buildLavelloGeometry,
} from './geometry'
import {
  buildAbbattitoreGeometry,
  buildFrigoriferoGeometry,
  buildLavamaniGeometry,
  buildLavastoviglieGeometry,
  buildMantecatoreGeometry,
  buildPastorizzatoreGeometry,
  buildPensileGeometry,
  buildTavoloGeometry,
  buildTramoggiaGeometry,
} from './geometry-lab'
import { readProductRef } from './product'
import { ProductField } from './product-field'
import { equipmentSchedule } from './schedule'
import {
  ABBATTITORE,
  AbbattitoreNode,
  BANCO_FRIGO,
  BancoFrigoNode,
  CELLA_FRIGO,
  CellaFrigoNode,
  type EquipmentNode,
  FRIGORIFERO,
  FrigoriferoNode,
  GENERICO,
  GenericoNode,
  LAVAMANI,
  LAVASTOVIGLIE,
  LAVELLO,
  LavamaniNode,
  LavastoviglieNode,
  LavelloNode,
  MANTECATORE,
  MantecatoreNode,
  PASTORIZZATORE,
  PastorizzatoreNode,
  PENSILE,
  PensileNode,
  TAVOLO,
  TavoloNode,
  TRAMOGGIA,
  TramoggiaNode,
} from './schema'
import { ShapeField } from './shape-field'

type Marks = (hw: number, hd: number) => Array<[number, number, number, number]>

type EquipmentSpec<S extends ZodObject> = {
  kind: string
  schema: S
  label: string
  /** Schedule title: the kind in the plural. */
  plural: string
  description: string
  icon: string
  size: { width: number; depth: number; height: number }
  /** Wall-hung: placed at `elevation` above the floor, drawn dashed in plan. */
  wallMounted?: { elevation: number }
  /** Kind-specific yes/no options, shown under "Opzioni". */
  options?: ReadonlyArray<{ key: string; label: string }>
  build: (node: EquipmentNode) => Object3D
  marks: Marks
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

function parametricsFor(spec: EquipmentSpec<ZodObject>): ParametricDescriptor<EquipmentNode> {
  const number = (
    key: keyof EquipmentNode,
    label: string,
    min: number,
  ): ParamField<EquipmentNode> => ({
    key,
    label,
    kind: 'number',
    unit: 'm',
    min,
    step: 0.05,
  })
  const groups: ParametricDescriptor<EquipmentNode>['groups'] = [
    {
      label: 'Articolo',
      defaultExpanded: true,
      fields: [
        { key: 'product', kind: 'custom', component: ProductField },
        {
          key: 'shape',
          kind: 'custom',
          // Every equipment kind, read lazily: the list is complete only once all are defined.
          component: ({ node }) => <ShapeField kinds={EQUIPMENT_KINDS} node={node} />,
        },
      ],
    },
    {
      label: 'Dimensioni',
      fields: [
        number('width', 'Larghezza', 0.05),
        number('depth', 'Profondità', 0.05),
        number('height', 'Altezza', 0.05),
        {
          ...number('elevation', 'Altezza da terra', 0),
          // Also shown when a reshaped floor unit kept a height from a wall unit.
          visibleIf: (n) => Boolean(spec.wallMounted) || (n.elevation ?? 0) > 0,
        },
      ],
    },
  ]
  if (spec.options?.length) {
    groups.push({
      label: 'Opzioni',
      fields: spec.options.map(({ key, label }) => ({
        key: key as keyof EquipmentNode,
        label,
        kind: 'boolean' as const,
      })),
    })
  }
  return { groups }
}

/** The article code, else its name, else the node name: written inside the plan footprint. */
function articleLabel(node: EquipmentNode): string | undefined {
  const read = readProductRef(node.metadata)
  if (read.kind === 'article' || read.kind === 'local') return read.ref.code || read.ref.name
  return node.name
}

function defineEquipment<S extends ZodObject>(spec: EquipmentSpec<S>): AnyNodeDefinition {
  // The builder draws from the unit's underside; a wall-hung unit is lifted by its elevation.
  const build = (node: EquipmentNode) => {
    const object = spec.build(node)
    object.position.y = node.elevation ?? 0
    return object
  }
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
        elevation: spec.wallMounted?.elevation ?? 0,
      }) as never,
    capabilities,
    parametrics: parametricsFor(spec as unknown as EquipmentSpec<ZodObject>) as never,
    geometry: (node) => build(node as unknown as EquipmentNode),
    geometryKey: (node) => {
      const n = node as unknown as EquipmentNode
      return JSON.stringify([n.width, n.depth, n.height, n.elevation, n.ripiano, n.gocciolatoio])
    },
    floorplan: (node, ctx) => {
      const n = node as unknown as EquipmentNode
      return equipmentFloorplan(n, ctx, spec.marks, {
        label: articleLabel(n),
        dashed: Boolean(spec.wallMounted),
      })
    },
    tool: () =>
      import('./tool').then(({ placementToolFor }) => ({
        default: placementToolFor({
          kind: spec.kind,
          schema: spec.schema as unknown as ZodType<EquipmentNode>,
          build,
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
      description: `${spec.description} Position is level-local meters (y at the base), rotation is yaw radians, width/depth/height in meters, elevation is the underside height above the floor. The catalog article is metadata.product = { item_id (CRM catalog uuid), code, name }.`,
    },
  }
  // Plugin kinds sit outside the closed AnyNode union (see plugin-authoring.md).
  return definition as unknown as AnyNodeDefinition
}

const as = (build: (node: never) => Object3D) => build as (node: EquipmentNode) => Object3D

export const bancoFrigoDefinition = defineEquipment({
  kind: BANCO_FRIGO,
  schema: BancoFrigoNode,
  label: 'Banco frigo',
  plural: 'Banchi frigo',
  description: 'Banco refrigerato in acciaio inox con piano di lavoro e porte frontali.',
  icon: '/icons/horeca/banco-frigo.svg',
  size: { width: 1.5, depth: 0.7, height: 0.85 },
  build: as(buildBancoFrigoGeometry),
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
  build: as(buildCellaFrigoGeometry),
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
  build: as(buildLavelloGeometry),
  marks: lavelloMarks,
  paletteOrder: 30,
})

export const tavoloDefinition = defineEquipment({
  kind: TAVOLO,
  schema: TavoloNode,
  label: 'Tavolo su gambe',
  plural: 'Tavoli',
  description: 'Tavolo inox su quattro gambe, con ripiano inferiore facoltativo.',
  icon: '/icons/horeca/tavolo.svg',
  size: { width: 1.4, depth: 0.7, height: 0.9 },
  options: [{ key: 'ripiano', label: 'Ripiano sotto' }],
  build: as(buildTavoloGeometry),
  marks: genericoMarks,
  paletteOrder: 40,
})

export const pensileDefinition = defineEquipment({
  kind: PENSILE,
  schema: PensileNode,
  label: 'Pensile',
  plural: 'Pensili',
  description: 'Pensile inox a parete con ante scorrevoli, anche con gocciolatoio.',
  icon: '/icons/horeca/pensile.svg',
  size: { width: 1.2, depth: 0.4, height: 0.65 },
  wallMounted: { elevation: 1.5 },
  options: [{ key: 'gocciolatoio', label: 'Gocciolatoio (senza fondo)' }],
  build: as(buildPensileGeometry),
  marks: diagonaleMarks,
  paletteOrder: 45,
})

export const lavamaniDefinition = defineEquipment({
  kind: LAVAMANI,
  schema: LavamaniNode,
  label: 'Lava-mani',
  plural: 'Lava-mani',
  description: 'Lava-mani inox a parete con alzatina e rubinetto.',
  icon: '/icons/horeca/lavamani.svg',
  size: { width: 0.45, depth: 0.35, height: 0.3 },
  wallMounted: { elevation: 0.55 },
  build: as(buildLavamaniGeometry),
  marks: lavelloMarks,
  paletteOrder: 35,
})

export const lavastoviglieDefinition = defineEquipment({
  kind: LAVASTOVIGLIE,
  schema: LavastoviglieNode,
  label: 'Lavastoviglie',
  plural: 'Lavastoviglie',
  description: 'Lavastoviglie sottobanco con porta a ribalta.',
  icon: '/icons/horeca/lavastoviglie.svg',
  size: { width: 0.6, depth: 0.6, height: 0.85 },
  build: as(buildLavastoviglieGeometry),
  marks: bancoMarks,
  paletteOrder: 50,
})

export const abbattitoreDefinition = defineEquipment({
  kind: ABBATTITORE,
  schema: AbbattitoreNode,
  label: 'Abbattitore',
  plural: 'Abbattitori',
  description: 'Abbattitore di temperatura con porta frontale e griglia di aerazione.',
  icon: '/icons/horeca/abbattitore.svg',
  size: { width: 0.75, depth: 0.74, height: 0.88 },
  build: as(buildAbbattitoreGeometry),
  marks: bancoMarks,
  paletteOrder: 55,
})

export const mantecatoreDefinition = defineEquipment({
  kind: MANTECATORE,
  schema: MantecatoreNode,
  label: 'Mantecatore',
  plural: 'Mantecatori',
  description: 'Mantecatore per gelato su ruote, con tramoggia e cilindro di uscita frontale.',
  icon: '/icons/horeca/mantecatore.svg',
  size: { width: 0.55, depth: 0.7, height: 1.4 },
  build: as(buildMantecatoreGeometry),
  marks: diagonaleMarks,
  paletteOrder: 60,
})

export const pastorizzatoreDefinition = defineEquipment({
  kind: PASTORIZZATORE,
  schema: PastorizzatoreNode,
  label: 'Pastorizzatore',
  plural: 'Pastorizzatori',
  description: 'Pastorizzatore su ruote con vasca verticale e rubinetto frontale.',
  icon: '/icons/horeca/pastorizzatore.svg',
  size: { width: 0.5, depth: 0.8, height: 1.3 },
  build: as(buildPastorizzatoreGeometry),
  marks: diagonaleMarks,
  paletteOrder: 65,
})

export const frigoriferoDefinition = defineEquipment({
  kind: FRIGORIFERO,
  schema: FrigoriferoNode,
  label: 'Frigorifero',
  plural: 'Frigoriferi',
  description: 'Frigorifero verticale con porta frigo e porta congelatore.',
  icon: '/icons/horeca/frigorifero.svg',
  size: { width: 0.6, depth: 0.65, height: 1.85 },
  build: as(buildFrigoriferoGeometry),
  marks: bancoMarks,
  paletteOrder: 70,
})

export const tramoggiaDefinition = defineEquipment({
  kind: TRAMOGGIA,
  schema: TramoggiaNode,
  label: 'Tramoggia su ruote',
  plural: 'Tramogge',
  description: 'Contenitore inox su ruote con coperchio, per gli ingredienti.',
  icon: '/icons/horeca/tramoggia.svg',
  size: { width: 0.4, depth: 0.6, height: 0.7 },
  build: as(buildTramoggiaGeometry),
  marks: cellaMarks,
  paletteOrder: 75,
})

export const genericoDefinition = defineEquipment({
  kind: GENERICO,
  schema: GenericoNode,
  label: 'Attrezzatura generica',
  plural: 'Altre attrezzature',
  description: 'Blocco con le misure dell’articolo, per le categorie senza una forma dedicata.',
  icon: '/icons/horeca/generico.svg',
  size: { width: 0.6, depth: 0.6, height: 0.85 },
  build: as(buildGenericoGeometry),
  marks: genericoMarks,
  paletteOrder: 90,
})

export const EQUIPMENT_DEFINITIONS = [
  bancoFrigoDefinition,
  cellaFrigoDefinition,
  lavelloDefinition,
  lavamaniDefinition,
  tavoloDefinition,
  pensileDefinition,
  lavastoviglieDefinition,
  abbattitoreDefinition,
  mantecatoreDefinition,
  pastorizzatoreDefinition,
  frigoriferoDefinition,
  tramoggiaDefinition,
  genericoDefinition,
]
export const EQUIPMENT_KINDS: readonly string[] = [
  BANCO_FRIGO,
  CELLA_FRIGO,
  LAVELLO,
  LAVAMANI,
  TAVOLO,
  PENSILE,
  LAVASTOVIGLIE,
  ABBATTITORE,
  MANTECATORE,
  PASTORIZZATORE,
  FRIGORIFERO,
  TRAMOGGIA,
  GENERICO,
]
