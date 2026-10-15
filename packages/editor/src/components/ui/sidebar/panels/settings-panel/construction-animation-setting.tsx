'use client'

import type { ConstructionRevealLevel } from '@pascal-app/viewer'
import useConstructionReveal from '../../../../../store/use-construction-reveal'
import { SegmentedControl } from '../../../controls/segmented-control'

const OPTIONS: { label: string; value: ConstructionRevealLevel; title: string }[] = [
  { label: 'Disattivo', value: 'off', title: "Ciò che costruisce l'AI compare subito." },
  {
    label: 'Semplice',
    value: 'simple',
    title: 'I muri salgono e il resto compare pezzo per pezzo, senza cadute, polvere o suoni.',
  },
  {
    label: 'Completa',
    value: 'full',
    title: 'I pezzi cadono al loro posto con la polvere, il tetto si monta, un suono per fase.',
  },
  {
    label: 'Ossatura',
    value: 'framing',
    title: "Come Completa, ma prima cadono gli elementi dell'ossatura, dove il plugin dell'ossatura li disegna.",
  },
]

/** How much of an AI build plays as a construction. */
export function ConstructionAnimationSetting() {
  const level = useConstructionReveal((state) => state.level)
  const setLevel = useConstructionReveal((state) => state.setLevel)
  const current = OPTIONS.find((option) => option.value === level)
  return (
    <div className="space-y-2 py-1">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">Animazione di costruzione</p>
        <p className="text-muted-foreground text-xs">{current?.title}</p>
      </div>
      <SegmentedControl
        aria-label="Animazione di costruzione"
        onChange={setLevel}
        options={OPTIONS}
        value={level}
      />
    </div>
  )
}
