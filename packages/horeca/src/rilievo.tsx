import type {
  AnyNodeDefinition,
  Capabilities,
  FloorplanGeometry,
  GeometryContext,
  NodeDefinition,
  ParametricDescriptor,
} from '@pascal-app/core'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three'
import { UNIT_CHOICES } from './dxf-import'
import { formatLength, planTransform, RILIEVO, RilievoNode } from './rilievo-schema'
import { RilievoToolsField } from './rilievo-tools-field'

export { formatLength, planTransform, RILIEVO, RilievoNode } from './rilievo-schema'

/**
 * A survey drawing imported from DXF (see `dxf-import.ts`): a reference to trace over, like the
 * editor's guide images but vector, with layers and dimensions. It is not equipment: it never
 * enters the distinta and it is left out of exports (`bake: 'strip'`).
 */

const LINE = '#6b7280'
const TEXT = '#4b5563'
const DIMENSION = '#2563eb'

const fmt = (v: number) => Number(v.toFixed(4))

export function rilievoFloorplan(node: RilievoNode, ctx: GeometryContext): FloorplanGeometry {
  const at = planTransform(node)
  const shown = new Set(node.layers.filter((l) => l.visible).map((l) => l.name))
  const view = ctx.viewState
  const selected = (view?.selected || view?.highlighted) ?? false
  const children: FloorplanGeometry[] = []

  for (const layer of node.layers) {
    if (!layer.visible || layer.segments.length < 4) continue
    const s = layer.segments
    let d = ''
    for (let i = 0; i + 3 < s.length; i += 4) {
      const a = at(s[i]!, s[i + 1]!)
      const b = at(s[i + 2]!, s[i + 3]!)
      d += `M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}`
    }
    children.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke: LINE,
      strokeWidth: 1,
      vectorEffect: 'non-scaling-stroke',
      opacity: node.opacity,
      pointerEvents: 'none',
    })
  }

  for (const t of node.texts) {
    if (!shown.has(t.layer)) continue
    children.push({
      kind: 'group',
      transform: { translate: at(t.x, t.y), rotate: t.angle - node.rotation },
      children: [
        {
          kind: 'text',
          x: 0,
          y: 0,
          text: t.text,
          fontSize: Math.max(0.02, t.height * node.unit),
          fill: TEXT,
          textAnchor: t.anchor,
          dominantBaseline: t.baseline,
          opacity: node.opacity,
        },
      ],
    })
  }

  for (const dim of node.dimensions) {
    if (!shown.has(dim.layer)) continue
    const a = at(...dim.a)
    const b = at(...dim.b)
    const lineA = at(...dim.lineA)
    const lineB = at(...dim.lineB)
    const length = Math.hypot(lineB[0] - lineA[0], lineB[1] - lineA[1])
    // Offset direction: from the measured point to the dimension line, else perpendicular.
    let nx = lineA[0] - a[0]
    let ny = lineA[1] - a[1]
    let offset = Math.hypot(nx, ny)
    if (offset < 1e-6) {
      nx = -(lineB[1] - lineA[1])
      ny = lineB[0] - lineA[0]
      offset = 0
    }
    const n = Math.hypot(nx, ny) || 1
    children.push({
      kind: 'dimension',
      start: a,
      end: b,
      dimensionStart: lineA,
      dimensionEnd: lineB,
      offsetNormal: [nx / n, ny / n],
      offsetDistance: offset,
      extensionOvershoot: 0.05,
      text: formatLength(length),
      stroke: DIMENSION,
    })
  }

  // The drawing's frame: dashed, and the place to grab it (the lines themselves let clicks through).
  const [w, h] = node.size
  const corners = [at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)]
  children.push({
    kind: 'polygon',
    points: corners,
    fill: 'none',
    stroke: selected && view?.palette ? view.palette.selectedStroke : LINE,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
    strokeDasharray: '6 4',
    opacity: selected ? 1 : 0.5,
    pointerEvents: 'none',
  })
  corners.forEach((p, i) => {
    const q = corners[(i + 1) % 4]!
    children.push({ kind: 'hit-line', x1: p[0], y1: p[1], x2: q[0], y2: q[1], strokeWidthPx: 10 })
  })
  if (selected) children.push({ kind: 'move-handle', point: [node.position[0], node.position[2]] })
  return { kind: 'group', children }
}

/** 3D: the visible layers as thin lines just above the floor. */
export function buildRilievoGeometry(node: RilievoNode): Group {
  const group = new Group()
  const u = node.unit
  const positions: number[] = []
  for (const layer of node.layers) {
    if (!layer.visible) continue
    const s = layer.segments
    for (let i = 0; i + 3 < s.length; i += 4)
      positions.push(s[i]! * u, 0.003, s[i + 1]! * u, s[i + 2]! * u, 0.003, s[i + 3]! * u)
  }
  if (positions.length === 0) return group
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({ color: LINE, transparent: true, opacity: node.opacity }),
  )
  lines.name = 'rilievo-lines'
  // Reference only: never in the way of picking what stands on it.
  lines.raycast = () => {}
  group.add(lines)
  return group
}

const capabilities: Capabilities = {
  selectable: { hitVolume: 'bbox' },
  movable: { axes: ['x', 'z'], gridSnap: false },
  rotatable: { axes: ['y'] },
  duplicable: false,
  deletable: true,
}

function UnitField({
  node,
  onUpdate,
}: {
  node: RilievoNode
  onUpdate: (patch: Partial<RilievoNode>) => void
}) {
  const [w, h] = node.size
  return (
    <div className="flex flex-col gap-2 text-xs">
      {node.source && <span className="truncate text-muted-foreground">{node.source}</span>}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Il disegno è in</span>
        <select
          className="h-8 rounded-md border border-border/60 bg-background px-2 text-foreground text-sm"
          onChange={(e) => onUpdate({ unit: Number(e.target.value) })}
          value={node.unit}
        >
          {UNIT_CHOICES.map((c) => (
            <option key={c.unit} value={c.unit}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <span className="text-muted-foreground">
        Ingombro: {formatLength(w * node.unit)} × {formatLength(h * node.unit)}. Se è sbagliato,
        cambia l’unità.
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Rotazione (gradi)</span>
        <input
          className="h-8 rounded-md border border-border/60 bg-background px-2 text-foreground text-sm"
          defaultValue={Number(((node.rotation * 180) / Math.PI).toFixed(2))}
          key={node.rotation}
          onBlur={(e) => {
            const deg = Number(e.target.value.replace(',', '.'))
            if (Number.isFinite(deg)) onUpdate({ rotation: (deg * Math.PI) / 180 })
          }}
          type="text"
        />
      </label>
    </div>
  )
}

function LayersField({
  node,
  onUpdate,
}: {
  node: RilievoNode
  onUpdate: (patch: Partial<RilievoNode>) => void
}) {
  const setAll = (visible: boolean) =>
    onUpdate({ layers: node.layers.map((l) => ({ ...l, visible })) })
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex gap-2">
        <button className="underline" onClick={() => setAll(true)} type="button">
          Tutti
        </button>
        <button className="underline" onClick={() => setAll(false)} type="button">
          Nessuno
        </button>
      </div>
      {node.layers.map((layer, i) => (
        <label className="flex cursor-pointer items-center gap-2" key={layer.name}>
          <input
            checked={layer.visible}
            onChange={(e) =>
              onUpdate({
                layers: node.layers.map((l, j) =>
                  j === i ? { ...l, visible: e.target.checked } : l,
                ),
              })
            }
            type="checkbox"
          />
          <span className="truncate">{layer.name}</span>
        </label>
      ))}
    </div>
  )
}

const parametrics: ParametricDescriptor<RilievoNode> = {
  groups: [
    {
      label: 'Rilievo',
      defaultExpanded: true,
      fields: [
        { key: 'unit-rotation', kind: 'custom', component: UnitField },
        { key: 'opacity', label: 'Opacità', kind: 'number', min: 0.1, max: 1, step: 0.1 },
      ],
    },
    {
      label: 'Layer',
      defaultExpanded: true,
      fields: [{ key: 'layers-list', kind: 'custom', component: LayersField }],
    },
    {
      label: 'Usa il rilievo',
      defaultExpanded: true,
      fields: [{ key: 'rilievo-tools', kind: 'custom', component: RilievoToolsField }],
    },
  ],
}

const definition: NodeDefinition<typeof RilievoNode> = {
  kind: RILIEVO,
  schemaVersion: 1,
  schema: RilievoNode,
  category: 'site',
  bake: 'strip',
  defaults: () =>
    ({
      object: 'node',
      parentId: null,
      visible: true,
      metadata: {},
      position: [0, 0, 0],
      rotation: 0,
      unit: 0.001,
      opacity: 0.8,
      source: '',
      size: [0, 0],
      layers: [],
      texts: [],
      dimensions: [],
    }) as never,
  capabilities,
  parametrics: parametrics as never,
  geometry: (node) => buildRilievoGeometry(node as unknown as RilievoNode),
  geometryKey: (node) => {
    const n = node as unknown as RilievoNode
    return JSON.stringify([n.unit, n.opacity, n.layers.map((l) => l.visible), n.layers.length])
  },
  floorplan: (node, ctx) => rilievoFloorplan(node as unknown as RilievoNode, ctx),
  presentation: {
    label: 'Rilievo DXF',
    description: 'Disegno DXF importato come base da ricalcare.',
    icon: { kind: 'url', src: '/icons/horeca/rilievo.svg' },
    paletteSection: 'site',
    hidden: true,
  },
  mcp: {
    description:
      'Survey drawing imported from a DXF file, used as a reference to trace walls over. Coordinates are drawing units (unit = metres per drawing unit), centred on the drawing, plan axes (y down).',
  },
}

// Plugin kinds sit outside the closed AnyNode union (see plugin-authoring.md).
export const rilievoDefinition = definition as unknown as AnyNodeDefinition
