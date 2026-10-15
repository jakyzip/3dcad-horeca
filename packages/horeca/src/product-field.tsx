'use client'

import { useEffect, useState } from 'react'
import { PRODUCT_METADATA_KEY, readProductRef } from './product'
import type { EquipmentNode } from './schema'

type Draft = { item_id: string; code: string; name: string }

const FIELDS: ReadonlyArray<{ key: keyof Draft; label: string; placeholder: string }> = [
  { key: 'code', label: 'Codice', placeholder: 'BF-150' },
  { key: 'name', label: 'Articolo', placeholder: 'Banco frigo 150 cm' },
  { key: 'item_id', label: 'ID CRM', placeholder: 'uuid dal catalogo del CRM' },
]

function draftOf(metadata: Record<string, unknown> | undefined): Draft {
  const raw = metadata?.[PRODUCT_METADATA_KEY]
  if (!raw || typeof raw !== 'object') return { item_id: '', code: '', name: '' }
  const value = raw as Partial<Record<keyof Draft, unknown>>
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  return { item_id: text(value.item_id), code: text(value.code), name: text(value.name) }
}

/**
 * Inspector editor for the node's catalog article. Edits commit on blur, one undo step each.
 * Until the catalog (phase 2) fills these in, they are typed by hand.
 */
export function ProductField({
  node,
  onUpdate,
}: {
  node: EquipmentNode
  onUpdate: (patch: Partial<EquipmentNode>) => void
}) {
  const [draft, setDraft] = useState(() => draftOf(node.metadata))
  useEffect(() => setDraft(draftOf(node.metadata)), [node.metadata])

  const commit = () => {
    const saved = draftOf(node.metadata)
    if (FIELDS.every(({ key }) => saved[key] === draft[key])) return
    const metadata = { ...node.metadata }
    if (!draft.item_id && !draft.code && !draft.name) delete metadata[PRODUCT_METADATA_KEY]
    else metadata[PRODUCT_METADATA_KEY] = { ...draft }
    onUpdate({ metadata })
  }

  const read = readProductRef(node.metadata)
  const status =
    read.kind === 'article'
      ? 'Conteggiato nella distinta.'
      : read.kind === 'invalid'
        ? 'ID CRM non valido: serve l’uuid dell’articolo. Non è conteggiato.'
        : 'Nessun articolo: non entra nella distinta.'

  return (
    <div className="flex flex-col gap-2">
      {FIELDS.map(({ key, label, placeholder }) => (
        <label className="flex flex-col gap-1 text-xs" key={key}>
          <span className="text-muted-foreground">{label}</span>
          <input
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-foreground text-sm outline-none focus:border-ring"
            onBlur={commit}
            onChange={(event) => setDraft((d) => ({ ...d, [key]: event.target.value }))}
            onKeyDown={(event) => {
              // Keep editor shortcuts (delete, rotate…) off while typing; Enter commits.
              event.stopPropagation()
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            placeholder={placeholder}
            spellCheck={false}
            value={draft[key]}
          />
        </label>
      ))}
      <p
        className={
          read.kind === 'invalid' ? 'text-amber-500 text-xs' : 'text-muted-foreground text-xs'
        }
      >
        {status}
      </p>
    </div>
  )
}
