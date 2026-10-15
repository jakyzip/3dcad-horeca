import type { ToolHint } from '@pascal-app/core'
import { create } from 'zustand'

export type RunHangerTool = 'duct-segment' | 'pipe-segment'

type RunHangerModeState = {
  enabled: Record<RunHangerTool, boolean>
  setEnabled: (tool: RunHangerTool, enabled: boolean) => void
  toggle: (tool: RunHangerTool) => void
}

export const useRunHangerMode = create<RunHangerModeState>((set) => ({
  enabled: {
    'duct-segment': false,
    'pipe-segment': false,
  },
  setEnabled: (tool, enabled) =>
    set((state) => ({ enabled: { ...state.enabled, [tool]: enabled } })),
  toggle: (tool) =>
    set((state) => ({ enabled: { ...state.enabled, [tool]: !state.enabled[tool] } })),
}))

export function createRunHangerToolHint(tool: RunHangerTool): ToolHint {
  return {
    key: 'H',
    label: 'Staffe automatiche',
    chip: {
      subscribe: (onChange) =>
        useRunHangerMode.subscribe((state, previous) => {
          if (state.enabled[tool] !== previous.enabled[tool]) onChange()
        }),
      value: () => (useRunHangerMode.getState().enabled[tool] ? 'on' : 'off'),
      cycle: () => useRunHangerMode.getState().toggle(tool),
      labels: {
        off: 'Staffe automatiche: disattive',
        on: 'Staffe automatiche: attive',
      },
      icons: {
        off: 'lucide:toggle-left',
        on: 'lucide:toggle-right',
      },
      tooltip: 'Staffe automatiche: fai clic o premi H per attivarle o disattivarle',
    },
  }
}
