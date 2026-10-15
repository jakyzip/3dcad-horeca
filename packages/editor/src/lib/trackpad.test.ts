import { beforeEach, describe, expect, test } from 'bun:test'
import {
  looksLikeTrackpad,
  resolveWheelGesture,
  useNavigationDevice,
  type WheelLike,
  wheelGesture,
} from './trackpad'

const wheel = (patch: Partial<WheelLike>): WheelLike => ({
  ctrlKey: false,
  shiftKey: false,
  deltaX: 0,
  deltaY: 0,
  deltaMode: 0,
  ...patch,
})

describe('looksLikeTrackpad', () => {
  test('a pinch or a sideways slide is a trackpad', () => {
    expect(looksLikeTrackpad(wheel({ ctrlKey: true, deltaY: -2.37 }))).toBe(true)
    expect(looksLikeTrackpad(wheel({ deltaX: 3, deltaY: 1 }))).toBe(true)
  })

  test('a mouse wheel, Ctrl + wheel and Shift + wheel are not', () => {
    expect(looksLikeTrackpad(wheel({ deltaY: 100 }))).toBe(false)
    expect(looksLikeTrackpad(wheel({ ctrlKey: true, deltaY: 100 }))).toBe(false)
    expect(looksLikeTrackpad(wheel({ shiftKey: true, deltaX: 100 }))).toBe(false)
    expect(looksLikeTrackpad(wheel({ deltaMode: 1, deltaX: 3 }))).toBe(false)
  })
})

describe('wheelGesture', () => {
  test('with a mouse the wheel keeps its zoom', () => {
    expect(wheelGesture(wheel({ deltaY: 100 }), '3d', false)).toBe('default')
    expect(wheelGesture(wheel({ deltaY: 100 }), '2d', false)).toBe('default')
  })

  test('with a trackpad: orbit or pan by sliding, zoom by pinching', () => {
    expect(wheelGesture(wheel({ deltaY: 4 }), '3d', true)).toBe('orbit')
    expect(wheelGesture(wheel({ deltaY: 4, shiftKey: true }), '3d', true)).toBe('pan')
    expect(wheelGesture(wheel({ deltaY: 4 }), '2d', true)).toBe('pan')
    expect(wheelGesture(wheel({ deltaY: -1.5, ctrlKey: true }), '3d', true)).toBe('default')
  })
})

describe('resolveWheelGesture', () => {
  beforeEach(() => useNavigationDevice.setState({ device: 'auto', trackpadSeen: false }))

  test('automatic: a mouse until a trackpad gesture shows up, then a trackpad', () => {
    expect(resolveWheelGesture(wheel({ deltaY: 4 }), '3d')).toBe('default')
    resolveWheelGesture(wheel({ ctrlKey: true, deltaY: -0.8 }), '3d')
    expect(resolveWheelGesture(wheel({ deltaY: 4 }), '3d')).toBe('orbit')
  })

  test('a fixed choice wins over the detection', () => {
    useNavigationDevice.setState({ device: 'mouse' })
    expect(resolveWheelGesture(wheel({ deltaX: 5 }), '2d')).toBe('default')
    useNavigationDevice.setState({ device: 'trackpad' })
    expect(resolveWheelGesture(wheel({ deltaY: 4 }), '2d')).toBe('pan')
  })
})
