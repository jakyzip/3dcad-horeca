import type { FloorplanGeometry, FloorplanPoint } from '@pascal-app/core'
import {
  BlockFlags,
  DxfWriter,
  point3d,
  TextHorizontalAlignment,
  TextVerticalAlignment,
  Units,
} from '@tarikjabiri/dxf'
import { pathToPolylines } from './svg-path'

/**
 * The floor plan as DXF, in millimetres, for AutoCAD and the like. The input is what the editor's
 * sheet export collects for a level (`collectSheetGeometry`): plan primitives in level metres with
 * y pointing down. Each kind goes on its own layer; dimensions are real DIMENSION entities with
 * their drawn block, so they show in programs that do not rebuild dimensions themselves.
 */

export type DxfExportEntry = {
  type: string
  model: FloorplanGeometry | null
  annotations: FloorplanGeometry | null
}

/** Layer name and AutoCAD colour index. */
const LAYERS: Record<string, number> = {
  MURI: 7,
  APERTURE: 4,
  SOLAI: 8,
  AMBIENTI: 3,
  SCALE: 30,
  PILASTRI: 7,
  ARREDI: 6,
  ATTREZZATURE: 5,
  RILIEVO: 9,
  QUOTE: 1,
  TESTI: 2,
  ALTRO: 8,
}

export function layerForKind(type: string): string {
  if (type === 'wall' || type === 'fence') return 'MURI'
  if (type === 'door' || type === 'window') return 'APERTURE'
  if (type === 'slab' || type === 'ceiling' || type === 'roof') return 'SOLAI'
  if (type === 'zone') return 'AMBIENTI'
  if (type === 'stair') return 'SCALE'
  if (type === 'column') return 'PILASTRI'
  if (type === 'item' || type === 'shelf') return 'ARREDI'
  if (type === 'measurement') return 'QUOTE'
  if (type === 'horeca:rilievo') return 'RILIEVO'
  if (type.startsWith('horeca:')) return 'ATTREZZATURE'
  return 'ALTRO'
}

/** Affine transform in plan space: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Matrix = [number, number, number, number, number, number]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function compose(m: Matrix, translate: FloorplanPoint = [0, 0], rotate = 0): Matrix {
  const cos = Math.cos(rotate)
  const sin = Math.sin(rotate)
  // m · translate · rotate (SVG order: the group's children are rotated, then moved).
  const [a, b, c, d, e, f] = m
  const [tx, ty] = translate
  return [
    a * cos + c * sin,
    b * cos + d * sin,
    -a * sin + c * cos,
    -b * sin + d * cos,
    a * tx + c * ty + e,
    b * tx + d * ty + f,
  ]
}

const MM = 1000
const TICK = 0.06
const DIM_TEXT = 0.12

type Writer = {
  /** A white fill an opening lays over its wall in the plan: the wall lines are cut there. */
  mask: (points: readonly FloorplanPoint[]) => void
  line: (layer: string, a: FloorplanPoint, b: FloorplanPoint) => void
  polyline: (layer: string, points: readonly FloorplanPoint[], closed: boolean) => void
  circle: (layer: string, center: FloorplanPoint, radius: number) => void
  text: (
    layer: string,
    at: FloorplanPoint,
    height: number,
    value: string,
    angle: number,
    anchor?: string,
    baseline?: string,
  ) => void
  dimension: (
    a: FloorplanPoint,
    b: FloorplanPoint,
    lineA: FloorplanPoint,
    lineB: FloorplanPoint,
    text: string,
    overshoot: number,
  ) => void
}

const isWhite = (fill: unknown) =>
  typeof fill === 'string' &&
  /^(#fff(fff)?|white|rgba?\(255, ?255, ?255(, ?1)?\))$/i.test(fill.trim())

function isConvex(points: readonly FloorplanPoint[]): boolean {
  let sign = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const c = points[(i + 2) % points.length]!
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(cross) < 1e-12) continue
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return sign !== 0
}

/** The parameter range [t0, t1] of segment a→b inside a convex polygon (boundary included), or null. */
function insideRange(
  a: FloorplanPoint,
  b: FloorplanPoint,
  polygon: readonly FloorplanPoint[],
  orientation: number,
): [number, number] | null {
  let t0 = 0
  let t1 = 1
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!
    const q = polygon[(i + 1) % polygon.length]!
    // Inward normal of edge p→q.
    const nx = -(q[1] - p[1]) * orientation
    const ny = (q[0] - p[0]) * orientation
    const num = nx * (a[0] - p[0]) + ny * (a[1] - p[1])
    const den = nx * dx + ny * dy
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null
      continue
    }
    const t = -num / den
    if (den > 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return null
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null
}

/** Grow a convex polygon by `d` from its centre, so lines lying on its edge count as inside. */
function grow(points: readonly FloorplanPoint[], d: number): FloorplanPoint[] {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length
  return points.map(([x, y]) => {
    const l = Math.hypot(x - cx, y - cy) || 1
    return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d]
  })
}

/** Wall lines minus the parts under opening masks. */
export function cutWalls(
  lines: ReadonlyArray<{ points: readonly FloorplanPoint[]; closed: boolean }>,
  masks: ReadonlyArray<readonly FloorplanPoint[]>,
): Array<[FloorplanPoint, FloorplanPoint]> {
  const shapes = masks.map((m) => {
    const g = grow(m, 0.002)
    let area = 0
    for (let i = 0; i < g.length; i++) {
      const p = g[i]!
      const q = g[(i + 1) % g.length]!
      area += p[0] * q[1] - q[0] * p[1]
    }
    return { points: g, orientation: Math.sign(area) || 1 }
  })
  const out: Array<[FloorplanPoint, FloorplanPoint]> = []
  for (const line of lines) {
    const pts = line.closed ? [...line.points, line.points[0]!] : line.points
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      let keep: Array<[number, number]> = [[0, 1]]
      for (const shape of shapes) {
        const cut = insideRange(a, b, shape.points, shape.orientation)
        if (!cut) continue
        keep = keep.flatMap(([s, e]): Array<[number, number]> => {
          const parts: Array<[number, number]> = []
          if (cut[0] > s) parts.push([s, Math.min(e, cut[0])])
          if (cut[1] < e) parts.push([Math.max(s, cut[1]), e])
          return parts.filter(([u, v]) => v - u > 1e-6)
        })
      }
      const at = (t: number): FloorplanPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      for (const [s, e] of keep) out.push([at(s), at(e)])
    }
  }
  return out
}

function createWriter(dxf: DxfWriter): Writer & { finish: () => void } {
  // Plan (metres, y down) → DXF (millimetres, y up).
  const p3 = (p: FloorplanPoint) => point3d(round(p[0] * MM), round(-p[1] * MM), 0)
  const round = (v: number) => Math.round(v * 100) / 100
  let dimensionCount = 0

  const text: Writer['text'] = (layer, at, height, value, angle, anchor, baseline) => {
    const clean = value.replace(/\s+/g, ' ').trim()
    if (!clean) return
    const horizontal =
      anchor === 'middle'
        ? TextHorizontalAlignment.Center
        : anchor === 'end'
          ? TextHorizontalAlignment.Right
          : TextHorizontalAlignment.Left
    const vertical =
      baseline === 'central' || baseline === 'middle'
        ? TextVerticalAlignment.Middle
        : baseline === 'hanging'
          ? TextVerticalAlignment.Top
          : TextVerticalAlignment.BaseLine
    const aligned =
      horizontal !== TextHorizontalAlignment.Left || vertical !== TextVerticalAlignment.BaseLine
    dxf.addText(p3(at), round(height * MM), clean, {
      layerName: layer,
      // Plan angles turn clockwise on screen; DXF angles counter-clockwise.
      rotation: round((-angle * 180) / Math.PI),
      ...(aligned
        ? {
            horizontalAlignment: horizontal,
            verticalAlignment: vertical,
            secondAlignmentPoint: p3(at),
          }
        : {}),
    })
  }

  const walls: Array<{ points: readonly FloorplanPoint[]; closed: boolean }> = []
  const masks: Array<readonly FloorplanPoint[]> = []

  return {
    mask: (points) => {
      if (points.length < 3 || !isConvex(points)) return
      masks.push(points)
      // Its sides across the wall become the jambs: the shortest edges of the opening.
      const edges = points.map((p, i) => [p, points[(i + 1) % points.length]!] as const)
      const lengths = edges.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]))
      const shortest = Math.min(...lengths)
      edges.forEach(([p, q], i) => {
        if (lengths[i]! <= shortest * 1.01) dxf.addLine(p3(p), p3(q), { layerName: 'MURI' })
      })
    },
    finish: () => {
      for (const [a, b] of cutWalls(walls, masks)) dxf.addLine(p3(a), p3(b), { layerName: 'MURI' })
    },
    line: (layer, a, b) => {
      if (layer === 'MURI') walls.push({ points: [a, b], closed: false })
      else dxf.addLine(p3(a), p3(b), { layerName: layer })
    },
    polyline: (layer, points, closed) => {
      if (points.length < 2) return
      if (layer === 'MURI') {
        walls.push({ points, closed })
        return
      }
      dxf.addLWPolyline(
        points.map((p) => {
          const q = p3(p)
          return { point: { x: q.x, y: q.y } }
        }),
        { layerName: layer, flags: closed ? 1 : 0 },
      )
    },
    circle: (layer, center, radius) =>
      dxf.addCircle(p3(center), round(radius * MM), { layerName: layer }),
    text,
    dimension: (a, b, lineA, lineB, value, overshoot) => {
      const dx = lineB[0] - lineA[0]
      const dy = lineB[1] - lineA[1]
      const length = Math.hypot(dx, dy)
      if (length < 1e-6) return
      const ux = dx / length
      const uy = dy / length
      // The drawn dimension, as an anonymous block like AutoCAD writes it.
      const name = `*D${++dimensionCount}`
      const block = dxf.document.blocks.addBlock(name, dxf.document.objects, false)
      block.flags = BlockFlags.AnonymousBlock
      const add = (p: FloorplanPoint, q: FloorplanPoint) =>
        block.addLine(p3(p), p3(q), { layerName: 'QUOTE' })
      for (const [from, to] of [
        [a, lineA],
        [b, lineB],
      ] as const) {
        const ex = to[0] - from[0]
        const ey = to[1] - from[1]
        const el = Math.hypot(ex, ey)
        if (el > 1e-6) add(from, [to[0] + (ex / el) * overshoot, to[1] + (ey / el) * overshoot])
      }
      add(lineA, lineB)
      // Architectural ticks: short slashes at 45° across each end.
      const tx = ((ux - uy) * TICK) / 2 / Math.SQRT2
      const ty = ((uy + ux) * TICK) / 2 / Math.SQRT2
      for (const p of [lineA, lineB]) add([p[0] - tx, p[1] - ty], [p[0] + tx, p[1] + ty])
      // Text above the line: "above" is screen-up, the normal with negative plan y.
      let nx = uy
      let ny = -ux
      if (ny > 0 || (ny === 0 && nx < 0)) {
        nx = -nx
        ny = -ny
      }
      const mid: FloorplanPoint = [
        (lineA[0] + lineB[0]) / 2 + nx * DIM_TEXT * 0.6,
        (lineA[1] + lineB[1]) / 2 + ny * DIM_TEXT * 0.6,
      ]
      // Keep the text readable: never upside down.
      let angle = Math.atan2(uy, ux)
      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle <= -Math.PI / 2) angle += Math.PI
      block.addText(p3(mid), round(DIM_TEXT * MM), value, {
        layerName: 'QUOTE',
        rotation: round((-angle * 180) / Math.PI),
        horizontalAlignment: TextHorizontalAlignment.Center,
        verticalAlignment: TextVerticalAlignment.Middle,
        secondAlignmentPoint: p3(mid),
      })
      // `definitionPoint` given directly: the writer's own offset maths misplaces the line.
      dxf.addAlignedDim(p3(a), p3(b), {
        layerName: 'QUOTE',
        blockName: name,
        definitionPoint: p3(lineB),
        middlePoint: p3(mid),
        text: value,
        styleName: 'Standard',
      })
    },
  }
}

function emit(geometry: FloorplanGeometry, m: Matrix, layer: string, w: Writer) {
  const at = (p: FloorplanPoint): FloorplanPoint => [
    m[0] * p[0] + m[2] * p[1] + m[4],
    m[1] * p[0] + m[3] * p[1] + m[5],
  ]
  const scale = Math.hypot(m[0], m[1])
  const angle = Math.atan2(m[1], m[0])
  switch (geometry.kind) {
    case 'group':
      for (const child of geometry.children)
        emit(child, compose(m, geometry.transform?.translate, geometry.transform?.rotate), layer, w)
      return
    case 'line':
      w.line(layer, at([geometry.x1, geometry.y1]), at([geometry.x2, geometry.y2]))
      return
    case 'polyline':
      w.polyline(layer, geometry.points.map(at), false)
      return
    case 'polygon':
      if (layer === 'APERTURE' && isWhite(geometry.fill)) w.mask(geometry.points.map(at))
      else w.polyline(layer, geometry.points.map(at), true)
      return
    case 'rect': {
      const { x, y, width, height } = geometry
      w.polyline(
        layer,
        [at([x, y]), at([x + width, y]), at([x + width, y + height]), at([x, y + height])],
        true,
      )
      return
    }
    case 'circle':
      w.circle(layer, at([geometry.cx, geometry.cy]), geometry.r * scale)
      return
    case 'path':
      for (const line of pathToPolylines(geometry.d))
        w.polyline(layer, line.points.map(at), line.closed)
      return
    case 'text':
      w.text(
        layer,
        at([geometry.x, geometry.y]),
        geometry.fontSize * scale,
        geometry.text,
        angle,
        geometry.textAnchor,
        geometry.dominantBaseline,
      )
      return
    case 'dimension-label':
      w.text(
        'QUOTE',
        at([geometry.cx, geometry.cy]),
        DIM_TEXT,
        geometry.text,
        angle,
        'middle',
        'central',
      )
      return
    case 'dimension': {
      const offset = (p: FloorplanPoint): FloorplanPoint => [
        p[0] + geometry.offsetNormal[0] * geometry.offsetDistance,
        p[1] + geometry.offsetNormal[1] * geometry.offsetDistance,
      ]
      w.dimension(
        at(geometry.start),
        at(geometry.end),
        at(geometry.dimensionStart ?? offset(geometry.start)),
        at(geometry.dimensionEnd ?? offset(geometry.end)),
        geometry.text,
        geometry.extensionOvershoot * scale,
      )
      return
    }
    case 'dimension-string':
      for (const segment of geometry.segments) {
        const offset = (p: FloorplanPoint): FloorplanPoint => [
          p[0] + geometry.offsetNormal[0] * geometry.offsetDistance,
          p[1] + geometry.offsetNormal[1] * geometry.offsetDistance,
        ]
        w.dimension(
          at(segment.start),
          at(segment.end),
          at(segment.dimensionStart ?? offset(segment.start)),
          at(segment.dimensionEnd ?? offset(segment.end)),
          segment.text,
          geometry.extensionOvershoot * scale,
        )
      }
      return
    default:
      // Images, hatches, badges and editing handles have no place in a CAD drawing.
      return
  }
}

export function planToDxf(entries: readonly DxfExportEntry[]): string {
  const dxf = new DxfWriter()
  dxf.setUnits(Units.Millimeters)
  for (const [name, color] of Object.entries(LAYERS)) dxf.addLayer(name, color)
  const w = createWriter(dxf)
  for (const entry of entries) {
    const layer = layerForKind(entry.type)
    if (entry.model) emit(entry.model, IDENTITY, layer, w)
    // Texts that annotate (room names, marks) go on TESTI; dimensions put themselves on QUOTE.
    if (entry.annotations)
      emit(entry.annotations, IDENTITY, layer === 'QUOTE' ? 'QUOTE' : 'TESTI', w)
  }
  w.finish()
  return dxf.stringify()
}

type ZoneLike = {
  type: string
  parentId?: string | null
  name?: string
  visible?: boolean
  polygon?: Array<[number, number]>
}

/** "24,00 m²". */
const formatArea = (m2: number) => `${m2.toFixed(2).replace('.', ',')} m²`

/**
 * Room names with their floor area, at the middle of each zone. On documents the editor leaves
 * zone tags to the sheet layout, so the DXF writes its own.
 */
export function zoneLabelEntries(
  nodes: Readonly<Record<string, unknown>>,
  levelId: string,
): DxfExportEntry[] {
  const out: DxfExportEntry[] = []
  for (const raw of Object.values(nodes)) {
    const zone = raw as ZoneLike
    if (zone.type !== 'zone' || zone.parentId !== levelId || zone.visible === false) continue
    const name = zone.name?.trim()
    const ring = zone.polygon ?? []
    if (!name || ring.length < 3) continue
    let area = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i]!
      const [x2, y2] = ring[(i + 1) % ring.length]!
      const cross = x1 * y2 - x2 * y1
      area += cross
      cx += (x1 + x2) * cross
      cy += (y1 + y2) * cross
    }
    if (Math.abs(area) < 1e-9) continue
    cx /= 3 * area
    cy /= 3 * area
    const label = (text: string, y: number, fontSize: number): FloorplanGeometry => ({
      kind: 'text',
      x: cx,
      y,
      text,
      fontSize,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    })
    out.push({
      type: 'zone',
      model: null,
      annotations: {
        kind: 'group',
        children: [label(name, cy, 0.2), label(formatArea(Math.abs(area) / 2), cy + 0.3, 0.12)],
      },
    })
  }
  return out
}
