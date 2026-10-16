'use client'

import { useViewer } from '@pascal-app/viewer'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { useHorecaLabels } from './labels'
import { drawLabels, type LabelPlacement, labelPlacements } from './labels-3d'
import { type RenderRequest, useHorecaRender } from './render-store'

/** Frames to let the bigger buffers settle and the screen-space light (SSGI, denoise) converge. */
const SETTLE_FRAMES = 40
/** A safe ceiling for the drawing buffer on common GPUs. */
const MAX_SIDE = 8192
/**
 * And for its area: the post effects keep several buffers this size, and a narrow, tall view
 * (the docked inspector takes width) asked for at 4K went well past what a laptop GPU holds,
 * losing the device. About a 4K frame.
 */
const MAX_PIXELS = 3840 * 2400

type Restore = () => void

/**
 * Hide what is editing aid rather than the room: grid, guides, zones, scans, selection, hover.
 * The name labels are page elements, not part of the canvas: hidden too, and drawn onto the
 * picture afterwards when asked for (`drawLabels`).
 */
function cleanView(): Restore {
  const viewer = useViewer.getState()
  const saved = {
    showGrid: viewer.showGrid,
    showGuides: viewer.showGuides,
    showZones: viewer.showZones,
    showScans: viewer.showScans,
    selection: viewer.selection,
    labels: useHorecaLabels.getState().shown,
  }
  viewer.setShowGrid(false)
  viewer.setShowGuides(false)
  viewer.setShowZones(false)
  viewer.setShowScans(false)
  viewer.setHoveredId(null)
  viewer.setSelection({ selectedIds: [], zoneId: null })
  useHorecaLabels.getState().setShown(false)
  return () => {
    const v = useViewer.getState()
    v.setShowGrid(saved.showGrid)
    v.setShowGuides(saved.showGuides)
    v.setShowZones(saved.showZones)
    v.setShowScans(saved.showScans)
    v.setSelection(saved.selection)
    useHorecaLabels.getState().setShown(saved.labels)
  }
}

/**
 * Carries out a render request inside the canvas: the current view, with editing aids hidden,
 * redrawn at the requested width by raising the pixel ratio, then read back right after a frame
 * (same task, which a WebGPU canvas needs) and everything put back as it was.
 *
 * Mounted once as the `def.system` of the survey kind, which is always installed with the pack.
 */
export function RenderSystem() {
  const setDpr = useThree((s) => s.setDpr)
  const job = useRef<{
    request: RenderRequest
    frames: number
    restore: Restore
    dpr: number
  } | null>(null)

  useFrame((state) => {
    const current = useHorecaRender.getState().request
    if (current && !job.current) {
      const { width, height } = state.size
      const target = Math.min(current.width, MAX_SIDE) / Math.max(width, 1)
      const ratio = Math.min(
        target,
        MAX_SIDE / Math.max(height, 1),
        Math.sqrt(MAX_PIXELS / Math.max(width * height, 1)),
      )
      job.current = {
        request: current,
        frames: 0,
        restore: cleanView(),
        dpr: state.viewport.dpr,
      }
      setDpr(ratio)
      return
    }
    const active = job.current
    if (!active) return
    active.frames++
    if (active.frames < SETTLE_FRAMES) return
    // Read the next frame as soon as it is drawn, in the same task.
    job.current = null
    const canvas = state.gl.domElement as HTMLCanvasElement
    const scale = canvas.width / Math.max(state.size.width, 1)
    const labels = active.request.withLabels
      ? labelPlacements(state.camera, state.size.width, state.size.height)
      : []
    const finish = (error?: Error, png?: Blob | null) => {
      setDpr(active.dpr)
      active.restore()
      useHorecaRender.setState({ request: null })
      if (png) active.request.resolve(png)
      else active.request.reject(error ?? new Error('Render non riuscito.'))
    }
    const unsubscribe = addAfterEffect(() => {
      unsubscribe()
      try {
        canvas.toBlob((png) => {
          if (!(png && labels.length)) return finish(undefined, png)
          withLabels(png, labels, scale).then(
            (labelled) => finish(undefined, labelled),
            (error) => finish(error instanceof Error ? error : new Error(String(error))),
          )
        }, 'image/png')
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })

  return null
}

/** The render with the units' names drawn over it, as they show in the 3D view. */
async function withLabels(png: Blob, labels: LabelPlacement[], scale: number): Promise<Blob> {
  const image = await createImageBitmap(png)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) return png
  context.drawImage(image, 0, 0)
  image.close()
  drawLabels(context, labels, scale)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error('Render non riuscito.'))),
      'image/png',
    ),
  )
}
