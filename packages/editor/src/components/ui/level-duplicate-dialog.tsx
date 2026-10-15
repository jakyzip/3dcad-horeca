'use client'

import type { LevelNode } from '@pascal-app/core'
import { useEffect, useState } from 'react'
import type { LevelDuplicatePreset } from '@pascal-app/core/building'
import { getLevelDisplayName } from '@pascal-app/core'
import { cn } from '../../lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './primitives/dialog'

const DUPLICATE_PRESETS: Array<{
  id: LevelDuplicatePreset
  label: string
  description: string
}> = [
  {
    id: 'everything',
    label: 'Tutto',
    description: 'Struttura, materiali, arredi e riferimenti.',
  },
  {
    id: 'structure',
    label: 'Solo struttura',
    description: 'Muri, solai, tetti, scale, finestre e porte senza finiture.',
  },
  {
    id: 'structure-materials',
    label: 'Struttura + materiali',
    description: 'Struttura con i materiali e le finiture assegnati ora.',
  },
  {
    id: 'structure-furniture',
    label: 'Struttura + arredi',
    description: 'Struttura, finiture e oggetti posizionati, senza immagini di riferimento.',
  },
]

function getLevelLabel(level: LevelNode | null) {
  if (!level) return 'questo piano'
  return getLevelDisplayName(level)
}

export function LevelDuplicateDialog({
  open,
  level,
  onConfirm,
  onOpenChange,
}: {
  open: boolean
  level: LevelNode | null
  onConfirm: (preset: LevelDuplicatePreset) => void
  onOpenChange: (open: boolean) => void
}) {
  const [preset, setPreset] = useState<LevelDuplicatePreset>('everything')

  useEffect(() => {
    if (open) {
      setPreset('everything')
    }
  }, [open])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Duplica piano</DialogTitle>
          <DialogDescription>Scegli cosa copiare da {getLevelLabel(level)}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {DUPLICATE_PRESETS.map((option) => (
            <button
              className={cn(
                'cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors',
                preset === option.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background hover:bg-accent/40',
              )}
              key={option.id}
              onClick={() => setPreset(option.id)}
              type="button"
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="mt-1 text-muted-foreground text-xs">{option.description}</div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <button
            className="cursor-pointer rounded-md px-4 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Annulla
          </button>
          <button
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-opacity hover:opacity-90"
            onClick={() => onConfirm(preset)}
            type="button"
          >
            Duplica
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
