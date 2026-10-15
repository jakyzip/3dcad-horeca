import type {
  AnyNode,
  AnyNodeDefinition,
  AnyNodeId,
  Capabilities,
  FloorplanGeometry,
  NodeDefinition,
  ParametricDescriptor,
  ParamField,
} from '@pascal-app/core'
import {
  type FloorplanNodeExtension,
  readFloorplanContext,
  withFloorplanGeometryMetadata,
} from '@pascal-app/editor'
import type { Object3D } from 'three'
import type { ZodObject, ZodType } from 'zod'
import { aggancia, dentroUnMuro, intorno, sagomaDi } from './aggancio'
import { allacciamentiFloorplan, levelWallFaces, readAllacciamenti } from './allacciamenti'
import { AllacciamentiField } from './allacciamenti-field'
import {
  controllaLivello,
  controlliFloorplan,
  descriviProblema,
  hostOf,
  readSoglie,
} from './controlli'
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
  movable: {
    axes: ['x', 'z'],
    gridSnap: true,
    // Against the walls and beside the other units (see `aggancio.ts`).
    groupMoveSnapPose: ({
      node,
      candidatePosition,
      candidateRotation,
      movingIds,
      nodes,
      levelId,
    }) => {
      const unit = node as unknown as EquipmentNode
      const { walls, others } = intorno(nodes, levelId, movingIds)
      const posa = aggancia(
        {
          centre: [candidatePosition[0], candidatePosition[2]],
          rotation: candidateRotation ?? unit.rotation,
        },
        sagomaDi(unit),
        walls,
        others,
      )
      return (
        posa && {
          position: [posa.centre[0], candidatePosition[1], posa.centre[1]],
          rotation: posa.rotation,
        }
      )
    },
    isValidPosition: ({ node, position, rotation, levelId, nodes }) =>
      !dentroUnMuro(
        { centre: [position[0], position[2]], rotation },
        sagomaDi(node as unknown as EquipmentNode),
        intorno(nodes, levelId, [node.id]).walls,
      ),
  },
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
  groups.push({
    label: 'Allacciamenti',
    fields: [
      {
        key: 'allacciamenti' as keyof EquipmentNode,
        kind: 'custom',
        component: AllacciamentiField,
      },
    ],
  })
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

/** The layout problems of the unit's level, with `node` standing where it is now (maybe mid-drag). */
function levelProblems(
  node: EquipmentNode,
  level: AnyNode | null,
  resolve: (id: AnyNodeId) => AnyNode | undefined,
) {
  const ids = (level as unknown as { children?: AnyNodeId[] } | null)?.children ?? []
  const equipment: EquipmentNode[] = []
  const walls: AnyNode[] = []
  for (const id of ids) {
    const child = (id as string) === node.id ? (node as unknown as AnyNode) : resolve(id)
    if (!child || child.visible === false) continue
    if (child.type === 'wall') walls.push(child)
    else if (EQUIPMENT_KINDS.includes(child.type)) equipment.push(child as unknown as EquipmentNode)
  }
  if (!equipment.some((e) => e.id === node.id)) equipment.push(node)
  const host = hostOf(node, resolve)
  return controllaLivello(equipment, walls, readSoglie(host?.metadata))
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
      const body = equipmentFloorplan(n, ctx, spec.marks, {
        label: articleLabel(n),
        dashed: Boolean(spec.wallMounted),
      })
      const parts: FloorplanGeometry[] = [body]
      // Layout warnings are a working aid: on screen, never on a sheet, DXF or preview.
      if (readFloorplanContext(ctx).purpose !== 'document') {
        const avvisi = controlliFloorplan(
          n,
          levelProblems(n, ctx.parent, (id) => ctx.resolve(id)),
        )
        if (avvisi) parts.push(avvisi)
      }
      const list = readAllacciamenti(n.metadata)
      if (!list.length) return parts.length > 1 ? { kind: 'group', children: parts } : body
      const faces = list.some((a) => a.quota)
        ? levelWallFaces(ctx.parent, (id) => ctx.resolve(id))
        : []
      // Asked for by the user, so they show and hide with the manual dimensions, not the automatic ones.
      const impianti = allacciamentiFloorplan(n, list, faces, (g) =>
        withFloorplanGeometryMetadata(g, { annotationRole: 'manual-dimension' }),
      )
      if (impianti) parts.push(impianti)
      return parts.length > 1 ? { kind: 'group', children: parts } : body
    },
    // Connection dimensions measure from the level's walls: their changes redraw the unit.
    // and the layout checks look at the other units and the project's thresholds too.
    floorplanDependencies: (node, nodes) => {
      const n = node as unknown as EquipmentNode
      if (!n.parentId) return []
      const level = nodes[n.parentId as AnyNodeId] as { children?: AnyNodeId[] } | undefined
      const ids = (level?.children ?? []).filter((id) => {
        const type = nodes[id]?.type
        return (id as string) !== n.id && (type === 'wall' || EQUIPMENT_KINDS.includes(type ?? ''))
      })
      const host = hostOf(n, (id) => nodes[id])
      return host ? [...ids, host.id as AnyNodeId] : ids
    },
    placementNotice: (node, { nodes, live }) => {
      const n = (live ? { ...node, ...live } : node) as unknown as EquipmentNode
      const resolve = (id: AnyNodeId) => nodes[id]
      const problemi = levelProblems(
        n,
        n.parentId ? (resolve(n.parentId as AnyNodeId) ?? null) : null,
        resolve,
      )
      const mine = problemi.filter(
        (p) => p.id === n.id || (p.tipo === 'sovrapposizione' && p.altro === n.id),
      )
      if (!mine.length) return null
      const nameOf = (id: string) => {
        const other = nodes[id] as unknown as EquipmentNode | undefined
        return other ? articleLabel(other) || 'un’altra attrezzatura' : 'un’altra attrezzatura'
      }
      const lines = mine.map((p) =>
        p.tipo === 'sovrapposizione' && p.altro === n.id
          ? descriviProblema({ ...p, altro: p.id }, nameOf)
          : descriviProblema(p, nameOf),
      )
      return { line: lines[0]!, detail: lines.length > 1 ? lines.slice(1).join(' ') : undefined }
    },
    system: {
      module: () =>
        import('./labels-3d').then(({ labelsSystemFor }) => ({
          default: labelsSystemFor(spec.kind, spec.label),
        })),
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
      description: `${spec.description} Position is level-local meters (y at the base), rotation is yaw radians, width/depth/height in meters, elevation is the underside height above the floor. The catalog article is metadata.product = { item_id (CRM catalog uuid), code, name }. Service connections are metadata.allacciamenti = [{ tipo: acqua-fredda|acqua-calda|scarico|elettrico-230|elettrico-400|gas, lato: retro|fronte|sinistra|destra, distanza (m along the side: from the left edge seen from the front on retro/fronte, from the back edge on sinistra/destra), altezza (m above the floor), potenza (kW, power and gas only), quota (dimension it in plan) }].`,
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
