import type { LevelNode } from '../schema'

/** What an unnamed level is called: Piano terra, Piano 1, Piano 2…, Interrato, Interrato 2… */
export function getDefaultLevelName(level: number): string {
  if (level === 0) return 'Piano terra'
  if (level > 0) return `Piano ${level}`
  return level === -1 ? 'Interrato' : `Interrato ${-level}`
}

/** The English default an older build stored ("Ground floor", "Floor 1", "Basement 2"). */
function englishDefaultLevelName(level: number): string {
  if (level === 0) return 'Ground floor'
  if (level > 0) return `Floor ${level}`
  return level === -1 ? 'Basement' : `Basement ${-level}`
}

/**
 * Whether a stored name is only a placeholder for the level's place: the
 * default name in Italian or English, or the "Level N" an older build stamped.
 */
export function isDefaultLevelName(name: string | undefined, level: number): boolean {
  const trimmed = name?.trim()
  return (
    !trimmed ||
    trimmed === getDefaultLevelName(level) ||
    trimmed === englishDefaultLevelName(level) ||
    trimmed === `Level ${level}`
  )
}

/**
 * The one way a level's name is shown. A name the user gave wins; a level
 * without one — or still carrying a placeholder an older build stored — reads
 * by its place in the building. Display only: the stored name is never rewritten.
 */
export function getLevelDisplayName(level: Pick<LevelNode, 'name' | 'level'>): string {
  return isDefaultLevelName(level.name, level.level)
    ? getDefaultLevelName(level.level)
    : level.name!.trim()
}
