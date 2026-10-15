import type { ContextualHelpNodeExtension, ContextualShortcutHint } from '@pascal-app/editor'
import useBlockEditSession from './edit-session'
import type { BlockComponentMode } from './selection-model'

const MODE_LABELS: Record<BlockComponentMode, string> = {
  vertex: 'Vertice',
  edge: 'Spigolo',
  face: 'Faccia',
}

const MODE_OPERATIONS: Record<BlockComponentMode, ContextualShortcutHint[]> = {
  vertex: [{ keys: ['M'], label: 'Unisci i vertici selezionati' }],
  edge: [
    { keys: ['Cmd/Ctrl', 'B'], label: 'Smussa gli spigoli selezionati' },
    { keys: ['D'], label: 'Dissolvi gli spigoli selezionati' },
  ],
  face: [
    { keys: ['E'], label: 'Estrudi le facce selezionate' },
    { keys: ['I'], label: 'Fai rientrare le facce selezionate' },
  ],
}

const HINTS_BY_MODE = Object.fromEntries(
  (Object.keys(MODE_LABELS) as BlockComponentMode[]).map((mode) => [
    mode,
    [
      {
        keys: [['1', '2', '3']],
        label: `Modalità ${MODE_LABELS[mode]}`,
        subtitle: 'Vertice / Spigolo / Faccia',
      },
      { keys: [['G', 'R', 'S']], label: 'Sposta / Ruota / Ridimensiona la selezione' },
      ...MODE_OPERATIONS[mode],
      { keys: ['Tab'], label: 'Esci dalla modifica della mesh' },
    ],
  ]),
) as Record<BlockComponentMode, ContextualShortcutHint[]>

const EMPTY_HINTS: ContextualShortcutHint[] = []

export const blockContextualHelp: ContextualHelpNodeExtension = {
  subscribe: useBlockEditSession.subscribe,
  getHints: (nodeId) => {
    const session = useBlockEditSession.getState()
    return session.nodeId === nodeId ? HINTS_BY_MODE[session.selection.mode] : EMPTY_HINTS
  },
}
