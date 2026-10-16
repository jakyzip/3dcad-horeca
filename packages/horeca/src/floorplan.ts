import type { FloorplanGeometry, FloorplanPoint, GeometryContext } from '@pascal-app/core'
import type { EquipmentNode } from './schema'
import { pianoLavello } from './smontabili'

const FILL = '#d9dce1'
const STROKE = '#4b5563'

/** Plan footprint: the rotated body rectangle plus a per-kind mark (`marks` in local metres). */
export function equipmentFloorplan(
  node: EquipmentNode,
  ctx: GeometryContext,
  marks: (hw: number, hd: number, node: EquipmentNode) => Array<[number, number, number, number]>,
  options: { label?: string; dashed?: boolean } = {},
): FloorplanGeometry {
  const { label, dashed } = options
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
      // Overhead units (wall cabinets) read dashed and unfilled, as on a drawn plan.
      fill: dashed ? 'none' : FILL,
      stroke,
      strokeWidth: selected ? 0.03 : 0.02,
      ...(dashed ? { strokeDasharray: '0.08 0.05' } : {}),
      opacity: 0.92,
    },
  ]
  for (const [x1, z1, x2, z2] of marks(hw, hd, node)) {
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
      ...(dashed ? { strokeDasharray: '4 3' } : {}),
      opacity: 0.7,
    })
  }
  if (label) {
    // Fits the shorter side and the code's length across the width, within readable plan sizes
    // (a character is about 0.6 of the font size wide).
    const fontSize = Math.max(
      0.05,
      Math.min(
        0.12,
        Math.min(node.width, node.depth) / 4,
        (node.width * 0.9) / (label.length * 0.6),
      ),
    )
    // A wall unit hangs over a floor unit, whose code takes the middle: its own goes against the
    // wall, smaller, so the two do not print over each other.
    const [lx, ly] = dashed ? at(0, -hd + Math.min(0.06, fontSize * 0.7)) : [cx, cz]
    children.push({
      kind: 'text',
      x: lx,
      y: ly,
      text: label,
      fontSize: dashed ? Math.min(fontSize, 0.07) : fontSize,
      fill: '#1f2937',
      textAnchor: 'middle',
      dominantBaseline: 'central',
      upright: true,
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
/** The bowls as rectangles, and the drainer's ribs as a few lines, where the 3D puts them. */
export const lavelloMarks = (
  hw: number,
  hd: number,
  node: EquipmentNode,
): Array<[number, number, number, number]> => {
  const { bowls, drainer } = pianoLavello(hw * 2, hd * 2, node.vasche ?? '1 vasca', {
    w: node.vascaLarghezza ?? 0.5,
    d: node.vascaProfondita ?? 0.4,
  })
  const out: Array<[number, number, number, number]> = []
  for (const { x, z, w, d } of bowls) {
    const [l, r, f, b] = [x - w / 2, x + w / 2, z - d / 2, z + d / 2]
    out.push([l, f, r, f], [r, f, r, b], [r, b, l, b], [l, b, l, f])
  }
  if (drainer) {
    const lines = Math.max(2, Math.round(drainer.w / 0.08))
    for (let i = 0; i < lines; i++) {
      const x = drainer.x - drainer.w / 2 + (drainer.w * (i + 0.5)) / lines
      out.push([x, drainer.z - drainer.d / 2, x, drainer.z + drainer.d / 2])
    }
  }
  return out
}

/** Generic block: no mark, the article code is written inside instead. */
export const genericoMarks = (): Array<[number, number, number, number]> => []

/** A single diagonal: the usual mark for a machine. */
export const diagonaleMarks = (hw: number, hd: number): Array<[number, number, number, number]> => [
  [-hw, -hd, hw, hd],
]
