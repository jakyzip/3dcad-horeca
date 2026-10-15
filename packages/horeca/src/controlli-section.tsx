'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import {
  controllaLivello,
  descriviProblema,
  readSoglie,
  type SogliePassaggi,
  withSoglie,
} from './controlli'
import { crmLinkHostId } from './crm-link'
import { EQUIPMENT_KINDS } from './definitions'
import { readProductRef } from './product'
import type { EquipmentNode } from './schema'

const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'
const INPUT =
  'h-7 w-16 rounded-md border border-border/60 bg-background px-1.5 text-right text-foreground text-xs outline-none focus:border-ring'
const ROW = 'w-full rounded px-2 py-1 text-left text-xs hover:bg-accent'

/** A width in cm, committed on blur or Enter; bad input puts the old value back. */
function CmBox({ value, onCommit }: { value: number; onCommit: (metres: number) => void }) {
  const [text, setText] = useState(String(Math.round(value * 100)))
  useEffect(() => setText(String(Math.round(value * 100))), [value])
  const commit = () => {
    const cm = Number(text.trim().replace(',', '.'))
    if (!Number.isFinite(cm) || cm < 30 || cm > 300) setText(String(Math.round(value * 100)))
    else if (Math.abs(cm / 100 - value) > 1e-9) onCommit(cm / 100)
  }
  return (
    <input
      className={INPUT}
      inputMode="numeric"
      onBlur={commit}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      value={text}
    />
  )
}

const nameOf = (nodes: Record<string, AnyNode>) => (id: string) => {
  const node = nodes[id] as unknown as EquipmentNode | undefined
  if (!node) return 'un’altra attrezzatura'
  const read = readProductRef(node.metadata)
  const article =
    read.kind === 'article' || read.kind === 'local' ? read.ref.name || read.ref.code : ''
  return article || node.name || 'un’attrezzatura'
}

/**
 * The level's layout problems (overlaps, units in walls, narrow aisles), with the project's
 * minimum widths. A click on a problem selects the unit.
 */
export function ControlliSection() {
  const nodes = useScene((s) => s.nodes) as Record<string, AnyNode>
  const levelId = useViewer((s) => s.selection.levelId)
  const hostId = useMemo(() => crmLinkHostId(nodes), [nodes])
  const host = hostId ? nodes[hostId] : undefined
  const soglie = readSoglie(host?.metadata)

  const problemi = useMemo(() => {
    const level = levelId ? (nodes[levelId] as unknown as { children?: string[] }) : undefined
    const equipment: EquipmentNode[] = []
    const walls: AnyNode[] = []
    for (const id of level?.children ?? []) {
      const child = nodes[id]
      if (!child || child.visible === false) continue
      if (child.type === 'wall') walls.push(child)
      else if (EQUIPMENT_KINDS.includes(child.type))
        equipment.push(child as unknown as EquipmentNode)
    }
    return controllaLivello(equipment, walls, soglie)
  }, [nodes, levelId, soglie])

  const save = (patch: Partial<SogliePassaggi>) => {
    if (!hostId) return
    useScene.getState().updateNode(hostId, {
      metadata: withSoglie(host?.metadata, { ...soglie, ...patch }),
    } as never)
  }
  const name = nameOf(nodes)

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Controlli</h3>
      <div className="flex flex-col gap-1 text-xs">
        <label className="flex items-center justify-between gap-2">
          <span>Passaggio minimo</span>
          <span className="flex items-center gap-1">
            <CmBox onCommit={(passaggio) => save({ passaggio })} value={soglie.passaggio} /> cm
          </span>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span title="Tra due attrezzature affacciate: si lavora dando le spalle all’altra">
            Zona di lavoro minima
          </span>
          <span className="flex items-center gap-1">
            <CmBox onCommit={(lavoro) => save({ lavoro })} value={soglie.lavoro} /> cm
          </span>
        </label>
      </div>
      {problemi.length === 0 ? (
        <p className="text-xs opacity-60">Nessun problema su questo piano.</p>
      ) : (
        <div className="flex max-h-48 flex-col overflow-y-auto">
          {problemi.map((p, i) => (
            <button
              className={ROW}
              key={i}
              onClick={() =>
                useViewer.getState().setSelection({ selectedIds: [p.id as AnyNodeId] })
              }
              type="button"
            >
              <span className="font-medium">{name(p.id)}</span>
              <span className="text-amber-500"> · {descriviProblema(p, name)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs opacity-60">
        Sono solo avvisi: in pianta il problema è segnato in rosso. Le misure valgono per questo
        progetto.
      </p>
    </section>
  )
}
