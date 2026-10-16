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
  EQUIPMENT_KINDS,
  GENERICO,
  horecaPlugin,
  LAVELLO,
  LavelloNode,
  PENSILE,
  TAVOLO,
} from '../index'
import { reshapeNode } from '../shape-field'

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
    BancoFrigoNode.parse({
      ...nodeRegistry.get(BANCO_FRIGO)!.defaults(),
      metadata: { product: { code: 'BF-X', name: 'Banco da listino' } },
    }),
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
  test('registers the equipment kinds', () => {
    for (const kind of [BANCO_FRIGO, CELLA_FRIGO, LAVELLO, GENERICO]) {
      expect(nodeRegistry.get(kind)?.kind).toBe(kind)
    }
  })

  test('every kind: defaults parse, the body has the node size, the plan draws', () => {
    expect(EQUIPMENT_KINDS).toHaveLength(13)
    for (const kind of EQUIPMENT_KINDS) {
      const def = nodeRegistry.get(kind)!
      const node = def.schema.parse(def.defaults()) as { width: number }
      const object = def.geometry!(node as never, {} as never)
      const bodies: Mesh[] = []
      object.traverse((child) => {
        if (child instanceof Mesh && child.name.endsWith('-body')) bodies.push(child)
      })
      expect(bodies.map((b) => b.name)).toHaveLength(1)
      const size = new Box3().setFromObject(bodies[0]!).getSize(new Vector3())
      expect(size.x).toBeCloseTo(node.width, 3)
      const plan = def.floorplan!(node as never, {} as never)
      expect(plan?.kind).toBe('group')
    }
  })

  test('wall-hung units sit at their elevation; floor units at zero', () => {
    const pensile = nodeRegistry.get(PENSILE)!
    const node = pensile.schema.parse(pensile.defaults()) as { elevation: number }
    expect(node.elevation).toBe(1.5)
    expect(pensile.geometry!(node as never, {} as never).position.y).toBe(1.5)
    const tavolo = nodeRegistry.get(TAVOLO)!
    expect(
      tavolo.geometry!(tavolo.schema.parse(tavolo.defaults()) as never, {} as never).position.y,
    ).toBe(0)
  })

  test('a scene saved before elevation existed still loads', () => {
    const saved = { id: 'horeca_old', type: BANCO_FRIGO, width: 1.5, depth: 0.7, height: 0.85 }
    expect(BancoFrigoNode.parse(saved).elevation).toBe(0)
  })

  test('options change the geometry: table shelf and upstand, drip-rack cabinet', () => {
    const names = (kind: string, patch: Record<string, unknown>) => {
      const def = nodeRegistry.get(kind)!
      const out: string[] = []
      def.geometry!(
        def.schema.parse({ ...def.defaults(), ...patch }) as never,
        {} as never,
      ).traverse((c) => out.push(c.name))
      return out
    }
    expect(names(TAVOLO, { ripiano: true })).toContain('giorno-shelf')
    expect(names(TAVOLO, { ripiano: false })).not.toContain('giorno-shelf')
    expect(names(TAVOLO, { alzatina: true })).toContain('giorno-alzatina')
    expect(names(PENSILE, { gocciolatoio: true })).toContain('pensile-rack')
    expect(names(PENSILE, { gocciolatoio: true })).not.toContain('pensile-bottom')
  })

  test('the plan sheet lists each kind with exact quantities', () => {
    const { levelId, nodes } = scene()
    const schedules = collectFloorplanSchedules(nodes, levelId, 'metric', 'full')
    const cells = (title: string) =>
      schedules.find((s) => s.title === title)?.rows.map((row) => row.cells)
    expect(schedules.map((s) => s.title).sort()).toEqual(['Banchi frigo', 'Celle frigo'])
    expect(cells('Banchi frigo')).toEqual([
      { code: 'BF-150', name: 'Banco frigo', quantity: '2' },
      { code: 'BF-X', name: 'Banco da listino (non nel CRM)', quantity: '1' },
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

  test('changing shape keeps place, size, name and article under a new id', () => {
    const banco = BancoFrigoNode.parse({
      ...nodeRegistry.get(BANCO_FRIGO)!.defaults(),
      name: 'Banco bar',
      position: [2, 0, 3],
      rotation: Math.PI / 2,
      width: 2.5,
      metadata: { product: TAV },
    })
    const block = reshapeNode(banco, GENERICO)!
    expect(block.type).toBe(GENERICO)
    expect(block.id).not.toBe(banco.id)
    expect(block).toMatchObject({
      name: 'Banco bar',
      position: [2, 0, 3],
      rotation: Math.PI / 2,
      width: 2.5,
      depth: banco.depth,
      metadata: { product: TAV },
    })
    expect(reshapeNode(banco, BANCO_FRIGO)).toBeNull()
  })
})
