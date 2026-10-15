'use client'

import { useEffect, useState } from 'react'
import {
  type Allacciamento,
  allacciamentiTipici,
  hasTipici,
  LATI,
  LATO_LABEL,
  latoLength,
  prossimoAllacciamento,
  readAllacciamenti,
  TIPI_ALLACCIAMENTO,
  TIPO,
  type TipoAllacciamento,
  withAllacciamenti,
} from './allacciamenti'
import type { EquipmentNode } from './schema'

const INPUT =
  'h-7 w-full rounded-md border border-border/60 bg-background px-1.5 text-foreground text-xs outline-none focus:border-ring'
const BUTTON =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-foreground text-xs hover:bg-accent'

/** Typed with a comma or a point; empty or invalid keeps the old value. */
const parseNumber = (text: string): number | null => {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() && Number.isFinite(value) && value >= 0 ? value : null
}
const show = (value: number | undefined) =>
  value === undefined ? '' : String(Number(value.toFixed(3))).replace('.', ',')

/** A number box that commits on blur or Enter, in the unit shown beside it. */
function NumberBox({
  value,
  unit,
  scale = 1,
  onCommit,
}: {
  value: number | undefined
  unit: string
  scale?: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(show(value === undefined ? undefined : value * scale))
  useEffect(() => setText(show(value === undefined ? undefined : value * scale)), [value, scale])
  const commit = () => {
    const parsed = parseNumber(text)
    if (parsed === null) setText(show(value === undefined ? undefined : value * scale))
    else if (parsed / scale !== value) onCommit(parsed / scale)
  }
  return (
    <span className="flex items-center gap-1">
      <input
        className={INPUT}
        inputMode="decimal"
        onBlur={commit}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        value={text}
      />
      <span className="text-muted-foreground text-xs">{unit}</span>
    </span>
  )
}

/**
 * Inspector editor for the unit's connections: add by type, or start from the kind's usual set,
 * then set side, position, height and power. Every change is one undo step.
 */
export function AllacciamentiField({
  node,
  onUpdate,
}: {
  node: EquipmentNode
  onUpdate: (patch: Partial<EquipmentNode>) => void
}) {
  const list = readAllacciamenti(node.metadata)
  const save = (next: Allacciamento[]) =>
    onUpdate({ metadata: withAllacciamenti(node.metadata, next) })
  const change = (index: number, patch: Partial<Allacciamento>) =>
    save(list.map((a, i) => (i === index ? { ...a, ...patch } : a)))

  return (
    <div className="flex flex-col gap-2 text-xs">
      {list.length === 0 && (
        <p className="text-muted-foreground">
          Nessun attacco. Aggiungili per averli in pianta, nel DXF e nel totale delle potenze.
        </p>
      )}
      {list.map((a, index) => {
        const tipo = TIPO[a.tipo]
        return (
          <div className="flex flex-col gap-1.5 rounded-md border border-border/50 p-2" key={index}>
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1 font-mono font-semibold"
                style={{ color: tipo.colore, border: `1px solid ${tipo.colore}` }}
              >
                {tipo.sigla}
              </span>
              <select
                className={INPUT}
                onChange={(e) => {
                  const next = e.target.value as TipoAllacciamento
                  change(index, {
                    tipo: next,
                    potenza: TIPO[next].potenza ? (a.potenza ?? 0) : undefined,
                  })
                }}
                value={a.tipo}
              >
                {TIPI_ALLACCIAMENTO.map((t) => (
                  <option key={t} value={t}>
                    {TIPO[t].label}
                  </option>
                ))}
              </select>
              <button
                aria-label="Togli l’attacco"
                className="px-1 text-muted-foreground hover:text-destructive"
                onClick={() => save(list.filter((_, i) => i !== index))}
                title="Togli l’attacco"
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Lato</span>
                <select
                  className={INPUT}
                  onChange={(e) => change(index, { lato: e.target.value as Allacciamento['lato'] })}
                  value={a.lato}
                >
                  {LATI.map((l) => (
                    <option key={l} value={l}>
                      {LATO_LABEL[l]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span
                  className="text-muted-foreground"
                  title={
                    a.lato === 'retro' || a.lato === 'fronte'
                      ? 'Dal bordo sinistro, guardando l’attrezzatura da davanti'
                      : 'Dal bordo posteriore'
                  }
                >
                  {a.lato === 'retro' || a.lato === 'fronte' ? 'Da sinistra' : 'Dal retro'}
                </span>
                <NumberBox
                  onCommit={(m) =>
                    change(index, { distanza: Math.min(m, latoLength(node, a.lato)) })
                  }
                  scale={100}
                  unit="cm"
                  value={a.distanza}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Altezza da terra</span>
                <NumberBox
                  onCommit={(m) => change(index, { altezza: Math.min(m, 4) })}
                  scale={100}
                  unit="cm"
                  value={a.altezza}
                />
              </label>
              {tipo.potenza && (
                <label className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Potenza</span>
                  <NumberBox
                    onCommit={(v) => change(index, { potenza: v })}
                    unit="kW"
                    value={a.potenza}
                  />
                </label>
              )}
            </div>
            <label className="flex items-center gap-1.5">
              <input
                checked={a.quota}
                onChange={(e) => change(index, { quota: e.target.checked })}
                type="checkbox"
              />
              Quota in pianta (dai muri, con l’altezza)
            </label>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-1.5">
        <select
          className={`${BUTTON} w-auto`}
          onChange={(e) => {
            const tipo = e.target.value as TipoAllacciamento
            e.target.value = ''
            if (tipo) save([...list, prossimoAllacciamento(node, list, tipo)])
          }}
          value=""
        >
          <option value="">+ Aggiungi attacco…</option>
          {TIPI_ALLACCIAMENTO.map((t) => (
            <option key={t} value={t}>
              {TIPO[t].label}
            </option>
          ))}
        </select>
        {list.length === 0 && hasTipici(node.type) && (
          <button
            className={BUTTON}
            onClick={() => save(allacciamentiTipici(node.type, node.width))}
            title="Valori indicativi: controllali sulla scheda tecnica"
            type="button"
          >
            Attacchi tipici
          </button>
        )}
      </div>
    </div>
  )
}
