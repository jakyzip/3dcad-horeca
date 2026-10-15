'use client'

import {
  type AnyNode,
  type DeleteZonePayload,
  type StructureNodes,
  useScene,
} from '@pascal-app/core'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../../lib/utils'
import useDeleteConfirmation, {
  type DeleteConfirmationRequest,
  type RoomConstructionChange,
} from '../../store/use-delete-confirmation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/primitives/dialog'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Italian singular/plural of the hosted kinds `hostedKind` returns. */
const KIND_NOUNS: Record<string, [string, string]> = {
  door: ['porta', 'porte'],
  window: ['finestra', 'finestre'],
  light: ['luce', 'luci'],
  item: ['oggetto', 'oggetti'],
}

function sentenceList(parts: string[]) {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`
}

/** "lo"/"li" endings for the object pronoun attached to an infinitive. */
const objectPronoun = (one: boolean, feminine = false) =>
  feminine ? (one ? 'la' : 'le') : one ? 'lo' : 'li'

/**
 * A mezzanine takes its own plate (with its railing) and the ceiling core
 * derived over it; kept items come down to the floor below.
 */
function mezzanineDeletionDescription(room: DeleteZonePayload, nodes: StructureNodes) {
  const hasCeiling = Object.values(nodes).some(
    (node) => node.type === 'ceiling' && node.zoneId === room.zoneId,
  )
  const sentences = [
    hasCeiling
      ? 'Rimuove il soppalco, il suo parapetto e il soffitto sopra di esso.'
      : 'Rimuove il soppalco e il suo parapetto.',
  ]
  const items = room.itemIds.length
  if (items) {
    const pr = objectPronoun(items === 1)
    sentences.push(
      `${count(items, 'oggetto è', 'oggetti sono')} sul soppalco. Puoi tener${pr} al piano di sotto o eliminar${pr}.`,
    )
  }
  return sentences.join(' ')
}

/**
 * An area Divide made goes back into the room across its dividing line: the
 * line and the area's own finish go, the walls and anything standing in it stay.
 */
function mergeDescription(room: DeleteZonePayload, nodes: StructureNodes) {
  const into = nodes[room.mergedIntoZoneId ?? '']?.name?.trim()
  const lines = room.separatorIds.length === 1 ? 'la linea di divisione' : 'le linee di divisione'
  const sentences = [
    `Riunisce l'area ${into ? `a ${into}` : 'alla stanza accanto'}: rimuove ${lines} e la finitura del suo pavimento. I muri restano.`,
  ]
  const items = room.itemIds.length
  if (items)
    sentences.push(
      items === 1
        ? "1 oggetto all'interno resta dov'è."
        : `${items} oggetti all'interno restano dove sono.`,
    )
  return sentences.join(' ')
}

function roomDeletionDescription(room: DeleteZonePayload, nodes: StructureNodes) {
  if (isMezzanine(room, nodes)) return mezzanineDeletionDescription(room, nodes)
  if (room.mode === 'merge') return mergeDescription(room, nodes)
  const sentences: string[] = []
  const typeCount = (type: string) =>
    room.openingIds.filter((id) => nodes[id]?.type === type).length
  const removed = [
    room.wallIds.length ? count(room.wallIds.length, 'muro', 'muri') : '',
    room.separatorIds.length ? count(room.separatorIds.length, 'separatore', 'separatori') : '',
    typeCount('door') ? count(typeCount('door'), 'porta', 'porte') : '',
    typeCount('window') ? count(typeCount('window'), 'finestra', 'finestre') : '',
  ].filter(Boolean)
  sentences.push(
    removed.length
      ? `Rimuove ${sentenceList(removed)}, con la finitura del pavimento e il soffitto.`
      : 'Rimuove la finitura del pavimento e il soffitto.',
  )
  if (room.keptSharedWallIds.length + room.keptSharedSeparatorIds.length > 0)
    sentences.push('I muri in comune con altre stanze restano.')
  if (room.opensZoneIds.length) {
    const names = room.opensZoneIds.map((id) => nodes[id]?.name?.trim() || 'la stanza accanto')
    sentences.push(`Si apre su ${sentenceList(names)}.`)
  }
  const items = room.itemIds.length
  if (items) {
    const one = items === 1
    const pr = objectPronoun(one)
    sentences.push(
      `${count(items, 'oggetto è', 'oggetti sono')} all'interno. Puoi lasciar${pr} dove ${one ? 'si trova' : 'si trovano'} o eliminar${pr}.`,
    )
  }
  return sentences.join(' ')
}

/** A hosted node's kind from its type and structure — never from its name. */
function hostedKind(node: AnyNode | undefined) {
  if (node?.type === 'door' || node?.type === 'window') return node.type
  if (node?.type === 'item' && node.asset.interactive?.effects.some((e) => e.kind === 'light'))
    return 'light'
  return 'item'
}

function hostedName(node: AnyNode | undefined) {
  return (node?.name || (node?.type === 'item' ? node.asset.name : '') || '').trim()
}

function shownNames(names: string[]) {
  const named = [...new Set(names.filter(Boolean))]
  return named.slice(0, 3).join(', ') + (named.length > 3 ? ', …' : '')
}

/** "1 porta (Ingresso), 2 finestre e 1 luce": counts per kind, a few names, no ids. */
export function hostedSummary(ids: readonly string[], nodes: StructureNodes) {
  const groups = new Map<string, string[]>()
  for (const id of ids) {
    const kind = hostedKind(nodes[id])
    groups.set(kind, [...(groups.get(kind) ?? []), hostedName(nodes[id])])
  }
  return sentenceList(
    [...groups].map(([kind, names]) => {
      const shown = shownNames(names)
      const [one, many] = KIND_NOUNS[kind] ?? KIND_NOUNS.item!
      return `${count(names.length, one, many)}${shown ? ` (${shown})` : ''}`
    }),
  )
}

function ceilingContent(
  change: RoomConstructionChange,
  nodes: StructureNodes,
  room: string,
  canKeep: boolean,
): DeleteConfirmationContent {
  const ids = change.hostedIds
  const one = ids.length === 1
  const manual = change.manualCeilings ?? []
  const sentences: string[] = []
  if (manual.length) {
    const names = shownNames(manual)
    sentences.push(
      manual.length === 1
        ? `Rimuove il soffitto disegnato a mano${names ? ` (${names})` : ''}.`
        : `Rimuove ${manual.length} soffitti disegnati a mano${names ? ` (${names})` : ''}.`,
    )
    if (change.alsoCovers?.length)
      sentences.push(
        `${manual.length === 1 ? 'Copre' : 'Coprono'} anche ${sentenceList(change.alsoCovers)}.`,
      )
  }
  // Lights are known from their light effect; anything else reads as an item.
  const lights = ids.length > 0 && ids.every((id) => hostedKind(nodes[id]) === 'light')
  if (ids.length) {
    const names = shownNames(ids.map((id) => hostedName(nodes[id])))
    const pr = objectPronoun(one, lights)
    sentences.push(
      lights
        ? `${hostedSummary(ids, nodes)} ${one ? 'è appesa' : 'sono appese'} al soffitto.`
        : `${count(ids.length, 'oggetto è', 'oggetti sono')} sul soffitto${names ? ` (${names})` : ''}.`,
      `Puoi lasciar${pr} ${one ? "dov'è" : 'dove sono'} o eliminar${pr}.`,
    )
  }
  return {
    title: `Rimuovere il soffitto da ${room}?`,
    description: sentences.length ? sentences.join(' ') : 'Rimuove il soffitto.',
    keepLabel: ids.length && canKeep ? (lights ? 'Tieni le luci' : 'Tieni gli oggetti') : null,
    confirmLabel: ids.length ? 'Rimuovi tutto' : 'Rimuovi',
    destructive: true,
  }
}

function constructionContent(
  change: RoomConstructionChange,
  nodes: StructureNodes,
  canKeep: boolean,
): DeleteConfirmationContent {
  const room = change.roomName.trim() || 'questa stanza'
  const hosted = hostedSummary(change.hostedIds, nodes)
  const one = change.hostedIds.length === 1
  if (change.part === 'walls' && change.action === 'add') {
    return {
      title: `Aggiungere i muri a ${room}?`,
      description: `Aggiunge ${count(change.wallCount ?? 0, 'muro', 'muri')} · la stanza perde ${(change.areaLoss ?? 0).toFixed(2).replace('.', ',')} m² di pavimento.`,
      keepLabel: null,
      confirmLabel: 'Aggiungi i muri',
      destructive: false,
    }
  }
  if (change.part === 'walls') {
    const walls = count(change.wallCount ?? 0, 'muro', 'muri')
    return {
      title: `Rimuovere i muri da ${room}?`,
      description: [
        hosted
          ? `Trasforma ${walls} in separatori e rimuove ${hosted}.`
          : `Trasforma ${walls} in separatori.`,
        change.sharedWalls ? 'I muri in comune restano.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      keepLabel: null,
      confirmLabel: 'Rimuovi i muri',
      destructive: true,
    }
  }
  if (change.part === 'floor') {
    const pr = objectPronoun(one)
    return {
      title: `Rimuovere il pavimento da ${room}?`,
      description: hosted
        ? `${hosted} ${one ? 'poggia' : 'poggiano'} sul pavimento. Puoi lasciar${pr} alla stessa altezza o eliminar${pr}.`
        : 'Rimuove il pavimento.',
      keepLabel: hosted && canKeep ? 'Tieni gli oggetti' : null,
      confirmLabel: hosted ? 'Elimina gli oggetti' : 'Rimuovi',
      destructive: true,
    }
  }
  return ceilingContent(change, nodes, room, canKeep)
}

export type DeleteConfirmationContent = {
  title: string
  description: string
  /** Delete the room but leave its items in place — offered only when it has items. */
  keepLabel: string | null
  confirmLabel: string
  /** Red confirm for removals; adding walls confirms in the neutral style. */
  destructive: boolean
}

/** The words and choices the confirmation offers, from the request alone. */
function isMezzanine(room: DeleteZonePayload, nodes: StructureNodes) {
  const zone = nodes[room.zoneId]
  return zone?.type === 'zone' && zone.floor?.support === 'open'
}

export function deleteConfirmationContent(
  request: DeleteConfirmationRequest,
  nodes: StructureNodes,
): DeleteConfirmationContent {
  if (request.construction)
    return constructionContent(request.construction, nodes, !!request.onKeepContents)
  const room = request.room
  if (!room)
    return {
      title: `Eliminare ${count(request.count, 'elemento', 'elementi')}?`,
      description:
        "Elimina tutti gli elementi selezionati. Puoi annullare l'eliminazione finché resta nella cronologia dell'editor.",
      keepLabel: null,
      confirmLabel: 'Elimina',
      destructive: true,
    }
  const merge = room.mode === 'merge'
  // A merged area's items always stay, so there is nothing to choose.
  const hasItems = room.itemIds.length > 0 && !merge
  return {
    title: `Eliminare ${room.name.trim() || (isMezzanine(room, nodes) ? 'questo soppalco' : merge ? "quest'area" : 'questa stanza')}?`,
    description: roomDeletionDescription(room, nodes),
    keepLabel: hasItems && request.onKeepContents ? 'Tieni gli oggetti' : null,
    confirmLabel: hasItems ? 'Elimina tutto' : 'Elimina',
    destructive: true,
  }
}

export function DeleteConfirmationDialog() {
  const request = useDeleteConfirmation((state) => state.request)
  const cancel = useDeleteConfirmation((state) => state.cancel)
  const confirm = useDeleteConfirmation((state) => state.confirm)
  const nodes = useScene((state) => (request ? state.nodes : null))
  const live = useMemo(
    () => (request && nodes ? deleteConfirmationContent(request, nodes) : null),
    [request, nodes],
  )
  // Hold the last words through the close animation so the dialog never empties.
  const shown = useRef(live)
  if (live) shown.current = live
  const content = shown.current
  const blocked = !!request?.conflict

  useEffect(() => cancel, [cancel])

  return (
    <Dialog onOpenChange={(open) => !open && cancel()} open={request !== null}>
      <DialogContent
        className="border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-md"
        data-delete-confirmation-dialog
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{content?.title}</DialogTitle>
          <DialogDescription>
            {content?.description}
            {request?.conflict && (
              <span className="mt-2 block text-destructive">{request.conflict}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
            onClick={cancel}
            type="button"
          >
            Annulla
          </button>
          {content?.keepLabel && (
            <button
              className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              disabled={blocked}
              onClick={() => {
                const keep = request?.onKeepContents
                cancel()
                keep?.()
              }}
              type="button"
            >
              {content.keepLabel}
            </button>
          )}
          <button
            className={cn(
              'rounded-full px-4 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
              content?.destructive === false
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-red-600 text-white hover:bg-red-700',
            )}
            disabled={blocked}
            onClick={confirm}
            type="button"
          >
            {content?.confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
