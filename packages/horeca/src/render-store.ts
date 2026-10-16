import { create } from 'zustand'

/**
 * A render asked for from the panel (outside the 3D canvas) and carried out by `RenderSystem`
 * (inside it). The panel awaits the PNG.
 */

export type RenderRequest = {
  /** Output width in pixels; the height follows the view's proportions. */
  width: number
  /** Keep the equipment names in the picture. */
  withLabels: boolean
  /** Path traced and refined on screen (`FotoDialog`) instead of drawn by the view itself. */
  foto: boolean
  resolve: (png: Blob) => void
  reject: (error: Error) => void
}

export const RENDER_WIDTHS: ReadonlyArray<{ width: number; label: string }> = [
  { width: 1920, label: 'Full HD (1920 px)' },
  { width: 2560, label: 'QHD (2560 px)' },
  { width: 3840, label: '4K (3840 px)' },
]

export const useHorecaRender = create<{ request: RenderRequest | null }>(() => ({ request: null }))

/** Ask the canvas for a render; rejects if one is already running. */
export function requestRender(width: number, withLabels: boolean, foto = false): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (useHorecaRender.getState().request) {
      reject(new Error('C’è già un render in corso.'))
      return
    }
    useHorecaRender.setState({ request: { width, withLabels, foto, resolve, reject } })
  })
}

/** A path traced render being refined on screen: the frozen scene and how to finish. */
export type FotoJob = {
  scene: import('three').Scene
  camera: import('three').Camera
  /** Output size in pixels. */
  width: number
  height: number
  /** Names to draw over the result, in CSS pixels of the view, and canvas pixels per CSS pixel. */
  labels: import('./labels-3d').LabelPlacement[]
  labelScale: number
  /** The view's exposure, so the picture keeps its brightness. */
  exposure: number
  dispose: () => void
  resolve: (png: Blob) => void
  reject: (error: Error) => void
}

/** The rejection of a photorealistic render the user closed: not an error to report. */
export const FOTO_ANNULLATO = 'Render annullato.'

export const useFoto = create<{ job: FotoJob | null }>(() => ({ job: null }))
