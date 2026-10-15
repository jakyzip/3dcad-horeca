import { emitter } from '@pascal-app/core'
import useEditor from '../store/use-editor'
import type { ContinuationMode } from './continuation'

/**
 * How the wall tool draws, picked from the Build panel's Rooms group before
 * drawing starts. Stored as the wall's continuation mode (persisted with the
 * editor preferences), so the choice survives tool switches and reloads.
 */
export type WallDrawVariant = 'rectangle' | 'polygon' | 'walls'

export type WallDrawVariantInfo = {
  id: WallDrawVariant
  /** The wall continuation mode the tool reads. */
  mode: ContinuationMode
  /** Tile label. */
  label: string
  /** The name the HUD shows while the variant is armed. */
  title: string
  iconSrc: string
  /** Caption under the Rooms tiles: a bold lead, then the rest. */
  caption: { lead: string; rest: string }
}

export const WALL_DRAW_VARIANTS: readonly WallDrawVariantInfo[] = [
  {
    id: 'rectangle',
    mode: 'rectangle',
    label: 'Rettangolo',
    title: 'Stanza rettangolare',
    iconSrc: '/icons/room.webp',
    caption: {
      lead: 'Fai clic su due vertici',
      rest: 'sulla griglia. Muri, pavimento e soffitto vengono creati insieme.',
    },
  },
  {
    id: 'polygon',
    mode: 'room',
    label: 'Poligono',
    title: 'Stanza poligonale',
    iconSrc: '/icons/polygon-room.webp',
    caption: {
      lead: 'Fai clic su ogni vertice,',
      rest: 'poi di nuovo sul primo per chiudere. Per stanze a L e con angoli obliqui.',
    },
  },
  {
    id: 'walls',
    mode: 'single',
    label: 'Muri',
    title: 'Muri',
    iconSrc: '/icons/wall.webp',
    caption: {
      lead: 'Disegna un muro alla volta.',
      rest: 'Chiudi il giro e diventa una stanza; lascialo aperto per i tramezzi.',
    },
  },
]

export const WALL_DRAW_IDLE_CAPTION =
  'Scegli una forma per iniziare. Ogni stanza ha i suoi muri, pavimento e soffitto.'

export function getWallDrawVariantInfo(variant: WallDrawVariant): WallDrawVariantInfo {
  return WALL_DRAW_VARIANTS.find((info) => info.id === variant) ?? WALL_DRAW_VARIANTS[1]!
}

export function wallDrawVariantOf(mode: ContinuationMode): WallDrawVariant {
  return WALL_DRAW_VARIANTS.find((info) => info.mode === mode)?.id ?? 'polygon'
}

export function getWallDrawVariant(): WallDrawVariant {
  return wallDrawVariantOf(useEditor.getState().getContinuation('wall'))
}

export function useWallDrawVariant(): WallDrawVariant {
  return useEditor((state) => wallDrawVariantOf(state.getContinuation('wall')))
}

/**
 * Pick how the wall tool draws. Callers arm the wall tool themselves; switching
 * while it is armed drops the in-flight draft so a half-drawn chain never
 * finishes as a rectangle.
 */
export function selectWallDrawVariant(variant: WallDrawVariant): void {
  const editor = useEditor.getState()
  const { mode } = getWallDrawVariantInfo(variant)
  if (editor.getContinuation('wall') === mode) return
  if (editor.mode === 'build' && editor.tool === 'wall') emitter.emit('tool:cancel')
  editor.setContinuation('wall', mode)
}
