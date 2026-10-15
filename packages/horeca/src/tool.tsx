'use client'

import {
  type AnyNodeId,
  emitter,
  type GridEvent,
  nodeRegistry,
  resolveSupportSlabPatch,
  sceneRegistry,
  useScene,
} from '@pascal-app/core'
import { isGridSnapActive, isTypingTarget, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useFrame } from '@react-three/fiber'
import { type ComponentType, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Object3D } from 'three'
import type { ZodType } from 'zod'
import type { EquipmentNode } from './schema'

const PREVIEW_OPACITY = 0.55
const ROTATE_STEP_RAD = Math.PI / 4

const snap = (value: number, step: number) => (step > 0 ? Math.round(value / step) * step : value)

/** Keeps the ghost on the active level's elevation (tools mount in the building-local group). */
function LevelOffset({ children }: { children: ReactNode }) {
  const activeLevelId = useViewer((s) => s.selection.levelId)
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const level = activeLevelId ? sceneRegistry.nodes.get(activeLevelId as AnyNodeId) : null
    ref.current.position.y = level ? level.position.y : 0
  })
  return <group ref={ref}>{children}</group>
}

type ToolSpec = {
  kind: string
  schema: ZodType<EquipmentNode>
  build: (node: EquipmentNode) => Object3D
}

/**
 * Click-to-place tool shared by the equipment kinds: a translucent ghost follows the grid, R / T
 * rotate it by 45°, a click places the node on the active level and selects it.
 */
function createPlacementTool({ kind, schema, build }: ToolSpec): ComponentType {
  const PlacementTool = () => {
    const activeLevelId = useViewer((s) => s.selection.levelId)
    const toolDefaults = useEditor((s) => s.toolDefaults[kind])
    const [cursor, setCursor] = useState<[number, number, number] | null>(null)
    const [yaw, setYaw] = useState(0)
    const yawRef = useRef(0)

    const fresh = useMemo(
      () => () => ({ ...nodeRegistry.get(kind)!.defaults(), ...toolDefaults }),
      [toolDefaults],
    )
    const ghost = useMemo(() => {
      const object = build(schema.parse(fresh()))
      object.traverse((child) => {
        const mesh = child as { material?: { transparent: boolean; opacity: number } }
        if (mesh.material) {
          mesh.material.transparent = true
          mesh.material.opacity = PREVIEW_OPACITY
        }
      })
      return object
    }, [fresh])

    useEffect(() => {
      if (!activeLevelId) return
      const resolve = (event: GridEvent): [number, number, number] => {
        const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
        return [snap(event.localPosition[0], step), 0, snap(event.localPosition[2], step)]
      }
      const onMove = (event: GridEvent) => setCursor(resolve(event))
      const onClick = (event: GridEvent) => {
        const placed = schema.parse({
          ...fresh(),
          position: resolve(event),
          rotation: yawRef.current,
          parentId: activeLevelId,
        })
        const committed = schema.parse({
          ...placed,
          ...resolveSupportSlabPatch(placed as never, useScene.getState().nodes),
        })
        // Plugin kinds sit outside the closed AnyNode union (see plugin-authoring.md).
        useScene.getState().createNode(committed as never, activeLevelId)
        useViewer.getState().setSelection({ selectedIds: [committed.id] })
        triggerSFX('sfx:item-place')
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target)) return
        if (!['r', 'R', 't', 'T'].includes(e.key)) return
        // Capture phase, so the editor's selection rotate does not also turn the last placed node.
        e.preventDefault()
        e.stopPropagation()
        yawRef.current += (e.key === 't' || e.key === 'T' || e.shiftKey ? -1 : 1) * ROTATE_STEP_RAD
        setYaw(yawRef.current)
      }
      emitter.on('grid:move', onMove)
      emitter.on('grid:click', onClick)
      window.addEventListener('keydown', onKeyDown, true)
      return () => {
        emitter.off('grid:move', onMove)
        emitter.off('grid:click', onClick)
        window.removeEventListener('keydown', onKeyDown, true)
      }
    }, [activeLevelId, fresh])

    if (!activeLevelId || !cursor) return null
    return (
      <LevelOffset>
        <group position={cursor} rotation={[0, yaw, 0]}>
          <primitive object={ghost} />
        </group>
      </LevelOffset>
    )
  }
  PlacementTool.displayName = `PlacementTool(${kind})`
  return PlacementTool
}

const tools = new Map<string, ComponentType>()

/** One stable component per kind, so React keeps the tool mounted across renders. */
export function placementToolFor(spec: ToolSpec): ComponentType {
  let tool = tools.get(spec.kind)
  if (!tool) {
    tool = createPlacementTool(spec)
    tools.set(spec.kind, tool)
  }
  return tool
}
