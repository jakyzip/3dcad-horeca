import { describe, expect, test } from 'bun:test'
import { resolveRotateHandleHelpHints, resolveSelectModeHelpHints } from './contextual-help'

test('rotation advertises Alt as the temporary free-rotation override', () => {
  expect(resolveRotateHandleHelpHints(false)).toEqual([
    { keys: ['Alt'], label: 'Tieni premuto per ruotare liberamente', active: false },
  ])
  expect(resolveRotateHandleHelpHints(true)).toEqual([
    { keys: ['Alt'], label: 'Rotazione libera (senza passo angolare)', active: true },
  ])
})

describe('resolveSelectModeHelpHints', () => {
  test('stays hidden in idle select mode with no selection', () => {
    expect(
      resolveSelectModeHelpHints({
        selectedCount: 0,
        hasMovableSelection: false,
        hasRotatableSelection: false,
        commandPressed: false,
        shiftPressed: false,
      }),
    ).toEqual([])
  })

  test('shows multi-select guidance when a modifier is held without selection', () => {
    expect(
      resolveSelectModeHelpHints({
        selectedCount: 0,
        hasMovableSelection: false,
        hasRotatableSelection: false,
        commandPressed: true,
        shiftPressed: false,
      }),
    ).toEqual([
      {
        keys: [['Cmd/Ctrl', 'Shift'], 'Left click'],
        label: 'Aggiungi o togli oggetti dalla selezione',
        active: true,
      },
    ])
  })

  test('shows direct manipulation tips for selected movable and rotatable nodes', () => {
    const hints = resolveSelectModeHelpHints({
      selectedCount: 1,
      hasMovableSelection: true,
      hasRotatableSelection: true,
      commandPressed: false,
      shiftPressed: false,
    })

    expect(hints).toContainEqual({
      keys: ['Left click'],
      label: 'Trascina l’oggetto selezionato',
    })
    expect(hints).toContainEqual({
      keys: ['Cmd/Ctrl', 'Right click'],
      label: 'Trascina a sinistra o a destra per ruotare l’oggetto selezionato',
    })
    // Cmd/Ctrl and Shift click both toggle selection membership (3D selection
    // manager and 2D floorplan alike) — advertised as a single or-group row.
    expect(hints).toContainEqual({
      keys: [['Cmd/Ctrl', 'Shift'], 'Left click'],
      label: 'Aggiungi o togli oggetti dalla selezione',
      active: false,
    })
  })

  test('multi-selection advertises the group move + rotate gestures', () => {
    const hints = resolveSelectModeHelpHints({
      selectedCount: 3,
      hasMovableSelection: true,
      hasRotatableSelection: true,
      commandPressed: false,
      shiftPressed: false,
    })

    expect(hints).toEqual([
      {
        keys: ['Left click'],
        label: 'Fai clic o trascina la selezione per spostarla tutta insieme',
      },
      { keys: ['R / T'], label: 'Ruota la selezione di ±45°' },
      {
        keys: ['Cmd/Ctrl', 'G'],
        label: 'Raggruppa la selezione (solo in questa sessione)',
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'G'],
        label: 'Separa il gruppo della sessione',
      },
      {
        keys: [['Cmd/Ctrl', 'Shift'], 'Left click'],
        label: 'Aggiungi o togli oggetti dalla selezione',
        active: false,
      },
      { keys: ['Esc'], label: 'Annulla la selezione (o fai clic fuori)' },
    ])
  })

  test('holding a modifier keeps the same rows and only lights the selection one', () => {
    // Guides/snapping are governed by the snapping mode (Shift toggles it),
    // so no modifier-specific "freely / with guides / bypass" variants exist.
    const hints = resolveSelectModeHelpHints({
      selectedCount: 1,
      hasMovableSelection: true,
      hasRotatableSelection: true,
      commandPressed: true,
      shiftPressed: true,
    })

    expect(hints).toEqual([
      {
        keys: ['Left click'],
        label: 'Trascina l’oggetto selezionato',
      },
      {
        keys: ['Cmd/Ctrl', 'Right click'],
        label: 'Trascina a sinistra o a destra per ruotare l’oggetto selezionato',
      },
      {
        keys: [['Cmd/Ctrl', 'Shift'], 'Left click'],
        label: 'Aggiungi o togli oggetti dalla selezione',
        active: true,
      },
    ])
  })

  test('shows the single-side radius hint for rounded openings', () => {
    expect(
      resolveSelectModeHelpHints({
        selectedCount: 1,
        hasMovableSelection: true,
        hasRotatableSelection: false,
        hasOpeningRadiusSelection: true,
        commandPressed: false,
        shiftPressed: false,
      }),
    ).toContainEqual({
      keys: ['Shift'],
      label: 'Regola il raggio dell’angolo su un solo lato',
      active: false,
    })
  })
})
