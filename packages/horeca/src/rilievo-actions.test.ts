import { expect, test } from 'bun:test'
import { rilievoDimensionNodes, rilievoWallNodes } from './rilievo-actions'
import { RilievoNode } from './rilievo-schema'

/** A 2 m wall, 20 cm thick, drawn in millimetres, plus one dimension on its own layer. */
const survey = (patch: Partial<RilievoNode> = {}) =>
  RilievoNode.parse({
    parentId: 'level_a',
    unit: 0.001,
    layers: [
      { name: 'MURI', visible: true, segments: [0, 0, 2000, 0, 0, 200, 2000, 200] },
      { name: 'QUOTE', visible: true, segments: [] },
    ],
    dimensions: [
      { layer: 'QUOTE', a: [0, 0], b: [2000, 0], lineA: [0, -500], lineB: [2000, -500] },
    ],
    ...patch,
  })

test('walls come out in level metres, following the survey’s place', () => {
  const [wall] = rilievoWallNodes(survey({ position: [10, 0, 5] }))
  expect(wall!.thickness).toBeCloseTo(0.2)
  expect(wall!.start).toEqual([10, 5.1])
  expect(wall!.end).toEqual([12, 5.1])
  expect(wall!.parentId).toBe('level_a')
})

test('dimensions keep measured points and dimension line; hidden layers are skipped', () => {
  const [dim] = rilievoDimensionNodes(survey())
  expect(dim!.anchors).toEqual([
    [0, 0, 0],
    [2, 0, 0],
  ])
  expect(dim!.baseline.origin).toEqual([0, -0.5])
  expect(dim!.baseline.direction).toEqual([1, 0])
  const hidden = survey()
  hidden.layers = hidden.layers.map((l) => ({ ...l, visible: l.name !== 'QUOTE' }))
  expect(rilievoDimensionNodes(hidden)).toHaveLength(0)
})
