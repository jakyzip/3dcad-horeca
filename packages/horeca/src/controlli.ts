import type { AnyNode, AnyNodeId, FloorplanGeometry, FloorplanPoint } from '@pascal-app/core'
import { z } from 'zod'
import { planTransformOf, type WallFace, wallFacesOf } from './allacciamenti'
import type { EquipmentNode } from './schema'

/**
 * Layout checks for the equipment: units that overlap each other or run into a wall, and
 * aisles in front of a unit that are too narrow. Warnings only, never a block.
 *
 * The minimum widths belong to the project (kept on the site's metadata, like the CRM link),
 * so each drawing can follow the rules of its own job.
 */

export const CONTROLLI_METADATA_KEY = 'controlli'

export const SogliePassaggi = z.object({
  /** Free width in front of a unit facing a wall or the side of something: a way through. */
  passaggio: z.number().min(0.3).max(3).default(0.9),
  /** Free width between two units facing each other: someone works with their back to the other. */
  lavoro: z.number().min(0.3).max(3).default(1.2),
})
export type SogliePassaggi = z.infer<typeof SogliePassaggi>

export const SOGLIE_PREDEFINITE: SogliePassaggi = { passaggio: 0.9, lavoro: 1.2 }

export function readSoglie(metadata: unknown): SogliePassaggi {
  const raw = (metadata as Record<string, unknown> | undefined)?.[CONTROLLI_METADATA_KEY]
  const parsed = SogliePassaggi.safeParse(raw ?? {})
  return parsed.success ? parsed.data : SOGLIE_PREDEFINITE
}

export function withSoglie(metadata: unknown, soglie: SogliePassaggi): Record<string, unknown> {
  return { ...(metadata as Record<string, unknown> | undefined), [CONTROLLI_METADATA_KEY]: soglie }
}

/** Below this the unit stands in the way of people; a wall cabinet at 1,50 m does not. */
const BLOCKS_BELOW = 1.2
/** Overlaps and gaps smaller than this are drawing noise, not problems. */
const TOLERANCE = 0.01
/** Aisles are only looked for this far out. */
const LOOK_AHEAD = 3

type Rect = {
  id: string
  /** Corners in plan, counter-clockwise from back-left: back-left, back-right, front-right, front-left. */
  corners: [FloorplanPoint, FloorplanPoint, FloorplanPoint, FloorplanPoint]
  /** Outward unit normal of the front, in plan. */
  front: FloorplanPoint
  bottom: number
  top: number
}

export function equipmentRect(node: EquipmentNode): Rect {
  const at = planTransformOf(node)
  const hw = node.width / 2
  const hd = node.depth / 2
  const centre = at(0, 0)
  const ahead = at(0, 1)
  const bottom = node.elevation ?? 0
  return {
    id: node.id,
    corners: [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)],
    front: [ahead[0] - centre[0], ahead[1] - centre[1]],
    bottom,
    top: bottom + node.height,
  }
}

const sub = (a: FloorplanPoint, b: FloorplanPoint): FloorplanPoint => [a[0] - b[0], a[1] - b[1]]
const dot = (a: FloorplanPoint, b: FloorplanPoint) => a[0] * b[0] + a[1] * b[1]

/** Penetration depth of two convex polygons (separating axes), 0 when apart or just touching. */
export function overlapDepth(a: readonly FloorplanPoint[], b: readonly FloorplanPoint[]): number {
  let depth = Number.POSITIVE_INFINITY
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!
      const q = poly[(i + 1) % poly.length]!
      const edge = sub(q, p)
      const length = Math.hypot(edge[0], edge[1])
      if (length < 1e-9) continue
      const axis: FloorplanPoint = [-edge[1] / length, edge[0] / length]
      const project = (pts: readonly FloorplanPoint[]) => {
        let min = Number.POSITIVE_INFINITY
        let max = Number.NEGATIVE_INFINITY
        for (const pt of pts) {
          const v = dot(pt, axis)
          min = Math.min(min, v)
          max = Math.max(max, v)
        }
        return [min, max] as const
      }
      const [amin, amax] = project(a)
      const [bmin, bmax] = project(b)
      const overlap = Math.min(amax, bmax) - Math.max(amin, bmin)
      if (overlap <= 0) return 0
      depth = Math.min(depth, overlap)
    }
  }
  return Number.isFinite(depth) ? depth : 0
}

/** A straight wall's plan rectangle. Curved walls are skipped, as for the dimensions. */
function wallRects(walls: readonly AnyNode[]): FloorplanPoint[][] {
  const rects: FloorplanPoint[][] = []
  const faces = wallFacesOf(walls)
  for (let i = 0; i + 1 < faces.length; i += 2) {
    const [f1, f2] = [faces[i]!, faces[i + 1]!]
    rects.push([f1.a, f1.b, f2.b, f2.a])
  }
  return rects
}

/** Distance along `dir` from `origin` to segment `s`, or null when the ray misses it. */
function rayToSegment(
  origin: FloorplanPoint,
  dir: FloorplanPoint,
  a: FloorplanPoint,
  b: FloorplanPoint,
) {
  const e = sub(b, a)
  const denom = dir[0] * e[1] - dir[1] * e[0]
  if (Math.abs(denom) < 1e-12) return null
  const w = sub(a, origin)
  const t = (w[0] * e[1] - w[1] * e[0]) / denom
  const u = (w[0] * dir[1] - w[1] * dir[0]) / denom
  return t > 1e-6 && u >= 0 && u <= 1 ? t : null
}

export type Problema =
  | { tipo: 'sovrapposizione'; id: string; altro: string; profondita: number }
  | { tipo: 'muro'; id: string; profondita: number }
  | {
      tipo: 'passaggio'
      id: string
      /** The unit across, null for a wall. */
      altro: string | null
      larghezza: number
      minimo: number
      lavoro: boolean
      /** The free strip in front of the unit, for the plan. */
      area: FloorplanPoint[]
    }

/**
 * Every problem of one level's equipment. Units that only meet in height (a wall cabinet over a
 * table) don't overlap; wall-hung units don't narrow an aisle.
 */
export function controllaLivello(
  equipment: readonly EquipmentNode[],
  walls: readonly AnyNode[],
  soglie: SogliePassaggi,
): Problema[] {
  const rects = equipment.map(equipmentRect)
  const wallPolys = wallRects(walls)
  const faces: WallFace[] = wallFacesOf(walls)
  const out: Problema[] = []

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!
    for (let j = i + 1; j < rects.length; j++) {
      const s = rects[j]!
      if (Math.min(r.top, s.top) - Math.max(r.bottom, s.bottom) <= TOLERANCE) continue
      const depth = overlapDepth(r.corners, s.corners)
      if (depth > TOLERANCE)
        out.push({ tipo: 'sovrapposizione', id: r.id, altro: s.id, profondita: depth })
    }
    const intoWall = Math.max(0, ...wallPolys.map((w) => overlapDepth(r.corners, w)))
    if (intoWall > TOLERANCE) out.push({ tipo: 'muro', id: r.id, profondita: intoWall })
  }

  // Aisles: from the front edge straight out, to the nearest unit standing in the way or wall.
  for (const r of rects) {
    if (r.bottom >= BLOCKS_BELOW) continue
    const [, , fr, fl] = r.corners
    let best: { distance: number; other: Rect | null } | null = null
    // A few rays across the front, 5 cm in from each end.
    const width = Math.hypot(fr[0] - fl[0], fr[1] - fl[1])
    const steps = 4
    for (let k = 0; k <= steps; k++) {
      const t = width > 0.1 ? (0.05 + (k / steps) * (width - 0.1)) / width : 0.5
      const origin: FloorplanPoint = [fl[0] + (fr[0] - fl[0]) * t, fl[1] + (fr[1] - fl[1]) * t]
      for (const other of rects) {
        if (other.id === r.id || other.bottom >= BLOCKS_BELOW) continue
        const c = other.corners
        for (let e = 0; e < 4; e++) {
          const d = rayToSegment(origin, r.front, c[e]!, c[(e + 1) % 4]!)
          if (d !== null && d <= LOOK_AHEAD && (!best || d < best.distance))
            best = { distance: d, other }
        }
      }
      for (const f of faces) {
        const d = rayToSegment(origin, r.front, f.a, f.b)
        if (d !== null && d <= LOOK_AHEAD && (!best || d < best.distance))
          best = { distance: d, other: null }
      }
    }
    if (!best || best.distance < TOLERANCE) continue
    // Two fronts facing each other make a working aisle.
    const lavoro = best.other !== null && dot(best.other.front, r.front) < -0.7
    const minimo = lavoro ? soglie.lavoro : soglie.passaggio
    if (best.distance + 1e-9 >= minimo) continue
    const reach = (p: FloorplanPoint): FloorplanPoint => [
      p[0] + r.front[0] * best.distance,
      p[1] + r.front[1] * best.distance,
    ]
    out.push({
      tipo: 'passaggio',
      id: r.id,
      altro: best.other?.id ?? null,
      larghezza: best.distance,
      minimo,
      lavoro,
      area: [fl, fr, reach(fr), reach(fl)],
    })
  }
  return out
}

const cm = (metres: number) => `${Math.round(metres * 100)} cm`

/** One line for the HUD / panel, naming the other unit when there is one. */
export function descriviProblema(p: Problema, nameOf: (id: string) => string): string {
  if (p.tipo === 'sovrapposizione')
    return `Si sovrappone a ${nameOf(p.altro)} (${cm(p.profondita)}).`
  if (p.tipo === 'muro') return `Entra nel muro (${cm(p.profondita)}).`
  const davanti = p.altro ? nameOf(p.altro) : 'il muro'
  return `Passaggio di ${cm(p.larghezza)} davanti, verso ${davanti}: ne servono ${cm(p.minimo)}${p.lavoro ? ' (zona di lavoro)' : ''}.`
}

const WARNING = '#dc2626'

/** The unit's own problems drawn in the plan: a red outline, and the narrow strip with its width. */
export function controlliFloorplan(
  node: EquipmentNode,
  problemi: readonly Problema[],
): FloorplanGeometry | null {
  const mine = problemi.filter(
    (p) =>
      p.id === node.id || ('altro' in p && p.altro === node.id && p.tipo === 'sovrapposizione'),
  )
  if (!mine.length) return null
  const children: FloorplanGeometry[] = []
  if (mine.some((p) => p.tipo !== 'passaggio')) {
    children.push({
      kind: 'polygon',
      points: equipmentRect(node).corners,
      fill: 'none',
      stroke: WARNING,
      strokeWidth: 2.5,
      vectorEffect: 'non-scaling-stroke',
    })
  }
  for (const p of mine) {
    if (p.tipo !== 'passaggio' || p.id !== node.id) continue
    children.push({
      kind: 'polygon',
      points: p.area,
      fill: WARNING,
      opacity: 0.12,
      stroke: WARNING,
      strokeWidth: 1,
      strokeDasharray: '4 3',
      vectorEffect: 'non-scaling-stroke',
    })
    const [a, b, c, d] = p.area as [FloorplanPoint, FloorplanPoint, FloorplanPoint, FloorplanPoint]
    children.push({
      kind: 'text',
      x: (a[0] + b[0] + c[0] + d[0]) / 4,
      y: (a[1] + b[1] + c[1] + d[1]) / 4,
      text: `${cm(p.larghezza)} < ${cm(p.minimo)}`,
      fontSize: 0.08,
      fill: WARNING,
      textAnchor: 'middle',
      dominantBaseline: 'central',
      upright: true,
    })
  }
  return { kind: 'group', children }
}

/**
 * Where the project's thresholds live: the site above the node, else its building, else the
 * top of the tree. Same host as the CRM link (`crmLinkHostId`).
 */
export function hostOf(
  node: { parentId?: string | null },
  resolve: (id: AnyNodeId) => AnyNode | undefined,
): AnyNode | undefined {
  let building: AnyNode | undefined
  let last: AnyNode | undefined
  let current: AnyNode | undefined = node.parentId ? resolve(node.parentId as AnyNodeId) : undefined
  for (let i = 0; current && i < 10; i++) {
    if (current.type === 'site') return current
    if (current.type === 'building') building = current
    last = current
    current = current.parentId ? resolve(current.parentId as AnyNodeId) : undefined
  }
  return building ?? last
}
