import { describe, expect, test } from 'bun:test'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import type { LineSegments } from 'three'
import { buildRilievoGeometry, formatLength, RilievoNode, rilievoFloorplan } from './rilievo'

const node = (patch: Partial<RilievoNode> = {}) =>
  RilievoNode.parse({
    unit: 0.001,
    size: [4000, 3000],
    layers: [
      { name: 'MURI', visible: true, segments: [-2000, -1500, 2000, -1500] },
      { name: 'ARREDI', visible: false, segments: [0, 0, 100, 0] },
    ],
    texts: [
      {
        layer: 'MURI',
        x: 0,
        y: 0,
        text: 'Cucina',
        height: 200,
        angle: 0,
        anchor: 'start',
        baseline: 'alphabetic',
      },
    ],
    dimensions: [
      {
        layer: 'MURI',
        a: [-2000, 1500],
        b: [2000, 1500],
        lineA: [-2000, 2000],
        lineB: [2000, 2000],
      },
    ],
    ...patch,
  })

const ctx = {} as GeometryContext
const flatten = (g: FloorplanGeometry): FloorplanGeometry[] =>
  g.kind === 'group' ? [g, ...g.children.flatMap(flatten)] : [g]

describe('rilievo floor plan', () => {
  test('draws visible layers in metres, with texts, dimensions and a frame to grab', () => {
    const parts = flatten(rilievoFloorplan(node(), ctx))
    const paths = parts.filter((p) => p.kind === 'path')
    expect(paths).toHaveLength(1)
    expect(paths[0]!.kind === 'path' && paths[0]!.d).toBe('M-2 -1.5L2 -1.5')
    expect(parts.filter((p) => p.kind === 'text')).toHaveLength(1)
    const dim = parts.find((p) => p.kind === 'dimension')
    expect(dim?.kind === 'dimension' && dim.text).toBe('4,00 m')
    expect(dim?.kind === 'dimension' && dim.offsetDistance).toBeCloseTo(0.5)
    expect(parts.filter((p) => p.kind === 'hit-line')).toHaveLength(4)
  })

  test('follows position, rotation and unit', () => {
    const moved = node({ position: [10, 0, 5], rotation: Math.PI / 2, unit: 0.01 })
    const path = flatten(rilievoFloorplan(moved, ctx)).find((p) => p.kind === 'path')
    // (-2000, -1500) cm-units → (-20, -15) m, turned 90°: x' = x·0 + y·1, y' = -x·1 + y·0.
    expect(path?.kind === 'path' && path.d.startsWith('M-5 25')).toBe(true)
  })

  test('hidden layers hide their texts and dimensions too', () => {
    const parts = flatten(
      rilievoFloorplan(node({ layers: [{ name: 'MURI', visible: false, segments: [] }] }), ctx),
    )
    expect(
      parts.some((p) => p.kind === 'text' || p.kind === 'dimension' || p.kind === 'path'),
    ).toBe(false)
  })
})

test('3D lines cover only the visible layers', () => {
  const group = buildRilievoGeometry(node())
  const lines = group.children[0] as LineSegments
  expect(lines.geometry.getAttribute('position').count).toBe(2)
  expect(buildRilievoGeometry(node({ layers: [] })).children).toHaveLength(0)
})

test('formatLength writes metres the Italian way', () => {
  expect(formatLength(3.456)).toBe('3,46 m')
})
