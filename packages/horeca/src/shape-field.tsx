'use client'

import { type AnyNode, type AnyNodeId, nodeRegistry, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import type { EquipmentNode } from './schema'

/**
 * The node rebuilt as another equipment kind: same place, size, name and article, a new id.
 * Exported for tests; `null` when the kind is unknown or already the node's.
 */
export function reshapeNode(node: EquipmentNode, kind: string): EquipmentNode | null {
  const definition = nodeRegistry.get(kind)
  if (!definition || node.type === kind) return null
  const { id: _id, type: _type, ...kept } = node
  return definition.schema.parse({ ...definition.defaults(), ...kept, type: kind }) as EquipmentNode
}

/** Inspector field: change the shape of a placed element, as one undo step. */
export function ShapeField({ node, kinds }: { node: EquipmentNode; kinds: readonly string[] }) {
  const change = (kind: string) => {
    const next = reshapeNode(node, kind)
    if (!next) return
    // Plugin kinds sit outside the closed AnyNode union (see plugin-authoring.md).
    useScene.getState().applyNodeChanges({
      create: [
        { node: next as unknown as AnyNode, parentId: (node.parentId ?? undefined) as AnyNodeId },
      ],
      delete: [node.id as AnyNodeId],
    })
    useViewer.getState().setSelection({ selectedIds: [next.id as AnyNodeId] })
  }

  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">Forma</span>
      <select
        className="h-8 rounded-md border border-border/60 bg-background px-2 text-foreground text-sm"
        onChange={(event) => change(event.target.value)}
        value={node.type}
      >
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {nodeRegistry.get(kind)?.presentation?.label ?? kind}
          </option>
        ))}
      </select>
    </label>
  )
}
