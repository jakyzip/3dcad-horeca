'use client'

import { useEffect } from 'react'
import {
  loadNavigationDevice,
  NAVIGATION_DEVICE_LABELS,
  type NavigationDevice,
  useNavigationDevice,
} from '../../../../../lib/trackpad'
import { SegmentedControl } from '../../../controls/segmented-control'

const HINTS: Record<NavigationDevice, string> = {
  auto: 'Si comporta come con il mouse finché non usi un gesto del trackpad (pizzico o scorrimento laterale), poi passa al trackpad.',
  mouse: 'Rotellina: zoom. Tasto destro: ruota. Tasto centrale o Spazio + trascina: sposta.',
  trackpad:
    '3D: due dita ruotano, Maiusc + due dita spostano. 2D: due dita spostano. Pizzico: zoom. Spazio + trascina sposta sempre.',
}

const OPTIONS = (Object.keys(NAVIGATION_DEVICE_LABELS) as NavigationDevice[]).map((value) => ({
  value,
  label: NAVIGATION_DEVICE_LABELS[value],
  title: HINTS[value],
}))

/** Mouse or trackpad: what two fingers on a trackpad do in the views. */
export function NavigationDeviceSetting() {
  const device = useNavigationDevice((s) => s.device)
  const trackpadSeen = useNavigationDevice((s) => s.trackpadSeen)
  useEffect(loadNavigationDevice, [])
  return (
    <div className="space-y-2 py-1">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">Navigazione</p>
        <p className="text-muted-foreground text-xs">
          {HINTS[device]}
          {device === 'auto' && trackpadSeen ? ' Trackpad riconosciuto.' : ''}
        </p>
      </div>
      <SegmentedControl
        aria-label="Navigazione"
        onChange={(value) => useNavigationDevice.getState().setDevice(value)}
        options={OPTIONS}
        value={device}
      />
    </div>
  )
}
