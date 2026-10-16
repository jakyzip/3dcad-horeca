'use client'

import {
  type AnyNode,
  type AnyNodeId,
  nodeRegistry,
  sceneRegistry,
  useScene,
} from '@pascal-app/core'
import { useFrame, useThree } from '@react-three/fiber'
import { type FunctionComponent, useEffect, useRef } from 'react'
import { type Camera, type Object3D, Vector3 } from 'three'
import { label3dText, useHorecaLabels } from './labels'
import { RILIEVO } from './rilievo-schema'
import type { EquipmentNode } from './schema'

/** Gap between the top of the unit and the label, metres. */
const GAP = 0.12

/** True when the object and every ancestor up to the scene are drawn (hidden level, solo mode…). */
function drawn(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

export type LabelPlacement = { id: string; text: string; x: number; y: number }

const point = new Vector3()

/**
 * Where each unit's name sits on screen, in CSS pixels of a `width` × `height` view: above the
 * unit, centred. Units hidden, behind the camera or not yet built are left out. `kind` limits it
 * to one kind; without it every Ho.Re.Ca unit is placed (the render draws them all at once).
 */
export function labelPlacements(
  camera: Camera,
  width: number,
  height: number,
  kind?: string,
): LabelPlacement[] {
  const placements: LabelPlacement[] = []
  for (const node of Object.values(useScene.getState().nodes) as AnyNode[]) {
    const type = node.type as string
    if (kind ? type !== kind : !type.startsWith('horeca:') || type === RILIEVO) continue
    if (node.visible === false) continue
    const group = sceneRegistry.nodes.get(node.id as AnyNodeId)
    if (!(group && drawn(group))) continue
    const unit = node as unknown as EquipmentNode
    // The label rides in the unit's own frame, as the unit's group places its geometry.
    group.updateWorldMatrix(true, false)
    point.set(0, (unit.elevation ?? 0) + unit.height + GAP, 0).applyMatrix4(group.matrixWorld)
    point.project(camera)
    if (point.z < -1 || point.z > 1) continue
    placements.push({
      id: node.id,
      text: label3dText(unit, nodeRegistry.get(type)?.presentation?.label ?? type),
      x: ((point.x + 1) / 2) * width,
      y: ((1 - point.y) / 2) * height,
    })
  }
  return placements
}

const LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  left: '0',
  top: '0',
  padding: '2px 8px',
  borderRadius: '6px',
  background: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(0, 0, 0, 0.15)',
  color: '#1f2328',
  font: '500 12px/16px system-ui, sans-serif',
  whiteSpace: 'nowrap',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
  willChange: 'transform',
}

const systems = new Map<string, FunctionComponent>()

/**
 * The viewer system for one equipment kind: a name label above each of its units, as in the
 * hand-made renders. Plain elements over the canvas, moved every frame: no React root per
 * label, so nothing is mounted or unmounted while the scene renders.
 */
export function labelsSystemFor(kind: string, _kindLabel: string): FunctionComponent {
  const cached = systems.get(kind)
  if (cached) return cached
  const Labels: FunctionComponent = () => {
    const shown = useHorecaLabels((s) => s.shown)
    const gl = useThree((s) => s.gl)
    const layer = useRef<HTMLDivElement | null>(null)
    const labels = useRef(new Map<string, HTMLDivElement>())

    useEffect(() => {
      const parent = gl.domElement.parentElement
      if (!(shown && parent)) return
      const div = document.createElement('div')
      Object.assign(div.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        overflow: 'hidden',
      })
      parent.appendChild(div)
      layer.current = div
      const map = labels.current
      return () => {
        div.remove()
        layer.current = null
        map.clear()
      }
    }, [gl, shown])

    useFrame(({ camera, size }) => {
      const div = layer.current
      if (!div) return
      const seen = new Set<string>()
      for (const p of labelPlacements(camera, size.width, size.height, kind)) {
        seen.add(p.id)
        let el = labels.current.get(p.id)
        if (!el) {
          el = document.createElement('div')
          Object.assign(el.style, LABEL_STYLE)
          div.appendChild(el)
          labels.current.set(p.id, el)
        }
        if (el.textContent !== p.text) el.textContent = p.text
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
      }
      for (const [id, el] of labels.current)
        if (!seen.has(id)) {
          el.remove()
          labels.current.delete(id)
        }
    })

    return null
  }
  systems.set(kind, Labels)
  return Labels
}

/** Draws the labels onto a finished render, `scale` canvas pixels per CSS pixel. */
export function drawLabels(
  context: CanvasRenderingContext2D,
  placements: readonly LabelPlacement[],
  scale: number,
) {
  context.save()
  context.scale(scale, scale)
  context.font = '500 12px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const p of placements) {
    const w = context.measureText(p.text).width + 16
    const h = 20
    context.beginPath()
    context.roundRect(p.x - w / 2, p.y - h / 2, w, h, 6)
    context.fillStyle = 'rgba(255, 255, 255, 0.92)'
    context.shadowColor = 'rgba(0, 0, 0, 0.15)'
    context.shadowBlur = 3
    context.shadowOffsetY = 1
    context.fill()
    context.shadowColor = 'transparent'
    context.strokeStyle = 'rgba(0, 0, 0, 0.15)'
    context.lineWidth = 1
    context.stroke()
    context.fillStyle = '#1f2328'
    context.fillText(p.text, p.x, p.y + 0.5)
  }
  context.restore()
}
