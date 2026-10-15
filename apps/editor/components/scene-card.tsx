'use client'

import { BookmarkMinus, BookmarkPlus, FilePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { asTemplateName, fromTemplateName, graphFromTemplate } from '@/lib/templates'
import { cn } from '@/lib/utils'
import { PRIMARY_PILL, ProductMark, SECONDARY_PILL } from './app-shell'

export interface SceneCardData {
  id: string
  name: string
  version: number
  nodeCount: number
  thumbnailUrl: string | null
  updatedAt: string
  updatedLabel: string
}

type Dialog = 'rename' | 'delete' | null

const MENU_ITEM =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-accent'

export function SceneCard({
  scene,
  template = false,
  nextNumber,
}: {
  scene: SceneCardData
  /** A project template ("Modello …"): offers a new project from it. */
  template?: boolean
  /** The number of the next "Progetto #n", for a project made from a template. */
  nextNumber: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const openDialog = (next: Dialog) => {
    setMenuOpen(false)
    setDialog(next)
  }

  /** Runs a menu action; failures show under the card. */
  const act = async (action: () => Promise<void>) => {
    setMenuOpen(false)
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  /** Mark or unmark as a template: a rename, with the usual version check. */
  const setTemplate = (on: boolean) =>
    act(async () => {
      const response = await fetch(`/api/scenes/${scene.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"${scene.version}"` },
        body: JSON.stringify({
          name: on ? asTemplateName(scene.name) : fromTemplateName(scene.name),
        }),
      })
      if (response.status === 409) throw new Error(CONFLICT_MESSAGE)
      if (!response.ok) throw new Error(`Impossibile rinominare (${response.status})`)
      router.refresh()
    })

  /** A new "Progetto #n" with a copy of this template, opened right away. */
  const newFromTemplate = () =>
    act(async () => {
      const source = await fetch(`/api/scenes/${scene.id}`)
      if (!source.ok) throw new Error(`Impossibile leggere il modello (${source.status})`)
      const { graph } = (await source.json()) as { graph: Parameters<typeof graphFromTemplate>[0] }
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Progetto #${nextNumber}`, graph: graphFromTemplate(graph) }),
      })
      if (!response.ok) throw new Error(`Impossibile creare il progetto (${response.status})`)
      const meta = (await response.json()) as { id: string }
      router.push(`/project/${meta.id}`)
    })

  return (
    <li className="group">
      <div className="relative">
        <Link
          className="block rounded-xl border border-border/50 bg-background p-2 transition-colors hover:border-border hover:bg-accent"
          href={`/project/${scene.id}`}
        >
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-accent">
            {scene.thumbnailUrl && !thumbnailFailed ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                onError={() => setThumbnailFailed(true)}
                // A load that failed before hydration never reaches `onError`.
                ref={(img) => {
                  if (img?.complete && img.naturalWidth === 0) setThumbnailFailed(true)
                }}
                src={scene.thumbnailUrl}
              />
            ) : (
              <ProductMark className="h-8 w-8 opacity-15" />
            )}
          </div>
          <div className="px-1.5 pt-2.5 pb-1">
            <h2 className="truncate pr-8 font-medium text-sm">{scene.name}</h2>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {scene.nodeCount} {scene.nodeCount === 1 ? 'elemento' : 'elementi'} · Modificato il{' '}
              <time dateTime={scene.updatedAt}>{scene.updatedLabel}</time>
            </p>
          </div>
        </Link>

        <div className="absolute right-3 bottom-3" ref={menuRef}>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Azioni per ${scene.name}`}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
              menuOpen && 'bg-background text-foreground',
            )}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 bottom-9 z-10 min-w-36 rounded-xl border border-border bg-popover p-1 text-sm shadow-2xl"
              role="menu"
            >
              {template && (
                <button
                  className={MENU_ITEM}
                  onClick={newFromTemplate}
                  role="menuitem"
                  type="button"
                >
                  <FilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                  Nuovo progetto da questo modello
                </button>
              )}
              <button
                className={MENU_ITEM}
                onClick={() => setTemplate(!template)}
                role="menuitem"
                type="button"
              >
                {template ? (
                  <BookmarkMinus className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {template ? 'Togli dai modelli' : 'Usa come modello'}
              </button>
              <button
                className={MENU_ITEM}
                onClick={() => openDialog('rename')}
                role="menuitem"
                type="button"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Rinomina
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-destructive hover:bg-destructive/10"
                onClick={() => openDialog('delete')}
                role="menuitem"
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Elimina
              </button>
            </div>
          )}
        </div>
      </div>
      {template && (
        <button
          className="mt-2 w-full rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          disabled={busy}
          onClick={newFromTemplate}
          type="button"
        >
          {busy ? 'Creazione…' : 'Nuovo progetto da questo modello'}
        </button>
      )}
      {actionError && <p className="mt-1 text-destructive text-xs">{actionError}</p>}
      {dialog === 'rename' && <RenameDialog onClose={() => setDialog(null)} scene={scene} />}
      {dialog === 'delete' && <DeleteDialog onClose={() => setDialog(null)} scene={scene} />}
    </li>
  )
}

const CONFLICT_MESSAGE =
  'Il progetto è cambiato dopo il caricamento della pagina. Ricarica e riprova.'

/** Opens a native modal dialog on mount; Escape, backdrop and Cancel all end in `onClose`. */
function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => onCloseRef.current()
    dialog.addEventListener('close', handleClose)
    if (!dialog.open) dialog.showModal()
    return () => dialog.removeEventListener('close', handleClose)
  }, [])
  return ref
}

function ModalFrame({
  children,
  dialogRef,
  title,
}: {
  children: React.ReactNode
  dialogRef: React.RefObject<HTMLDialogElement | null>
  title: string
}) {
  return (
    <dialog
      className="m-auto w-full max-w-sm rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl backdrop:bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
      ref={dialogRef}
    >
      <h2 className="font-semibold text-base">{title}</h2>
      {children}
    </dialog>
  )
}

function RenameDialog({ scene, onClose }: { scene: SceneCardData; onClose: () => void }) {
  const router = useRouter()
  const dialogRef = useModal(onClose)
  const [name, setName] = useState(scene.name)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === scene.name) {
      dialogRef.current?.close()
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/scenes/${scene.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': `"${scene.version}"` },
        body: JSON.stringify({ name: trimmed }),
      })
      if (response.status === 409) {
        setError(CONFLICT_MESSAGE)
        return
      }
      if (!response.ok) {
        setError(`Impossibile rinominare (${response.status})`)
        return
      }
      dialogRef.current?.close()
      router.refresh()
    } catch {
      setError("Impossibile raggiungere l'editor.")
    } finally {
      setPending(false)
    }
  }

  return (
    <ModalFrame dialogRef={dialogRef} title="Rinomina progetto">
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          aria-label="Nome del progetto"
          // biome-ignore lint/a11y/noAutofocus: the dialog exists to edit this field
          autoFocus
          className="rounded-lg border border-input bg-accent px-3 py-2 text-sm outline-none focus:border-ring"
          maxLength={200}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          required
          value={name}
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button
            className={SECONDARY_PILL}
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Annulla
          </button>
          <button className={PRIMARY_PILL} disabled={pending || !name.trim()} type="submit">
            {pending ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}

function DeleteDialog({ scene, onClose }: { scene: SceneCardData; onClose: () => void }) {
  const router = useRouter()
  const dialogRef = useModal(onClose)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/scenes/${scene.id}`, {
        method: 'DELETE',
        headers: { 'If-Match': `"${scene.version}"` },
      })
      if (response.status === 409) {
        setError(CONFLICT_MESSAGE)
        return
      }
      if (!response.ok && response.status !== 404) {
        setError(`Impossibile eliminare (${response.status})`)
        return
      }
      dialogRef.current?.close()
      router.refresh()
    } catch {
      setError("Impossibile raggiungere l'editor.")
    } finally {
      setPending(false)
    }
  }

  return (
    <ModalFrame dialogRef={dialogRef} title="Eliminare il progetto?">
      <p className="mt-2 text-muted-foreground text-sm">
        “{scene.name}” verrà rimosso da questo editor insieme a tutto il suo contenuto.
      </p>
      {error && <p className="mt-3 text-destructive text-xs">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className={SECONDARY_PILL} onClick={() => dialogRef.current?.close()} type="button">
          Annulla
        </button>
        <button
          className="inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
          disabled={pending}
          onClick={handleDelete}
          type="button"
        >
          {pending ? 'Eliminazione…' : 'Elimina'}
        </button>
      </div>
    </ModalFrame>
  )
}
