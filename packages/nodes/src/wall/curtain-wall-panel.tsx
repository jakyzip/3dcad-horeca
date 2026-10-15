'use client'

import {
  type CurtainGrid,
  type CurtainPanelType,
  type CurtainWallConfig,
  getCurtainWallConfig,
  getEffectiveNode,
  getWallCurveLength,
  getWallThickness,
  type WallNode,
} from '@pascal-app/core'
import {
  getLinearUnitLabel,
  linearControlValueToMeters,
  metersToLinearUnit,
  PanelSection,
  SegmentedControl,
  SliderControl,
  ToggleControl,
} from '@pascal-app/editor'
import { useState } from 'react'
import { useCurtainPanelHighlight } from './curtain-panel-highlight'
import { curtainGridPositions, curtainPanelType } from './curtain-wall-layout'

type Props = {
  node: WallNode
  height: number
  unit: 'metric' | 'imperial'
  onUpdate: (patch: Partial<WallNode>) => void
  onPreview: (patch: Partial<WallNode>) => void
  onCommit: () => void
  onCancel: () => void
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        className="max-w-[160px] rounded-md border border-border bg-background px-2 py-1.5 text-foreground"
        onChange={(event) => {
          const option = options.find((entry) => entry.value === event.target.value)
          if (option) onChange(option.value)
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function LengthControl({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  onCommit,
  onCancel,
  profile = false,
}: {
  profile?: boolean
  label: string
  value: number
  min: number
  max: number
  unit: Props['unit']
  onChange: (value: number) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const millimeters = profile && unit === 'metric'
  const display = (meters: number) =>
    millimeters ? meters * 1000 : metersToLinearUnit(meters, unit)
  return (
    <SliderControl
      onCommit={onCommit}
      onCancel={onCancel}
      restoreOnCommit={false}
      previewWhileTyping
      label={label}
      max={display(max)}
      min={display(min)}
      onChange={(next) =>
        onChange(
          millimeters
            ? Math.max(min, Math.min(max, next / 1000))
            : linearControlValueToMeters(next, unit, { minMeters: min, maxMeters: max }),
        )
      }
      precision={millimeters ? 1 : 3}
      step={millimeters ? 1 : 0.005}
      unit={millimeters ? 'mm' : getLinearUnitLabel(unit)}
      value={display(value)}
    />
  )
}

function GridSection({
  length,
  vertical = false,
  onPreview,
  title,
  value,
  unit,
  onChange,
  onCommit,
  onCancel,
}: {
  length: number
  vertical?: boolean
  title: string
  value: CurtainGrid
  unit: Props['unit']
  onChange: (grid: CurtainGrid) => void
  onPreview: (grid: CurtainGrid) => void
  onCommit: () => void
  onCancel: () => void
}) {
  return (
    <PanelSection title={title}>
      <Choice
        label="Disposizione"
        onChange={(layout) => onChange({ ...value, layout })}
        options={[
          { label: 'Numero di pannelli', value: 'count' },
          { label: 'Interasse massimo', value: 'maximum-spacing' },
          { label: 'Interasse fisso', value: 'fixed-spacing' },
        ]}
        value={value.layout}
      />
      {value.layout === 'count' ? (
        <SliderControl
          onCommit={onCommit}
          onCancel={onCancel}
          restoreOnCommit={false}
          previewWhileTyping
          label="Pannelli"
          max={32}
          min={1}
          onChange={(count) => onPreview({ ...value, count: Math.round(count) })}
          precision={0}
          step={1}
          value={value.count}
        />
      ) : (
        <LengthControl
          onCommit={onCommit}
          onCancel={onCancel}
          label="Interasse"
          max={100}
          min={0.2}
          onChange={(spacing) => onPreview({ ...value, spacing })}
          unit={unit}
          value={value.spacing}
        />
      )}
      {value.layout === 'fixed-spacing' && (
        <SegmentedControl
          onChange={(alignment) => onChange({ ...value, alignment })}
          options={[
            { label: vertical ? 'In basso' : 'Inizio', value: 'start' },
            { label: 'Centro', value: 'center' },
            { label: vertical ? 'In alto' : 'Fine', value: 'end' },
          ]}
          value={value.alignment}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        {(() => {
          const positions = curtainGridPositions(length, value)
          const spans = positions.slice(1).map((position, i) => position - positions[i]!)
          if (!spans.length) return 'Nessun pannello'
          const min = metersToLinearUnit(Math.min(...spans), unit)
          const max = metersToLinearUnit(Math.max(...spans), unit)
          return `${spans.length} ${vertical ? 'righe' : 'colonne'} · interasse ${min.toFixed(2).replace('.', ',')}${max - min > 0.005 ? `–${max.toFixed(2).replace('.', ',')}` : ''} ${getLinearUnitLabel(unit)}`
        })()}
      </p>
    </PanelSection>
  )
}

const PANEL_OPTIONS = [
  { label: 'Vetro', value: 'glass' },
  { label: 'Pieno', value: 'solid' },
  { label: 'Vuoto', value: 'empty' },
] as const

export function getCurtainWallUpdate(
  node: WallNode,
  patch: Partial<CurtainWallConfig>,
): Pick<WallNode, 'curtainWall'> {
  return {
    curtainWall: { ...getCurtainWallConfig(getEffectiveNode(node)), ...patch },
  }
}

export function CurtainWallPanel({
  node,
  height,
  unit,
  onUpdate,
  onPreview,
  onCommit,
  onCancel,
}: Props) {
  const config = getCurtainWallConfig(node)
  const update = (patch: Partial<CurtainWallConfig>, preview = false) => {
    ;(preview ? onPreview : onUpdate)(getCurtainWallUpdate(node, patch))
  }

  const [tintEditing, setTintEditing] = useState(false)
  const [panelEditing, setPanelEditing] = useState(false)
  const [selectedColumn, setColumn] = useState(0)
  const [selectedRow, setRow] = useState(0)
  const columnCount = curtainGridPositions(getWallCurveLength(node), config.columns).length - 1
  const rowCount = curtainGridPositions(height, config.rows).length - 1
  const column = Math.max(0, Math.min(selectedColumn, columnCount - 1))
  const row = Math.max(0, Math.min(selectedRow, rowCount - 1))
  const selectedType = curtainPanelType(config, column, row, rowCount)
  const changePanel = (type?: CurtainPanelType) =>
    update({
      panels: [
        ...config.panels.filter((panel) => panel.column !== column || panel.row !== row),
        ...(type ? [{ column, row, type }] : []),
      ],
    })

  const hiddenOverrides = config.panels.filter(
    (panel) => panel.column >= columnCount || panel.row >= rowCount,
  )
  const diagramWidth = Math.max(240, columnCount * 32)
  const diagramHeight = Math.max(150, rowCount * 32)
  const overridden = config.panels.some((panel) => panel.column === column && panel.row === row)
  const xs = curtainGridPositions(getWallCurveLength(node), config.columns)
  const ys = curtainGridPositions(height, config.rows)
  useCurtainPanelHighlight(
    node,
    xs[column] ?? 0,
    xs[column + 1] ?? 0,
    ys[row] ?? 0,
    ys[row + 1] ?? 0,
    panelEditing,
  )
  const hasGlass = xs
    .slice(1)
    .some((_, c) =>
      ys.slice(1).some((_, r) => curtainPanelType(config, c, r, rowCount) === 'glass'),
    )
  const paintedGlass = Boolean(node.slots?.['curtain-glass'])
  const effectiveThickness = Math.min(config.glassThickness, getWallThickness(node) * 0.45)

  return (
    <>
      <PanelSection title="Sistema di facciata">
        <Choice
          label="Costruzione"
          onChange={(construction) => update({ construction })}
          options={[
            { label: 'A montanti e traversi', value: 'stick' },
            { label: 'A cellule', value: 'unitized' },
          ]}
          value={config.construction}
        />
        <Choice
          label="Telaio"
          onChange={(framing) => update({ framing })}
          options={[
            { label: 'Con coprifili ovunque', value: 'capped' },
            { label: 'Coprifili verticali', value: 'vertical-caps' },
            { label: 'Coprifili orizzontali', value: 'horizontal-caps' },
            { label: 'Vetro strutturale', value: 'structural-glazing' },
          ]}
          value={config.framing}
        />
        <p className="text-[11px] text-muted-foreground">
          {config.construction === 'unitized'
            ? 'Moduli con telaio separati, con giunti tra le cellule.'
            : 'Montanti e traversi continui montati lungo il muro.'}
        </p>
        {config.framing !== 'capped' && (
          <p className="text-[11px] text-muted-foreground">
            I profili senza coprifilo stanno dietro il vetro.
          </p>
        )}
      </PanelSection>
      <GridSection
        onChange={(columns) => update({ columns })}
        onPreview={(columns) => update({ columns }, true)}
        onCommit={onCommit}
        onCancel={onCancel}
        title="Disposizione delle colonne"
        length={getWallCurveLength(node)}
        unit={unit}
        value={config.columns}
      />
      <GridSection
        onChange={(rows) => update({ rows })}
        onPreview={(rows) => update({ rows }, true)}
        onCommit={onCommit}
        onCancel={onCancel}
        title="Disposizione delle righe"
        length={height}
        vertical
        unit={unit}
        value={config.rows}
      />
      {((getWallCurveLength(node) / config.columns.spacing > 32 &&
        config.columns.layout !== 'count') ||
        (height / config.rows.spacing > 32 && config.rows.layout !== 'count')) && (
        <p className="px-3 text-[11px] text-muted-foreground">
          Griglia limitata a 32 pannelli per asse. L’interasse si allarga per adattarsi al muro.
        </p>
      )}
      <PanelSection title="Dimensioni del telaio">
        <LengthControl
          profile
          onCommit={onCommit}
          onCancel={onCancel}
          label="Larghezza dei montanti"
          max={0.3}
          min={0.01}
          onChange={(mullionWidth) => update({ mullionWidth }, true)}
          unit={unit}
          value={config.mullionWidth}
        />
        <LengthControl
          profile
          onCommit={onCommit}
          onCancel={onCancel}
          label="Larghezza dei traversi"
          max={0.3}
          min={0.01}
          onChange={(transomWidth) => update({ transomWidth }, true)}
          unit={unit}
          value={config.transomWidth}
        />
        <LengthControl
          profile
          onCommit={onCommit}
          onCancel={onCancel}
          label="Telaio di bordo / apertura"
          max={0.3}
          min={0.01}
          onChange={(perimeterWidth) => update({ perimeterWidth }, true)}
          unit={unit}
          value={config.perimeterWidth}
        />
        {(config.construction === 'unitized' || config.framing !== 'capped') && (
          <LengthControl
            profile
            onCommit={onCommit}
            onCancel={onCancel}
            label={
              config.construction === 'unitized'
                ? 'Larghezza del giunto tra moduli'
                : 'Distacco del vetro'
            }
            max={0.05}
            min={0.002}
            onChange={(jointWidth) => update({ jointWidth }, true)}
            unit={unit}
            value={config.jointWidth}
          />
        )}
      </PanelSection>
      <PanelSection title="Tamponamento dei pannelli">
        <Choice
          label="Pannello predefinito"
          onChange={(panelType) => update({ panelType })}
          options={PANEL_OPTIONS}
          value={config.panelType}
        />
        <Choice
          label="Fascia opaca"
          onChange={(spandrel) => update({ spandrel })}
          options={[
            { label: 'Nessuna', value: 'none' },
            { label: 'Riga in basso', value: 'bottom' },
            { label: 'Riga in alto', value: 'top' },
          ]}
          value={config.spandrel}
        />
        <p className="text-[11px] text-muted-foreground">
          Le fasce opache sostituiscono un’intera riga con pannelli pieni. Applica la finitura con
          lo strumento Dipingi.
        </p>
        <LengthControl
          profile
          onCommit={onCommit}
          onCancel={onCancel}
          label="Spessore del pannello"
          max={0.08}
          min={0.004}
          onChange={(glassThickness) => update({ glassThickness }, true)}
          unit={unit}
          value={config.glassThickness}
        />
        {effectiveThickness < config.glassThickness - 1e-6 && (
          <p className="text-[11px] text-muted-foreground">
            Spessore effettivo:{' '}
            {unit === 'metric'
              ? `${(effectiveThickness * 1000).toFixed(1).replace('.', ',')} mm`
              : `${metersToLinearUnit(effectiveThickness, unit).toFixed(3).replace('.', ',')} ${getLinearUnitLabel(unit)}`}
            , limited by frame depth.
          </p>
        )}
      </PanelSection>
      <PanelSection title="Modifica i singoli pannelli">
        <ToggleControl
          checked={panelEditing}
          label="Attiva la modifica dei pannelli"
          onChange={setPanelEditing}
        />
        {panelEditing && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Scegli una cella o inserisci colonna e riga. Usa le frecce per spostarti tra le celle.
              Le colonne partono dall’inizio del muro; le righe si contano dal basso.
            </p>
            <div className="max-h-64 overflow-auto rounded border border-border">
              <svg
                viewBox={`0 0 ${diagramWidth} ${diagramHeight}`}
                style={{ width: diagramWidth, height: diagramHeight }}
                className="block"
                role="group"
                aria-label="Selezione dei pannelli della facciata continua"
              >
                {xs.slice(1).flatMap((_, c) =>
                  ys.slice(1).map((_, r) => {
                    const type = curtainPanelType(config, c, r, rowCount)
                    const selected = c === column && r === row
                    return (
                      <rect
                        key={`${c}-${r}`}
                        role="button"
                        tabIndex={selected ? 0 : -1}
                        aria-label={`Colonna ${c + 1}, riga ${r + 1}: ${PANEL_OPTIONS.find((option) => option.value === type)?.label ?? type}`}
                        aria-pressed={selected}
                        data-cell={`${c}-${r}`}
                        x={(c / columnCount) * diagramWidth}
                        y={diagramHeight - ((r + 1) / rowCount) * diagramHeight}
                        width={diagramWidth / columnCount}
                        height={diagramHeight / rowCount}
                        fill={
                          type === 'glass'
                            ? '#53788a'
                            : type === 'solid'
                              ? '#64748b'
                              : 'transparent'
                        }
                        stroke={selected ? '#fb923c' : '#94a3b8'}
                        strokeWidth={selected ? 3 : 1}
                        className="cursor-pointer focus:stroke-orange-400 focus:stroke-[3]"
                        onClick={() => {
                          setColumn(c)
                          setRow(r)
                        }}
                        onKeyDown={(event) => {
                          const arrows: Record<string, [number, number]> = {
                            ArrowLeft: [-1, 0],
                            ArrowRight: [1, 0],
                            ArrowUp: [0, 1],
                            ArrowDown: [0, -1],
                          }
                          const delta = arrows[event.key]
                          if (delta) {
                            event.preventDefault()
                            const nextColumn = Math.max(0, Math.min(columnCount - 1, c + delta[0]))
                            const nextRow = Math.max(0, Math.min(rowCount - 1, r + delta[1]))
                            setColumn(nextColumn)
                            setRow(nextRow)
                            const target =
                              event.currentTarget.parentElement?.querySelector<SVGRectElement>(
                                `[data-cell="${nextColumn}-${nextRow}"]`,
                              )
                            target?.focus()
                            target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                          }
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setColumn(c)
                            setRow(r)
                          }
                        }}
                      />
                    )
                  }),
                )}
              </svg>
            </div>
            {hiddenOverrides.length > 0 && (
              <div className="space-y-2 text-[11px] text-muted-foreground">
                <p>
                  {hiddenOverrides.length} custom panels are outside this grid. They return if the
                  grid expands.
                </p>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-xs"
                  onClick={() =>
                    update({
                      panels: config.panels.filter(
                        (panel) => panel.column < columnCount && panel.row < rowCount,
                      ),
                    })
                  }
                >
                  Elimina le modifiche nascoste
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Colonna {column + 1}, riga {row + 1} ·{' '}
              {overridden ? 'Tamponamento personalizzato' : 'Segue le impostazioni del muro'}
            </p>
            <SliderControl
              label="Colonna"
              max={Math.max(1, columnCount)}
              min={1}
              onChange={(value) => setColumn(Math.round(value) - 1)}
              precision={0}
              step={1}
              value={column + 1}
            />
            <SliderControl
              label="Riga"
              max={Math.max(1, rowCount)}
              min={1}
              onChange={(value) => setRow(Math.round(value) - 1)}
              precision={0}
              step={1}
              value={row + 1}
            />
            <Choice
              label="Tamponamento del pannello"
              onChange={changePanel}
              options={PANEL_OPTIONS}
              value={selectedType}
            />
            <button
              className="rounded border border-border px-2 py-1 text-xs disabled:cursor-default disabled:opacity-40"
              disabled={!overridden}
              onClick={() => changePanel()}
              type="button"
            >
              Ripristina questo pannello
            </button>
            <p className="text-[11px] text-muted-foreground">
              Usa lo strumento Porta o Finestra per aprire un’apertura nel muro.
            </p>
          </>
        )}
      </PanelSection>
      {hasGlass && (
        <PanelSection title="Aspetto del vetro">
          {paintedGlass && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>L’aspetto del vetro è gestito dallo strumento Dipingi.</p>
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => {
                  onCommit()
                  const slots = { ...node.slots }
                  delete slots['curtain-glass']
                  onUpdate({ slots })
                }}
              >
                Usa invece le impostazioni del vetro
              </button>
            </div>
          )}
          {!paintedGlass && (
            <div className="space-y-2">
              <SliderControl
                onCommit={onCommit}
                onCancel={onCancel}
                restoreOnCommit={false}
                previewWhileTyping
                label="Opacità"
                max={100}
                min={5}
                onChange={(value) => update({ glassOpacity: value / 100 }, true)}
                precision={0}
                step={5}
                unit="%"
                value={Math.round(config.glassOpacity * 100)}
              />
              <SliderControl
                onCommit={onCommit}
                onCancel={onCancel}
                restoreOnCommit={false}
                previewWhileTyping
                label="Ruvidità della superficie"
                max={1}
                min={0}
                onChange={(glassRoughness) => update({ glassRoughness }, true)}
                precision={2}
                step={0.05}
                value={config.glassRoughness}
              />
              <label className="flex items-center justify-between text-xs text-muted-foreground">
                Tinta del vetro
                <input
                  aria-label="Tinta del vetro"
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      onCancel()
                      setTintEditing(false)
                    }
                  }}
                  onChange={(event) => {
                    setTintEditing(true)
                    update({ glassColor: event.target.value }, true)
                  }}
                  onBlur={() => {
                    if (!tintEditing) return
                    onCommit()
                    setTintEditing(false)
                  }}
                  onInput={(event) => {
                    setTintEditing(true)
                    update({ glassColor: event.currentTarget.value }, true)
                  }}
                  type="color"
                  value={config.glassColor}
                />
              </label>
              {tintEditing && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs"
                    onClick={() => {
                      onCommit()
                      setTintEditing(false)
                    }}
                  >
                    Apply tint
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs"
                    onClick={() => {
                      onCancel()
                      setTintEditing(false)
                    }}
                  >
                    Cancel tint
                  </button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Low roughness is smooth; high roughness gives a matte surface in rendered shading.
              </p>
            </div>
          )}
        </PanelSection>
      )}
    </>
  )
}
