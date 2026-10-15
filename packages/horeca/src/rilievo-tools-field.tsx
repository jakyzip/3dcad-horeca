'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { useState } from 'react'
import { rilievoDimensionNodes, rilievoWallNodes } from './rilievo-actions'
import type { RilievoNode } from './rilievo-schema'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'

/** Inspector actions that turn the survey into editor objects. Each is one undo step. */
export function RilievoToolsField({ node }: { node: RilievoNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const levelId = node.parentId as AnyNodeId | null

  const createWalls = () => {
    if (!levelId) return
    const walls = rilievoWallNodes(node)
    if (walls.length === 0) {
      setMessage(
        'Nessun muro trovato: servono coppie di linee parallele a 5–60 cm l’una dall’altra sui layer accesi.',
      )
      return
    }
    useScene.getState().applyNodeChanges({
      create: walls.map((wall) => ({ node: wall as AnyNode, parentId: levelId })),
    })
    setMessage(
      `Creati ${walls.length} muri. Controllali: se qualcosa non va, annulla (Ctrl+Z), spegni i layer che non sono muri e riprova.`,
    )
  }

  const convertDimensions = () => {
    if (!levelId) return
    const dimensions = rilievoDimensionNodes(node)
    if (dimensions.length === 0) {
      setMessage('Nessuna quota sui layer accesi.')
      return
    }
    const shown = new Set(node.layers.filter((l) => l.visible).map((l) => l.name))
    useScene.getState().applyNodeChanges({
      create: dimensions.map((d) => ({ node: d as AnyNode, parentId: levelId })),
      // The survey stops drawing the ones it handed over, so they are not shown twice.
      update: [
        {
          id: node.id as AnyNodeId,
          data: { dimensions: node.dimensions.filter((d) => !shown.has(d.layer)) } as never,
        },
      ],
    })
    setMessage(`${dimensions.length} quote trasformate in quote dell’editor (annulla con Ctrl+Z).`)
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-muted-foreground">
        Prima accendi solo i layer che servono: per i muri, solo quelli dei muri (porte, finestre e
        arredi vanno spenti).
      </p>
      <button className={BUTTON} disabled={!levelId} onClick={createWalls} type="button">
        Crea muri dalle linee
      </button>
      <button
        className={BUTTON}
        disabled={!levelId || node.dimensions.length === 0}
        onClick={convertDimensions}
        type="button"
      >
        Trasforma le quote in quote dell’editor
      </button>
      {message && <p className="opacity-80">{message}</p>}
    </div>
  )
}
