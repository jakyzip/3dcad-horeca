import { create } from 'zustand'

// The docked inspector's width, dragged from its left edge and kept per viewer.
// Read when the module loads, like `inspector-expanded.ts`: the column opens
// with the editor. Storage can be missing or refuse; the default width then.
const STORAGE_KEY = '3dcad-horeca:right-dock-width'

export const RIGHT_DOCK_DEFAULT_WIDTH = 340
export const RIGHT_DOCK_MIN_WIDTH = 280
export const RIGHT_DOCK_MAX_WIDTH = 640

export function clampRightDockWidth(width: number): number {
  if (!Number.isFinite(width)) return RIGHT_DOCK_DEFAULT_WIDTH
  return Math.round(Math.min(RIGHT_DOCK_MAX_WIDTH, Math.max(RIGHT_DOCK_MIN_WIDTH, width)))
}

function readWidth(): number {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return stored ? clampRightDockWidth(Number(stored)) : RIGHT_DOCK_DEFAULT_WIDTH
  } catch {
    return RIGHT_DOCK_DEFAULT_WIDTH
  }
}

export const useRightDockWidth = create<{
  width: number
  setWidth: (width: number) => void
  /** Remembers the current width; called when a drag ends, not on every move. */
  save: () => void
}>((set, get) => ({
  width: readWidth(),
  setWidth: (width) => set({ width: clampRightDockWidth(width) }),
  save: () => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, String(get().width))
    } catch {
      // Not remembered this time; the column keeps the width until reload.
    }
  },
}))
