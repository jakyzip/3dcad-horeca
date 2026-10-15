'use client'

import { type AnyNodeId, sceneRegistry, useScene } from '@pascal-app/core'
import { Html } from '@react-three/drei'
import { createPortal, useFrame } from '@react-three/fiber'
import { type FunctionComponent, useRef, useState } from 'react'
import type { Object3D } from 'three'
import { useShallow } from 'zustand/react/shallow'
import { label3dText, useHorecaLabels } from './labels'
import type { EquipmentNode } from './schema'

/** Gap between the top of the unit and the label, metres. */
const GAP = 0.12

/** True when the object and every ancestor up to the scene are drawn (hidden level, solo mode…). */
function drawn(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

function NodeLabel({ id, kindLabel }: { id: AnyNodeId; kindLabel: string }) {
  const node = useScene((s) => s.nodes[id]) as unknown as EquipmentNode | undefined
  const [group, setGroup] = useState<Object3D | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useFrame(() => {
    // The node's group registers after its renderer mounts and changes when it remounts.
    const current = sceneRegistry.nodes.get(id) ?? null
    if (current !== group) setGroup(current)
    if (box.current && group) box.current.style.display = drawn(group) ? '' : 'none'
  })

  if (!(node && group)) return null
  // Portaled into the unit's own group: the label follows moves, rotations and drags for free.
  return createPortal(
    <Html
      center
      position={[0, (node.elevation ?? 0) + node.height + GAP, 0]}
      style={{ pointerEvents: 'none' }}
      zIndexRange={[10, 0]}
    >
      <div
        ref={box}
        style={{
          padding: '2px 8px',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid rgba(0, 0, 0, 0.15)',
          color: '#1f2328',
          font: '500 12px/16px system-ui, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
        }}
      >
        {label3dText(node, kindLabel)}
      </div>
    </Html>,
    group,
  )
}

const systems = new Map<string, FunctionComponent>()

/**
 * The viewer system for one equipment kind: a name label above each of its units, as in the
 * hand-made renders. Mounted inside the canvas by the viewer (`def.system`), one per kind.
 */
export function labelsSystemFor(kind: string, kindLabel: string): FunctionComponent {
  const cached = systems.get(kind)
  if (cached) return cached
  const Labels: FunctionComponent = () => {
    const shown = useHorecaLabels((s) => s.shown)
    const ids = useScene(
      useShallow((s) =>
        Object.values(s.nodes)
          .filter((n) => n.type === kind && n.visible !== false)
          .map((n) => n.id as AnyNodeId),
      ),
    )
    if (!shown) return null
    return ids.map((id) => <NodeLabel id={id} key={id} kindLabel={kindLabel} />)
  }
  systems.set(kind, Labels)
  return Labels
}
