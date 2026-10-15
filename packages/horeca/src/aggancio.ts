import type { AnyNode, AnyNodeId, FloorplanPoint } from '@pascal-app/core'
import { overlapDepth, wallRects } from './controlli'
import { RILIEVO } from './rilievo-schema'

/**
 * Where a unit settles while it is placed or dragged: flush against the nearest wall with its back
 * to it (the front faces the room, as equipment stands), into the corner when a second wall is near,
 * and flush beside the units next to it. A unit never ends up inside a wall.
 */

/** Pull towards a wall, metres between the unit and the wall face. */
export const WALL_SNAP = 0.2
/** Pull towards a neighbouring unit. */
export const NEIGHBOUR_SNAP = 0.15
/** Two directions count as the same below this (radians, and for unit-vector dot products). */
const PARALLEL = 0.01

type Vec = FloorplanPoint

export type Posa = {
  /** Plan centre (x, z), level-local metres. */
  centre: Vec
  rotation: number
}

export type Sagoma = {
  width: number
  depth: number
  height: number
  elevation: number
}

export type Vicino = Posa & Sagoma

type Faccia = { a: Vec; u: Vec; length: number; n: Vec; thickness: number; wall: number }

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1]
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]]
const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k]

/** Local x (width) and z (front) axes in plan, as `planTransformOf` maps them. */
const axes = (rotation: number): [Vec, Vec] => [
  [Math.cos(rotation), -Math.sin(rotation)],
  [Math.sin(rotation), Math.cos(rotation)],
]

/** Half of the footprint's extent along the unit vector `v`. */
function halfAlong(rotation: number, width: number, depth: number, v: Vec): number {
  const [ex, ez] = axes(rotation)
  return (width / 2) * Math.abs(dot(ex, v)) + (depth / 2) * Math.abs(dot(ez, v))
}

/** Signed angle from `a` to `b`, in (-π, π]. */
function angleBetween(a: number, b: number): number {
  const d = (b - a) % (2 * Math.PI)
  return d > Math.PI ? d - 2 * Math.PI : d <= -Math.PI ? d + 2 * Math.PI : d
}

/** Both faces of every straight wall, each with its outward normal (away from the wall body). */
export function facceMuri(walls: readonly AnyNode[]): Faccia[] {
  const faces: Faccia[] = []
  walls.forEach((node, index) => {
    if (node.type !== 'wall') return
    const w = node as unknown as {
      start: [number, number]
      end: [number, number]
      thickness?: number
      curveOffset?: number
    }
    if (w.curveOffset && Math.abs(w.curveOffset) > 1e-6) return
    const d = sub(w.end, w.start)
    const length = Math.hypot(d[0], d[1])
    if (length < 1e-6) return
    const thickness = w.thickness ?? 0.1
    const u: Vec = [d[0] / length, d[1] / length]
    for (const s of [1, -1]) {
      const n: Vec = [-u[1] * s, u[0] * s]
      faces.push({ a: add(w.start, n, thickness / 2), u, length, n, thickness, wall: index })
    }
  })
  return faces
}

/** The rotation that turns the unit's back to the wall: its front (local +z) along the normal. */
const backToWall = (n: Vec) => Math.atan2(n[0], n[1])

type Contatto = { face: Faccia; gap: number }

/** How far the unit (at `rotation`) sits from `face`, when it faces it along the wall's length. */
function contatto(face: Faccia, centre: Vec, rotation: number, sagoma: Sagoma): Contatto | null {
  const half = halfAlong(rotation, sagoma.width, sagoma.depth, face.n)
  const along = halfAlong(rotation, sagoma.width, sagoma.depth, face.u)
  const rel = sub(centre, face.a)
  const t = dot(rel, face.u)
  if (t < -along + 0.05 || t > face.length + along - 0.05) return null
  const gap = dot(rel, face.n) - half
  // Up to the far side of the wall counts as "in the wall": a unit dropped across it is pushed
  // back out on this side; past that it belongs to the room beyond.
  if (gap > WALL_SNAP || gap < -(2 * half + face.thickness)) return null
  return { face, gap }
}

function parallelTo(rotation: number, n: Vec): boolean {
  const [ex, ez] = axes(rotation)
  return (
    Math.abs(Math.abs(dot(ex, n)) - 1) < PARALLEL || Math.abs(Math.abs(dot(ez, n)) - 1) < PARALLEL
  )
}

/**
 * The pose the unit settles in, or null when nothing is near (the cursor then moves it freely).
 * `others` are the level's other units; only those overlapping it in height count.
 */
export function aggancia(
  posa: Posa,
  sagoma: Sagoma,
  walls: readonly AnyNode[],
  others: readonly Vicino[],
): Posa | null {
  let centre = posa.centre
  let rotation = posa.rotation
  const locked: Vec[] = []
  const faces = facceMuri(walls)

  // 1. The nearest wall: turn the back to it and sit flush.
  let best: (Contatto & { rotation: number }) | null = null
  for (const face of faces) {
    // The same heading as the wall's, taken the short way round from the current one.
    const turned = posa.rotation + angleBetween(posa.rotation, backToWall(face.n))
    const hit = contatto(face, centre, turned, sagoma)
    if (hit && (!best || Math.abs(hit.gap) < Math.abs(best.gap)))
      best = { ...hit, rotation: turned }
  }
  if (best) {
    rotation = best.rotation
    centre = add(centre, best.face.n, -best.gap)
    locked.push(best.face.n)

    // 2. A second wall across the first: slide into the corner.
    let corner: Contatto | null = null
    for (const face of faces) {
      if (face.wall === best.face.wall || Math.abs(dot(face.n, best.face.n)) > PARALLEL) continue
      if (!parallelTo(rotation, face.n)) continue
      const hit = contatto(face, centre, rotation, sagoma)
      if (hit && (!corner || Math.abs(hit.gap) < Math.abs(corner.gap))) corner = hit
    }
    if (corner) {
      centre = add(centre, corner.face.n, -corner.gap)
      locked.push(corner.face.n)
    }
  }

  // 3. Units alongside: close the gap (or the overlap) along a free axis, then line up the edges.
  const isLocked = (v: Vec) => locked.some((n) => Math.abs(Math.abs(dot(n, v)) - 1) < PARALLEL)
  const top = sagoma.elevation + sagoma.height
  const near = others.filter(
    (o) =>
      o.elevation < top - PARALLEL &&
      sagoma.elevation < o.elevation + o.height - PARALLEL &&
      Math.abs(Math.sin(2 * angleBetween(rotation, o.rotation))) < PARALLEL,
  )
  let shift: { v: Vec; by: number; other: Vicino } | null = null
  for (const o of near) {
    for (const [v, w] of [axes(rotation), axes(rotation).reverse()] as [Vec, Vec][]) {
      if (isLocked(v)) continue
      const rel = sub(o.centre, centre)
      const reach =
        halfAlong(rotation, sagoma.width, sagoma.depth, v) +
        halfAlong(o.rotation, o.width, o.depth, v)
      const span =
        halfAlong(rotation, sagoma.width, sagoma.depth, w) +
        halfAlong(o.rotation, o.width, o.depth, w)
      if (Math.abs(dot(rel, w)) >= span - PARALLEL) continue
      const s = dot(rel, v)
      const gap = Math.abs(s) - reach
      if (gap > NEIGHBOUR_SNAP || gap < -reach) continue
      const by = Math.sign(s || 1) * gap
      if (!shift || Math.abs(by) < Math.abs(shift.by)) shift = { v, by, other: o }
    }
  }
  if (shift) {
    centre = add(centre, shift.v, shift.by)
    locked.push(shift.v)
    const w = axes(rotation).find((a) => Math.abs(dot(a, shift.v)) < PARALLEL)!
    if (!isLocked(w)) {
      const o = shift.other
      const mine = halfAlong(rotation, sagoma.width, sagoma.depth, w)
      const theirs = halfAlong(o.rotation, o.width, o.depth, w)
      const offset = dot(sub(o.centre, centre), w)
      const align = [offset - theirs + mine, offset + theirs - mine]
        .filter((d) => Math.abs(d) <= NEIGHBOUR_SNAP)
        .sort((a, b) => Math.abs(a) - Math.abs(b))[0]
      if (align !== undefined) centre = add(centre, w, align)
    }
  }

  const moved =
    Math.abs(centre[0] - posa.centre[0]) > 1e-9 ||
    Math.abs(centre[1] - posa.centre[1]) > 1e-9 ||
    Math.abs(rotation - posa.rotation) > 1e-9
  return moved ? { centre, rotation } : null
}

/** Whether the unit at this pose runs into a wall (more than a centimetre). */
export function dentroUnMuro(posa: Posa, sagoma: Sagoma, walls: readonly AnyNode[]): boolean {
  const [ex, ez] = axes(posa.rotation)
  const hw = sagoma.width / 2
  const hd = sagoma.depth / 2
  const at = (lx: number, lz: number) => add(add(posa.centre, ex, lx), ez, lz)
  const footprint = [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)]
  return wallRects(walls).some((rect) => overlapDepth(footprint, rect) > 0.01)
}

type UnitLike = {
  id: string
  type: string
  position: [number, number, number]
  rotation: number
  width: number
  depth: number
  height: number
  elevation?: number
  parentId?: string | null
}

const isUnit = (node: AnyNode | undefined): node is AnyNode & UnitLike =>
  !!node &&
  (node.type as string).startsWith('horeca:') &&
  (node.type as string) !== RILIEVO &&
  typeof (node as unknown as UnitLike).width === 'number'

/** The level's walls and its other units, from the scene. */
export function intorno(
  nodes: Readonly<Record<string, AnyNode>>,
  levelId: string | null,
  exclude: readonly string[],
): { walls: AnyNode[]; others: Vicino[] } {
  const level = levelId ? nodes[levelId] : undefined
  const ids = (level as unknown as { children?: AnyNodeId[] } | undefined)?.children ?? []
  const walls: AnyNode[] = []
  const others: Vicino[] = []
  for (const id of ids) {
    const child = nodes[id]
    if (child?.type === 'wall') walls.push(child)
    else if (isUnit(child) && !exclude.includes(child.id)) others.push(vicinoDa(child))
  }
  return { walls, others }
}

export const sagomaDi = (
  unit: Pick<UnitLike, 'width' | 'depth' | 'height' | 'elevation'>,
): Sagoma => ({
  width: unit.width,
  depth: unit.depth,
  height: unit.height,
  elevation: unit.elevation ?? 0,
})

export function vicinoDa(unit: UnitLike): Vicino {
  return {
    centre: [unit.position[0], unit.position[2]],
    rotation: unit.rotation,
    width: unit.width,
    depth: unit.depth,
    height: unit.height,
    elevation: unit.elevation ?? 0,
  }
}
