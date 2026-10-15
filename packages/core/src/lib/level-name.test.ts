import { describe, expect, test } from 'bun:test'
import { getDefaultLevelName, getLevelDisplayName, isDefaultLevelName } from './level-name'

describe('level names', () => {
  test('an unnamed level reads by its place in the building', () => {
    expect([-2, -1, 0, 1, 2].map(getDefaultLevelName)).toEqual([
      'Interrato 2',
      'Interrato',
      'Piano terra',
      'Piano 1',
      'Piano 2',
    ])
    expect(getLevelDisplayName({ level: 0 })).toBe('Piano terra')
    expect(getLevelDisplayName({ name: '  ', level: 1 })).toBe('Piano 1')
  })

  test('the "Level N" an older build stamped reads like no name; a real name wins', () => {
    expect(getLevelDisplayName({ name: 'Level 0', level: 0 })).toBe('Piano terra')
    expect(getLevelDisplayName({ name: 'Level 2', level: 2 })).toBe('Piano 2')
    // A "Level N" that does not match its own place was chosen by someone.
    expect(getLevelDisplayName({ name: 'Level 3', level: 1 })).toBe('Level 3')
    expect(getLevelDisplayName({ name: 'Attic', level: 2 })).toBe('Attic')
  })

  test('the English default an older build stored reads by its place', () => {
    expect(getLevelDisplayName({ name: 'Ground floor', level: 0 })).toBe('Piano terra')
    expect(getLevelDisplayName({ name: 'Basement 2', level: -2 })).toBe('Interrato 2')
    expect(isDefaultLevelName('Floor 1', 1)).toBe(true)
    expect(isDefaultLevelName('Floor 1', 2)).toBe(false)
  })
})
