'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useMemo } from 'react'
import {
  readAllacciamenti,
  riepilogoImpianti,
  TIPI_ALLACCIAMENTO,
  TIPO,
  withAllacciamenti,
} from './allacciamenti'
import { EQUIPMENT_KINDS } from './definitions'

const BUTTON =
  'h-8 rounded-md border border-border/60 bg-background px-3 text-foreground text-xs hover:bg-accent disabled:opacity-50'
const HEADING = 'font-medium text-xs uppercase tracking-wide opacity-60'

const kw = (value: number) => `${value.toFixed(2).replace('.', ',')} kW`

/** The project's connections at a glance: counts per type and the power to provide. */
export function ImpiantiSection() {
  const nodes = useScene((s) => s.nodes)
  const equipment = useMemo(
    () =>
      Object.values(nodes).filter((n) => EQUIPMENT_KINDS.includes(n.type)) as unknown as Array<{
        id: string
        metadata?: Record<string, unknown>
      }>,
    [nodes],
  )
  const riepilogo = useMemo(() => riepilogoImpianti(equipment), [equipment])
  const totale = TIPI_ALLACCIAMENTO.reduce((sum, t) => sum + riepilogo.conteggi[t], 0)

  /** Dimension every connection in the plan, or none: one undo step. */
  const setQuote = (quota: boolean) => {
    const update = equipment
      .map((n) => {
        const list = readAllacciamenti(n.metadata)
        if (!list.some((a) => a.quota !== quota)) return null
        return {
          id: n.id as AnyNodeId,
          data: {
            metadata: withAllacciamenti(
              n.metadata,
              list.map((a) => ({ ...a, quota })),
            ),
          },
        }
      })
      .filter((u) => u !== null)
    if (update.length) useScene.getState().applyNodeChanges({ update: update as never })
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className={HEADING}>Impianti</h3>
      {totale === 0 ? (
        <p className="text-xs opacity-60">
          Nessun allacciamento. Seleziona un’attrezzatura e aggiungi gli attacchi nella sezione
          “Allacciamenti” delle sue proprietà.
        </p>
      ) : (
        <>
          <table className="w-full text-xs">
            <tbody>
              {TIPI_ALLACCIAMENTO.filter((t) => riepilogo.conteggi[t] > 0).map((t) => (
                <tr key={t}>
                  <td className="py-0.5">
                    <span className="font-mono font-semibold" style={{ color: TIPO[t].colore }}>
                      {TIPO[t].sigla}
                    </span>{' '}
                    {TIPO[t].label}
                  </td>
                  <td className="py-0.5 text-right">
                    {riepilogo.conteggi[t] === 1
                      ? '1 attacco'
                      : `${riepilogo.conteggi[t]} attacchi`}
                  </td>
                  <td className="py-0.5 text-right font-mono">
                    {t === 'elettrico-230' || t === 'elettrico-400' || t === 'gas'
                      ? kw(riepilogo.potenze[t])
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(riepilogo.potenze['elettrico-230'] > 0 || riepilogo.potenze['elettrico-400'] > 0) && (
            <p className="text-xs">
              Potenza elettrica totale:{' '}
              <strong>
                {kw(riepilogo.potenze['elettrico-230'] + riepilogo.potenze['elettrico-400'])}
              </strong>{' '}
              <span className="opacity-60">(somma delle potenze, senza contemporaneità)</span>
            </p>
          )}
          {riepilogo.senzaPotenza > 0 && (
            <p className="text-amber-500 text-xs">
              {riepilogo.senzaPotenza === 1
                ? '1 attacco elettrico o gas non ha la potenza: non è nel totale.'
                : `${riepilogo.senzaPotenza} attacchi elettrici o gas non hanno la potenza: non sono nel totale.`}
            </p>
          )}
          <div className="flex gap-2">
            <button className={BUTTON} onClick={() => setQuote(true)} type="button">
              Quota tutti
            </button>
            <button className={BUTTON} onClick={() => setQuote(false)} type="button">
              Togli le quote
            </button>
          </div>
        </>
      )}
    </section>
  )
}
