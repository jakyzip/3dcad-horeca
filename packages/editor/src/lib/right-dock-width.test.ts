import { describe, expect, test } from 'bun:test'
import {
  clampRightDockWidth,
  RIGHT_DOCK_DEFAULT_WIDTH,
  RIGHT_DOCK_MAX_WIDTH,
  RIGHT_DOCK_MIN_WIDTH,
} from './right-dock-width'

describe('clampRightDockWidth', () => {
  test('keeps a width inside the limits, rounded', () => {
    expect(clampRightDockWidth(400.4)).toBe(400)
  })

  test('stops at the limits', () => {
    expect(clampRightDockWidth(100)).toBe(RIGHT_DOCK_MIN_WIDTH)
    expect(clampRightDockWidth(5000)).toBe(RIGHT_DOCK_MAX_WIDTH)
  })

  test('falls back to the default for a broken stored value', () => {
    expect(clampRightDockWidth(Number('abc'))).toBe(RIGHT_DOCK_DEFAULT_WIDTH)
  })
})
