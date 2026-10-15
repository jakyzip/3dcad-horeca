import { describe, expect, test } from 'bun:test'
import { formatSelectionBreakdown } from './selection-breakdown'

describe('formatSelectionBreakdown', () => {
  test('counts per type in first-appearance order, with Italian plurals', () => {
    expect(formatSelectionBreakdown(['slab', 'stair', 'fence', 'fence'])).toBe(
      '1 solaio · 1 scala · 2 recinzioni',
    )
  })

  test('names hyphenated kinds and humanizes unknown ones', () => {
    expect(formatSelectionBreakdown(['roof-segment', 'roof-segment', 'wall'])).toBe(
      '2 falde · 1 muro',
    )
    expect(formatSelectionBreakdown(['hvac-equipment'])).toBe('1 hvac equipment')
  })

  test('skips missing nodes', () => {
    expect(formatSelectionBreakdown(['wall', undefined, null])).toBe('1 muro')
  })

  test('empty selection formats to an empty string', () => {
    expect(formatSelectionBreakdown([])).toBe('')
  })
})
