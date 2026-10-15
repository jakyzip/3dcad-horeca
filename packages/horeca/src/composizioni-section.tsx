'use client'

import { type AnyNode, type AnyNodeId, nodeRegistry, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { type ChangeEvent, useRef, useState } from 'react'
import {
  type Composizione,
  composizioneDa,
  composizioniFromFile,
  composizioniToFile,
  elementiIn,
} from './composizioni'
import { useHorecaComposizioni } from './composizioni-store'
import { EQUIPMENT_KINDS } from './definitions'
import type { EquipmentNode } from './schema'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const INPUT =
  'h-8 w-full rounded-md border border-border/60 bg-background px-2 text-foreground text-xs outline-none focus:border-ring'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'

type Message = { text: string; error: boolean }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The middle of the level's walls, else the plan origin: where an inserted group lands. */
function levelCentre(nodes: Record<string, AnyNode>, levelId: string): [number, number] {
  const ids = (nodes[levelId] as unknown as { children?: string[] } | undefined)?.children ?? []
  const points = ids
    .map((id) => nodes[id] as unknown as { type: string; start?: number[]; end?: number[] })
    .filter((n) => n?.type === 'wall' && n.start && n.end)
    .flatMap((w) => [w.start!, w.end!])
  if (!points.length) return [0, 0]
  const xs = points.map((p) => p[0]!)
  const zs = points.map((p) => p[1]!)
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Save the selected equipment as a composition; insert, share and delete the saved ones. */
export function ComposizioniSection() {
  const composizioni = useHorecaComposizioni((s) => s.composizioni)
  const selectedIds = useViewer((s) => s.selection.selectedIds) as string[]
  const levelId = useViewer((s) => s.selection.levelId)
  const nodes = useScene((s) => s.nodes) as Record<string, AnyNode>
  const [nome, setNome] = useState('')
  const [message, setMessage] = useState<Message | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const selected = selectedIds
    .map((id) => nodes[id])
    .filter(
      (n): n is AnyNode => !!n && EQUIPMENT_KINDS.includes(n.type),
    ) as unknown as EquipmentNode[]

  const save = () => {
    const composizione = composizioneDa(selected, nome)
    if (!composizione) return
    useHorecaComposizioni.getState().aggiungi([composizione])
    setNome('')
    setMessage({
      text: `Salvata “${composizione.nome}”: ${plural(composizione.elementi.length, 'attrezzatura', 'attrezzature')}.`,
      error: false,
    })
  }

  const insert = (composizione: Composizione) => {
    if (!levelId) return
    const created: AnyNode[] = []
    let skipped = 0
    for (const data of elementiIn(composizione, levelCentre(nodes, levelId))) {
      const schema = nodeRegistry.get(data.type)?.schema
      const parsed = schema?.safeParse({
        ...data,
        parentId: levelId,
        object: 'node',
        visible: true,
      })
      if (parsed?.success) created.push(parsed.data as AnyNode)
      else skipped += 1
    }
    if (!created.length) {
      setMessage({ text: 'Nessuna attrezzatura inseribile in questa composizione.', error: true })
      return
    }
    useScene.getState().applyNodeChanges({
      create: created.map((node) => ({ node, parentId: levelId as AnyNodeId })),
    })
    useViewer.getState().setSelection({ selectedIds: created.map((n) => n.id as AnyNodeId) })
    setMessage({
      text: `Inserita “${composizione.nome}” al centro della stanza: è selezionata, spostala con Sposta.${
        skipped
          ? ` ${plural(skipped, 'elemento non valido è stato saltato', 'elementi non validi sono stati saltati')}.`
          : ''
      }`,
      error: skipped > 0,
    })
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const { composizioni: list, scartate } = composizioniFromFile(await file.text())
      useHorecaComposizioni.getState().aggiungi(list)
      setMessage({
        text: `Importate ${plural(list.length, 'composizione', 'composizioni')}.${
          scartate
            ? ` ${plural(scartate, 'non valida è stata scartata', 'non valide sono state scartate')}.`
            : ''
        }`,
        error: scartate > 0,
      })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Composizioni</h3>
      {selected.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs opacity-70">
            {plural(selected.length, 'attrezzatura selezionata', 'attrezzature selezionate')}:
            salvale come composizione per riusarle.
          </p>
          <div className="flex gap-1.5">
            <input
              className={INPUT}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') save()
              }}
              placeholder="Nome, es. Zona lavaggio"
              value={nome}
            />
            <button className={BUTTON} disabled={!nome.trim()} onClick={save} type="button">
              Salva
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs opacity-60">
          Seleziona alcune attrezzature (Maiusc + clic) per salvarle come composizione.
        </p>
      )}
      {composizioni.length > 0 && (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {composizioni.map((c) => (
            <div className="flex items-center gap-1.5 text-xs" key={c.id}>
              <span
                className="min-w-0 flex-1 truncate"
                title={c.elementi.map((e) => e.name ?? e.type).join(', ')}
              >
                {c.nome} <span className="opacity-60">· {c.elementi.length}</span>
              </span>
              {toDelete === c.id ? (
                <>
                  <button
                    className={BUTTON}
                    onClick={() => {
                      useHorecaComposizioni.getState().elimina(c.id)
                      setToDelete(null)
                    }}
                    type="button"
                  >
                    Elimina
                  </button>
                  <button className={BUTTON} onClick={() => setToDelete(null)} type="button">
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={BUTTON}
                    disabled={!levelId}
                    onClick={() => insert(c)}
                    type="button"
                  >
                    Inserisci
                  </button>
                  <button
                    aria-label={`Elimina ${c.nome}`}
                    className="px-1 text-muted-foreground hover:text-destructive"
                    onClick={() => setToDelete(c.id)}
                    title="Elimina la composizione"
                    type="button"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          className={BUTTON}
          disabled={!composizioni.length}
          onClick={() => download('composizioni.json', composizioniToFile(composizioni))}
          type="button"
        >
          Esporta
        </button>
        <button className={BUTTON} onClick={() => fileInput.current?.click()} type="button">
          Importa
        </button>
        <input
          accept=".json,application/json"
          className="hidden"
          onChange={importFile}
          ref={fileInput}
          type="file"
        />
      </div>
      {message && (
        <p className={`text-xs ${message.error ? 'text-amber-500' : 'opacity-80'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
