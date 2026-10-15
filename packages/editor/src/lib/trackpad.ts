import { create } from 'zustand'

/**
 * Navigating with a laptop trackpad. A Mac trackpad reaches the browser as wheel events: two
 * fingers sliding give deltaX/deltaY, a pinch gives the same with `ctrlKey` set. With a mouse
 * the wheel zooms, as before; with a trackpad two fingers move the view instead:
 * - 3D: slide = orbit, Shift + slide = pan, pinch = zoom;
 * - 2D: slide = pan, pinch = zoom.
 *
 * "Automatico" treats the device as a mouse until a gesture only a trackpad makes (a pinch, a
 * sideways slide) shows up, then keeps trackpad mode for the session.
 */

export type NavigationDevice = 'auto' | 'mouse' | 'trackpad'

export const NAVIGATION_DEVICE_LABELS: Record<NavigationDevice, string> = {
  auto: 'Automatico',
  mouse: 'Mouse',
  trackpad: 'Trackpad',
}

export type WheelLike = {
  ctrlKey: boolean
  shiftKey: boolean
  deltaX: number
  deltaY: number
  deltaMode: number
}

/** Whether this wheel event can only come from a trackpad. */
export function looksLikeTrackpad(event: WheelLike): boolean {
  if (event.deltaMode !== 0) return false
  // A pinch: fractional steps (Ctrl + a mouse wheel gives whole ones).
  if (event.ctrlKey && !Number.isInteger(event.deltaY)) return true
  // A sideways slide; Shift + a mouse wheel also scrolls sideways, so not with Shift.
  return !event.shiftKey && event.deltaX !== 0
}

export type WheelGesture = 'default' | 'orbit' | 'pan'

/** What a wheel event does in the given view; 'default' keeps the view's own wheel zoom. */
export function wheelGesture(event: WheelLike, view: '2d' | '3d', trackpad: boolean): WheelGesture {
  if (!trackpad || event.ctrlKey) return 'default'
  if (view === '2d') return 'pan'
  return event.shiftKey ? 'pan' : 'orbit'
}

const STORAGE_KEY = '3dcad-horeca:navigation-device'

function readDevice(): NavigationDevice {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return stored === 'mouse' || stored === 'trackpad' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

export const useNavigationDevice = create<{
  device: NavigationDevice
  /** A trackpad gesture was seen this session (for "Automatico"). */
  trackpadSeen: boolean
  load: () => void
  setDevice: (device: NavigationDevice) => void
}>((set) => ({
  device: 'auto',
  trackpadSeen: false,
  load: () => set({ device: readDevice() }),
  setDevice: (device) => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, device)
    } catch {
      // Kept until the page closes.
    }
    set({ device })
  },
}))

/** Reads the event against the preference: notes a trackpad, then says what the gesture does. */
export function resolveWheelGesture(event: WheelLike, view: '2d' | '3d'): WheelGesture {
  const state = useNavigationDevice.getState()
  if (state.device === 'auto' && !state.trackpadSeen && looksLikeTrackpad(event))
    useNavigationDevice.setState({ trackpadSeen: true })
  const trackpad =
    state.device === 'trackpad' ||
    (state.device === 'auto' && useNavigationDevice.getState().trackpadSeen)
  return wheelGesture(event, view, trackpad)
}

let loaded = false
/** Applies the stored preference once, on the client. */
export function loadNavigationDevice() {
  if (loaded) return
  loaded = true
  useNavigationDevice.getState().load()
}
