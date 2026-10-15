import { ENUM_LABELS_IT, FIELD_LABELS_IT } from '../../../lib/field-labels-it'

export function precisionForStep(step: number): number {
  if (step <= 0) return 0
  return Math.max(0, Math.ceil(-Math.log10(step)))
}

export function prettifyKey(key: string): string {
  if (Object.hasOwn(FIELD_LABELS_IT, key)) return FIELD_LABELS_IT[key]!
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function prettifyEnumValue(value: string): string {
  if (Object.hasOwn(ENUM_LABELS_IT, value)) return ENUM_LABELS_IT[value]!
  return value
    .split(/[-_\s]/)
    .map((word, i) =>
      i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word.toLowerCase(),
    )
    .join(' ')
}
