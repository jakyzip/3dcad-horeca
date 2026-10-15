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
export function requestRender(width: number, withLabels: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (useHorecaRender.getState().request) {
      reject(new Error('C’è già un render in corso.'))
      return
    }
    useHorecaRender.setState({ request: { width, withLabels, resolve, reject } })
  })
}
