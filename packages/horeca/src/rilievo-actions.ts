import { type AnyNodeId, ConstructionDimensionNode, WallNode } from '@pascal-app/core'
import { planTransform, type RilievoNode } from './rilievo-schema'
import { findWalls, type Segment } from './rilievo-walls'

/** The lines of the layers that are switched on, in plan metres. */
export function rilievoSegmentsInPlan(node: RilievoNode): Segment[] {
  const at = planTransform(node)
  const out: Segment[] = []
  for (const layer of node.layers) {
    if (!layer.visible) continue
    const s = layer.segments
    for (let i = 0; i + 3 < s.length; i += 4)
      out.push([at(s[i]!, s[i + 1]!), at(s[i + 2]!, s[i + 3]!)])
  }
  return out
}

/** Walls traced from the visible layers, ready to create on the survey's level. */
export function rilievoWallNodes(node: RilievoNode): WallNode[] {
  const levelId = node.parentId as AnyNodeId | null
  return findWalls(rilievoSegmentsInPlan(node)).map((wall) =>
    WallNode.parse({
      start: wall.start,
      end: wall.end,
      thickness: wall.thickness,
      parentId: levelId,
    }),
  )
}

/**
 * The survey's dimensions on visible layers as editor dimensions (`construction-dimension`): same
 * measured points, same dimension line, editable and exported like those drawn by hand.
 */
export function rilievoDimensionNodes(node: RilievoNode): ConstructionDimensionNode[] {
  const at = planTransform(node)
  const shown = new Set(node.layers.filter((l) => l.visible).map((l) => l.name))
  const levelId = node.parentId as AnyNodeId | null
  return node.dimensions
    .filter((d) => shown.has(d.layer))
    .flatMap((d) => {
      const a = at(...d.a)
      const b = at(...d.b)
      const lineA = at(...d.lineA)
      const lineB = at(...d.lineB)
      const dx = lineB[0] - lineA[0]
      const dy = lineB[1] - lineA[1]
      const length = Math.hypot(dx, dy)
      if (length < 1e-6) return []
      return [
        ConstructionDimensionNode.parse({
          parentId: levelId,
          anchors: [
            [a[0], 0, a[1]],
            [b[0], 0, b[1]],
          ],
          baseline: { origin: lineA, direction: [dx / length, dy / length] },
          metricNotation: 'meters',
        }),
      ]
    })
}
