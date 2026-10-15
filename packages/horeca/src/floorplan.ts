import type { FloorplanGeometry, FloorplanPoint, GeometryContext } from '@pascal-app/core'
import type { EquipmentNode } from './schema'

const FILL = '#d9dce1'
const STROKE = '#4b5563'

/** Plan footprint: the rotated body rectangle plus a per-kind mark (`marks` in local metres). */
export function equipmentFloorplan(
  node: EquipmentNode,
  ctx: GeometryContext,
  marks: (hw: number, hd: number) => Array<[number, number, number, number]>,
): FloorplanGeometry {
  const [cx, , cz] = node.position
  const cos = Math.cos(node.rotation)
  const sin = Math.sin(node.rotation)
  const hw = node.width / 2
  const hd = node.depth / 2
  // Local (x, z) → plan, applying yaw: plan x = world x, plan y = world z.
  const at = (lx: number, lz: number): FloorplanPoint => [
    cx + lx * cos + lz * sin,
    cz - lx * sin + lz * cos,
  ]

  const view = ctx.viewState
  const selected = (view?.selected || view?.highlighted) ?? false
  const stroke = selected && view?.palette ? view.palette.selectedStroke : STROKE

  const children: FloorplanGeometry[] = [
    {
      kind: 'polygon',
      points: [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)],
      fill: FILL,
      stroke,
      strokeWidth: selected ? 0.03 : 0.02,
      opacity: 0.92,
    },
  ]
  for (const [x1, z1, x2, z2] of marks(hw, hd)) {
    const a = at(x1, z1)
    const b = at(x2, z2)
    children.push({
      kind: 'line',
      x1: a[0],
      y1: a[1],
      x2: b[0],
      y2: b[1],
      stroke,
      strokeWidth: 1,
      vectorEffect: 'non-scaling-stroke',
      opacity: 0.7,
    })
  }
  if (selected) children.push({ kind: 'move-handle', point: [cx, cz] })
  return { kind: 'group', children }
}

/** Counter: a line along the front (the door side). */
export const bancoMarks = (hw: number, hd: number): Array<[number, number, number, number]> => [
  [-hw, hd - 0.08, hw, hd - 0.08],
]

/** Cold room: an X, the usual plan mark for a room-in-a-room. */
export const cellaMarks = (hw: number, hd: number): Array<[number, number, number, number]> => [
  [-hw, -hd, hw, hd],
  [-hw, hd, hw, -hd],
]

/** Sink: the basin outline. */
export const lavelloMarks = (hw: number, hd: number): Array<[number, number, number, number]> => {
  const bw = Math.min(0.25, hw * 0.6)
  const bd = Math.min(0.2, hd * 0.6)
  return [
    [-bw, -bd, bw, -bd],
    [bw, -bd, bw, bd],
    [bw, bd, -bw, bd],
    [-bw, bd, -bw, -bd],
  ]
}
