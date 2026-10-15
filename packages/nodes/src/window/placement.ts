// The window tool's placement choices: the chips [O] Type and [L] Style.

import type { CornerBlockReason, ToolHint, WindowNode } from '@pascal-app/core'
import {
  getWindowStyleOverrides,
  SILLLESS_WINDOW_TYPES,
  WINDOW_STYLE_CHOICES,
  WINDOW_STYLE_LABELS,
  type WindowStyle,
  windowTakesStyle,
  windowTypeFields,
} from '@pascal-app/core/building'
import {
  CORNER_BLOCK_NOTES,
  type CornerSnapHint,
  cornerHintRows,
  useCornerSnapHint,
} from '@pascal-app/editor'
import { create } from 'zustand'

/** The window panel's Window Type row and the tool's Type chip. */
export const windowTypeOptions: Array<{ label: string; value: WindowNode['windowType'] }> = [
  { label: 'Fissa', value: 'fixed' },
  { label: 'Scorrevole', value: 'sliding' },
  { label: 'A battente', value: 'casement' },
  { label: 'A sporgere', value: 'awning' },
  { label: 'A ghigliottina singola', value: 'single-hung' },
  { label: 'A ghigliottina doppia', value: 'double-hung' },
  { label: 'Bovindo', value: 'bay' },
  { label: 'Bovindo curvo', value: 'bow' },
  { label: 'A lamelle', value: 'louvered' },
]

type WindowPlacementState = {
  type: WindowNode['windowType']
  style: WindowStyle
  cycleType(): void
  cycleStyle(): void
}

const next = <T>(list: readonly T[], value: T) => list[(list.indexOf(value) + 1) % list.length]!

export const useWindowPlacement = create<WindowPlacementState>((set, get) => ({
  type: 'fixed',
  style: 'single',
  cycleType: () =>
    set({
      type: next(
        windowTypeOptions.map((option) => option.value),
        get().type,
      ),
    }),
  cycleStyle: () => set({ style: next(WINDOW_STYLE_CHOICES, get().style) }),
}))

/**
 * The window the tool places: the chips' type and style, as the panel writes them. The draft takes
 * these by merge and the tool has no sill control, so the type always says whether there is a sill:
 * cycled past Bay or Bow, a Fixed window would otherwise keep their "no sill".
 */
export function placedWindowFields(): Partial<WindowNode> {
  const { type, style } = useWindowPlacement.getState()
  return {
    ...windowTypeFields(type),
    sill: !SILLLESS_WINDOW_TYPES.has(type),
    ...(windowTakesStyle(type) ? getWindowStyleOverrides(style) : {}),
  }
}

export const WINDOW_PLACEMENT_HINTS: ToolHint[] = [
  {
    key: 'O',
    label: 'Tipo',
    chip: {
      subscribe: (onChange) => useWindowPlacement.subscribe(onChange),
      value: () => useWindowPlacement.getState().type,
      cycle: () => useWindowPlacement.getState().cycleType(),
      labels: Object.fromEntries(
        windowTypeOptions.map((option) => [option.value, `Tipo: ${option.label}`]),
      ),
      tooltip: 'Tipo di finestra: fai clic o premi O per cambiarlo',
    },
  },
  {
    key: 'L',
    label: 'Stile',
    // Shown only while the tool places a Fixed window, the one type a style shapes.
    visible: {
      subscribe: (onChange) => useWindowPlacement.subscribe(onChange),
      value: () => windowTakesStyle(useWindowPlacement.getState().type),
    },
    chip: {
      subscribe: (onChange) => useWindowPlacement.subscribe(onChange),
      value: () => useWindowPlacement.getState().style,
      cycle: () => useWindowPlacement.getState().cycleStyle(),
      labels: Object.fromEntries(
        WINDOW_STYLE_CHOICES.map((style) => [style, `Stile: ${WINDOW_STYLE_LABELS[style]}`]),
      ),
      tooltip: 'Stile della finestra: fai clic o premi L per cambiarlo',
    },
  },
]

/**
 * What a click does while the ghost is inside a corner zone, or why it is not a corner: shown only
 * there, so the hint appears when the window can join and goes when it leaves.
 */
const HINTS_FOR: CornerSnapHint[] = [
  'join',
  'new',
  ...(Object.keys(CORNER_BLOCK_NOTES) as CornerBlockReason[]),
]

/** The plain click row, which gives way to the corner rows where a click does something else. */
export const WINDOW_PLAIN_PLACE_VISIBLE = {
  subscribe: (onChange: () => void) => useCornerSnapHint.subscribe(onChange),
  value: () => {
    const hint = useCornerSnapHint.getState().hint
    return hint !== 'join' && hint !== 'new'
  },
}

export const WINDOW_CORNER_HINTS: ToolHint[] = HINTS_FOR.flatMap((hint) =>
  cornerHintRows(hint).map((row) => ({
    key: row.keys.join('+'),
    label: row.label,
    visible: {
      subscribe: (onChange: () => void) => useCornerSnapHint.subscribe(onChange),
      value: () => useCornerSnapHint.getState().hint === hint,
    },
  })),
)
