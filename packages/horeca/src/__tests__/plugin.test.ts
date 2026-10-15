import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, loadPlugin, nodeRegistry, useScene } from '@pascal-app/core'
import { collectFloorplanSchedules } from '@pascal-app/editor'
import { Box3, Mesh, Vector3 } from 'three'
import {
  BANCO_FRIGO,
  BancoFrigoNode,
  buildDistinta,
  CELLA_FRIGO,
  CellaFrigoNode,
  type DistintaNode,
  horecaPlugin,
  LAVELLO,
  LavelloNode,
} from '../index'

const TAV = { item_id: 'b0000000-0000-4000-8000-000000000002', code: 'BF-150', name: 'Banco frigo' }
const CEL = { item_id: 'a0000000-0000-4000-8000-000000000001', code: 'CEL-20', name: 'Cella 2×2' }

let restore: () => void
beforeEach(async () => {
  restore = nodeRegistry._snapshot()
  nodeRegistry._reset()
  await loadPlugin(horecaPlugin)
})
afterEach(() => restore())

function scene() {
  const levelId = 'level_horeca' as AnyNodeId
  const placed = [
    BancoFrigoNode.parse({
      ...nodeRegistry.get(BANCO_FRIGO)!.defaults(),
      metadata: { product: TAV },
    }),
    BancoFrigoNode.parse({
      ...nodeRegistry.get(BANCO_FRIGO)!.defaults(),
      metadata: { product: TAV },
    }),
    BancoFrigoNode.parse({ ...nodeRegistry.get(BANCO_FRIGO)!.defaults() }),
    CellaFrigoNode.parse({
      ...nodeRegistry.get(CELLA_FRIGO)!.defaults(),
      metadata: { product: CEL },
    }),
    LavelloNode.parse({ ...nodeRegistry.get(LAVELLO)!.defaults(), visible: false }),
  ].map((node) => ({ ...node, parentId: levelId }))
  const nodes = {
    [levelId]: { id: levelId, type: 'level', visible: true, children: placed.map((n) => n.id) },
    ...Object.fromEntries(placed.map((node) => [node.id, node])),
  } as unknown as Record<string, AnyNode>
  return { levelId, nodes }
}

describe('horeca plugin', () => {
  test('registers the three equipment kinds', () => {
    for (const kind of [BANCO_FRIGO, CELLA_FRIGO, LAVELLO]) {
      expect(nodeRegistry.get(kind)?.kind).toBe(kind)
    }
  })

  test('defaults parse, and the body geometry has the node size', () => {
    for (const [kind, schema] of [
      [BANCO_FRIGO, BancoFrigoNode],
      [CELLA_FRIGO, CellaFrigoNode],
      [LAVELLO, LavelloNode],
    ] as const) {
      const def = nodeRegistry.get(kind)!
      const node = schema.parse(def.defaults())
      const object = def.geometry!(node as never, {} as never)
      const bodies: Mesh[] = []
      object.traverse((child) => {
        if (child instanceof Mesh && child.name.endsWith('-body')) bodies.push(child)
      })
      expect(bodies).toHaveLength(1)
      const size = new Box3().setFromObject(bodies[0]!).getSize(new Vector3())
      expect(size.x).toBeCloseTo(node.width, 3)
      const plan = def.floorplan!(node as never, {} as never)
      expect(plan?.kind).toBe('group')
    }
  })

  test('the plan sheet lists each kind with exact quantities', () => {
    const { levelId, nodes } = scene()
    const schedules = collectFloorplanSchedules(nodes, levelId, 'metric', 'full')
    const cells = (title: string) =>
      schedules.find((s) => s.title === title)?.rows.map((row) => row.cells)
    expect(schedules.map((s) => s.title).sort()).toEqual(['Banchi frigo', 'Celle frigo'])
    expect(cells('Banchi frigo')).toEqual([
      { code: 'BF-150', name: 'Banco frigo', quantity: '2' },
      { code: '—', name: 'Senza articolo', quantity: '1' },
    ])
    expect(cells('Celle frigo')).toEqual([{ code: 'CEL-20', name: 'Cella 2×2', quantity: '1' }])
  })

  test('the scene distinta counts every visible article once per node', () => {
    const { nodes } = scene()
    expect(buildDistinta(nodes as unknown as Record<string, DistintaNode>).rows).toEqual([
      { ...TAV, quantity: 2 },
      { ...CEL, quantity: 1 },
    ])
  })

  test('placed equipment survives a store round trip with its article', () => {
    const { levelId, nodes } = scene()
    useScene.setState({ nodes: nodes as never, rootNodeIds: [levelId] })
    const saved = JSON.parse(JSON.stringify(useScene.getState().nodes)) as Record<
      string,
      DistintaNode
    >
    expect(buildDistinta(saved).rows.map((r) => r.quantity)).toEqual([2, 1])
  })
})
