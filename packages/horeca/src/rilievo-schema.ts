import { BaseNode, type FloorplanPoint, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

/**
 * The survey drawing node's data (see `rilievo.tsx` for how it is drawn and edited). Kept apart so
 * the tools that use it (walls, dimensions) do not import the definition that offers them.
 */

export const RILIEVO = 'horeca:rilievo'

const Point = z.tuple([z.number(), z.number()])

export const RilievoNode = BaseNode.extend({
  id: objectId('rilievo'),
  type: nodeType(RILIEVO),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.number().default(0),
  /** Metres per drawing unit. */
  unit: z.number().positive().default(0.001),
  opacity: z.number().min(0.1).max(1).default(0.8),
  /** File name the drawing came from. */
  source: z.string().default(''),
  /** Drawing extent in drawing units. */
  size: Point.default([0, 0]),
  layers: z
    .array(z.object({ name: z.string(), visible: z.boolean(), segments: z.array(z.number()) }))
    .default([]),
  texts: z
    .array(
      z.object({
        layer: z.string(),
        x: z.number(),
        y: z.number(),
        text: z.string(),
        height: z.number(),
        angle: z.number(),
        anchor: z.enum(['start', 'middle', 'end']),
        baseline: z.enum(['alphabetic', 'central', 'hanging']),
      }),
    )
    .default([]),
  dimensions: z
    .array(z.object({ layer: z.string(), a: Point, b: Point, lineA: Point, lineB: Point }))
    .default([]),
})
export type RilievoNode = z.infer<typeof RilievoNode>

/** "4,00 m": a measured length the way it is written on Italian drawings. */
export const formatLength = (metres: number) => `${metres.toFixed(2).replace('.', ',')} m`

/** Drawing coordinates → plan metres, with the node's place and yaw (same convention as equipment). */
export function planTransform(node: RilievoNode) {
  const [px, , pz] = node.position
  const cos = Math.cos(node.rotation)
  const sin = Math.sin(node.rotation)
  const u = node.unit
  return (x: number, y: number): FloorplanPoint => [
    px + (x * cos + y * sin) * u,
    pz + (-x * sin + y * cos) * u,
  ]
}
