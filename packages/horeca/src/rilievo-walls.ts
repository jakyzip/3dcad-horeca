import type { FloorplanPoint } from '@pascal-app/core'

/**
 * Walls found in a survey drawing: two parallel lines a wall's thickness apart are its two faces.
 * The wall runs on the middle line over the stretch where the faces overlap; ends are then carried
 * to the axis of the wall they butt against, so corners and T-junctions join. Everything is in plan
 * metres. Openings stay as gaps, since the faces are interrupted there.
 *
 * Each face pairs with its nearest parallel line, which keeps a narrow corridor between two thin
 * walls as two walls. The price: other lines drawn inside a wall (window glass, sills) must be on
 * layers switched off, or they are taken for its faces.
 */

export type Segment = readonly [FloorplanPoint, FloorplanPoint]
export type FoundWall = { start: FloorplanPoint; end: FloorplanPoint; thickness: number }

export type WallSearch = {
  /** Thinnest and thickest wall to look for, metres. */
  minThickness?: number
  maxThickness?: number
}

const ANGLE_TOLERANCE = (1 * Math.PI) / 180
const MIN_LENGTH = 0.05
const MIN_OVERLAP = 0.15

type Line = {
  /** Unit direction, angle in [0, π). */
  u: FloorplanPoint
  /** Normal offset of the infinite line: n · p with n = (-u.y, u.x). */
  rho: number
  /** Projection interval along u. */
  t0: number
  t1: number
}

const dot = (a: FloorplanPoint, b: FloorplanPoint) => a[0] * b[0] + a[1] * b[1]

function toLine([a, b]: Segment): Line | null {
  let dx = b[0] - a[0]
  let dy = b[1] - a[1]
  const length = Math.hypot(dx, dy)
  if (length < MIN_LENGTH) return null
  dx /= length
  dy /= length
  // One orientation per direction, so parallel lines compare directly.
  if (dy < -1e-12 || (Math.abs(dy) <= 1e-12 && dx < 0)) {
    dx = -dx
    dy = -dy
  }
  const u: FloorplanPoint = [dx, dy]
  const ta = dot(a, u)
  const tb = dot(b, u)
  return { u, rho: -dy * a[0] + dx * a[1], t0: Math.min(ta, tb), t1: Math.max(ta, tb) }
}

const angleOf = (u: FloorplanPoint) => Math.atan2(u[1], u[0])
const parallel = (a: Line, b: Line) => {
  const d = Math.abs(angleOf(a.u) - angleOf(b.u))
  return Math.min(d, Math.PI - d) < ANGLE_TOLERANCE
}
const pointAt = (u: FloorplanPoint, rho: number, t: number): FloorplanPoint => [
  u[0] * t - u[1] * rho,
  u[1] * t + u[0] * rho,
]

/** Collinear pieces (a polyline broken at every vertex, a line drawn twice) become one line. */
function mergeCollinear(lines: Line[]): Line[] {
  const out: Line[] = []
  const sorted = [...lines].sort(
    (a, b) => angleOf(a.u) - angleOf(b.u) || a.rho - b.rho || a.t0 - b.t0,
  )
  for (const line of sorted) {
    const host = out.find(
      (o) =>
        parallel(o, line) &&
        Math.abs(o.rho - line.rho) < 0.002 &&
        line.t0 <= o.t1 + 0.002 &&
        line.t1 >= o.t0 - 0.002,
    )
    if (host) {
      host.t0 = Math.min(host.t0, line.t0)
      host.t1 = Math.max(host.t1, line.t1)
    } else out.push({ ...line })
  }
  return out
}

export function findWalls(segments: readonly Segment[], search: WallSearch = {}): FoundWall[] {
  const minT = search.minThickness ?? 0.05
  const maxT = search.maxThickness ?? 0.6
  const lines = mergeCollinear(segments.map(toLine).filter((l): l is Line => l !== null))

  // Each face pairs with its nearest parallel face(s) overlapping it.
  const pairs = new Map<string, [number, number]>()
  lines.forEach((a, i) => {
    let best = Number.POSITIVE_INFINITY
    const partners: Array<[number, number]> = []
    lines.forEach((b, j) => {
      if (i === j || !parallel(a, b)) return
      const d = Math.abs(a.rho - b.rho)
      if (d < minT || d > maxT) return
      const overlap = Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0)
      if (overlap < MIN_OVERLAP) return
      partners.push([j, d])
      best = Math.min(best, d)
    })
    for (const [j, d] of partners)
      if (d <= best + 0.002) pairs.set(i < j ? `${i}:${j}` : `${j}:${i}`, i < j ? [i, j] : [j, i])
  })

  let walls: FoundWall[] = [...pairs.values()].map(([i, j]) => {
    const a = lines[i]!
    const b = lines[j]!
    const rho = (a.rho + b.rho) / 2
    const t0 = Math.max(a.t0, b.t0)
    const t1 = Math.min(a.t1, b.t1)
    return {
      start: pointAt(a.u, rho, t0),
      end: pointAt(a.u, rho, t1),
      thickness: Math.round(Math.abs(a.rho - b.rho) * 1000) / 1000,
    }
  })
  walls = dropNested(walls)
  walls = joinEnds(walls)
  return mergeRuns(walls)
}

/** A thinner pair drawn inside a thicker wall (a window's glass lines, a sill) is not a wall. */
function dropNested(walls: FoundWall[]): FoundWall[] {
  const inside = (p: FloorplanPoint, w: FoundWall) => {
    const dx = w.end[0] - w.start[0]
    const dy = w.end[1] - w.start[1]
    const len = Math.hypot(dx, dy)
    const along = ((p[0] - w.start[0]) * dx + (p[1] - w.start[1]) * dy) / len
    const across = Math.abs((p[0] - w.start[0]) * dy - (p[1] - w.start[1]) * dx) / len
    return along >= -0.001 && along <= len + 0.001 && across <= w.thickness / 2 + 0.001
  }
  return walls.filter(
    (w) =>
      !walls.some(
        (o) => o !== w && o.thickness > w.thickness && inside(w.start, o) && inside(w.end, o),
      ),
  )
}

/** Carry each free end to the axis of a crossing wall it stops short of (corner, T-junction). */
function joinEnds(walls: FoundWall[]): FoundWall[] {
  return walls.map((wall, i) => {
    const moved = { ...wall }
    for (const which of ['start', 'end'] as const) {
      const from = wall[which]
      const other = which === 'start' ? wall.end : wall.start
      const len = Math.hypot(from[0] - other[0], from[1] - other[1])
      const u: FloorplanPoint = [(from[0] - other[0]) / len, (from[1] - other[1]) / len]
      let bestT = Number.POSITIVE_INFINITY
      walls.forEach((v, j) => {
        if (i === j) return
        const vx = v.end[0] - v.start[0]
        const vy = v.end[1] - v.start[1]
        const vl = Math.hypot(vx, vy)
        const cross = u[0] * vy - u[1] * vx
        if (Math.abs(cross) / vl < Math.sin((10 * Math.PI) / 180)) return
        // from + u·t = v.start + (vx, vy)·s
        const wx = v.start[0] - from[0]
        const wy = v.start[1] - from[1]
        const t = (wx * vy - wy * vx) / cross
        const s = (wx * u[1] - wy * u[0]) / cross
        const reach = v.thickness / 2 + wall.thickness / 2 + 0.02
        const slack = (wall.thickness / 2 + 0.02) / vl
        if (t >= -0.001 && t <= reach && s >= -slack && s <= 1 + slack) bestT = Math.min(bestT, t)
      })
      if (Number.isFinite(bestT)) moved[which] = [from[0] + u[0] * bestT, from[1] + u[1] * bestT]
    }
    return moved
  })
}

/** Pieces of one wall split by a crossing face become one wall again; real gaps stay. */
function mergeRuns(walls: FoundWall[]): FoundWall[] {
  const out: FoundWall[] = []
  for (const wall of walls) {
    const line = toLine([wall.start, wall.end])
    if (!line) continue
    const host = out.find((o) => {
      const ol = toLine([o.start, o.end])
      return (
        ol &&
        Math.abs(o.thickness - wall.thickness) < 0.005 &&
        parallel(ol, line) &&
        Math.abs(ol.rho - line.rho) < 0.005 &&
        line.t0 <= ol.t1 + 0.005 &&
        line.t1 >= ol.t0 - 0.005
      )
    })
    if (!host) {
      out.push({ ...wall })
      continue
    }
    const hl = toLine([host.start, host.end])!
    const t0 = Math.min(hl.t0, line.t0)
    const t1 = Math.max(hl.t1, line.t1)
    host.start = pointAt(hl.u, hl.rho, t0)
    host.end = pointAt(hl.u, hl.rho, t1)
  }
  return out
}
