'use client'

import {
  type AnyNode,
  type AnyNodeId,
  type ConstructionDimensionDatumPolicy,
  type ConstructionDimensionDrawingPresentation,
  type ConstructionDimensionImperialPrecision,
  type ConstructionDimensionMetricNotation,
  type ConstructionDimensionNode,
  type ConstructionDimensionTerminator,
  type ConstructionDimensionTextPosition,
  type ConstructionDrawingType,
  resolveConstructionDimensionDrawingOverride,
  resolveConstructionDimensionDrawingPresentation,
  setConstructionDimensionDrawingPresentation,
  setConstructionDimensionDrawingSuppressedSegments,
  useScene,
} from '@pascal-app/core'
import {
  ActionButton,
  ActionGroup,
  DRAWING_TYPE_OPTIONS,
  PanelSection,
  PanelWrapper,
  SliderControl,
  triggerSFX,
  useDrawingView,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

const MODE_LABELS: Record<ConstructionDimensionNode['mode'], string> = {
  linear: 'Lineare',
  radius: 'Raggio',
  diameter: 'Diametro',
  'center-mark': 'Segno di centro',
  chord: 'Corda',
  'arc-length': 'Lunghezza d’arco',
  angular: 'Angolare',
  coordinate: 'Coordinata',
}

const DATUM_POLICY_OPTIONS: Array<{ label: string; value: ConstructionDimensionDatumPolicy }> = [
  { label: 'Asse', value: 'centerline' },
  { label: 'Faccia del muro', value: 'wall-face' },
  { label: 'Faccia strutturale', value: 'structural-face' },
  { label: 'Faccia finita', value: 'finish-face' },
]

const TERMINATOR_OPTIONS: Array<{ label: string; value: ConstructionDimensionTerminator }> = [
  { label: 'Trattino obliquo', value: 'architectural-tick' },
  { label: 'Freccia piena', value: 'filled-arrow' },
  { label: 'Freccia aperta', value: 'open-arrow' },
  { label: 'Punto', value: 'dot' },
]

const TEXT_POSITION_OPTIONS: Array<{ label: string; value: ConstructionDimensionTextPosition }> = [
  { label: 'Sopra la linea', value: 'above' },
  { label: 'Centrato sulla linea', value: 'centered' },
]

const IMPERIAL_PRECISION_OPTIONS: Array<{
  label: string
  value: ConstructionDimensionImperialPrecision
}> = [
  { label: 'Al pollice', value: '1' },
  { label: 'Al 1/2 pollice', value: '1/2' },
  { label: 'Al 1/4 di pollice', value: '1/4' },
  { label: 'All’1/8 di pollice', value: '1/8' },
  { label: 'All’1/16 di pollice', value: '1/16' },
]

const METRIC_NOTATION_OPTIONS: Array<{
  label: string
  value: ConstructionDimensionMetricNotation
}> = [
  { label: 'Metri', value: 'meters' },
  { label: 'Millimetri', value: 'millimeters' },
]

export default function ConstructionDimensionPanel() {
  const selectedId = useViewer((state) => state.selection.selectedIds[0])
  const setSelection = useViewer((state) => state.setSelection)
  const dimension = useScene((state) => {
    const node = selectedId ? state.nodes[selectedId as AnyNodeId] : undefined
    return node?.type === 'construction-dimension' ? node : null
  })
  const updateNode = useScene((state) => state.updateNode)
  const deleteNode = useScene((state) => state.deleteNode)
  const activeDrawingType = useDrawingView((state) => state.drawingType)

  if (!(dimension && selectedId)) return null
  const update = (patch: Partial<ConstructionDimensionNode>) => updateNode(dimension.id, patch)
  const supportsCenterMark = ['radius', 'diameter', 'arc-length', 'angular'].includes(
    dimension.mode,
  )
  const activeDrawingLabel =
    DRAWING_TYPE_OPTIONS.find((option) => option.id === activeDrawingType)?.label ?? 'Pianta'
  const activePresentation = resolveConstructionDimensionDrawingPresentation(
    dimension,
    activeDrawingType,
  )
  const activeDrawingOverride = resolveConstructionDimensionDrawingOverride(
    dimension,
    activeDrawingType,
  )
  const suppressedSegmentsText = formatSuppressedSegments(
    activeDrawingOverride?.suppressedSegmentIndexes ?? [],
  )
  const updateDrawingPresentation = (
    drawingType: ConstructionDrawingType,
    presentation: ConstructionDimensionDrawingPresentation,
  ) => {
    const drawingOverrides = setConstructionDimensionDrawingPresentation(
      dimension,
      drawingType,
      presentation,
    )
    const firstFoundationController =
      presentation === 'controlled' && !dimension.controllingDimensionId
        ? selectFoundationControllers(useScene.getState().nodes, dimension.id)[0]
        : undefined
    update({
      drawingOverrides,
      ...(presentation === 'controlled' && !dimension.controllingDimensionId
        ? { controllingDimensionId: firstFoundationController?.id ?? null }
        : {}),
    })
  }
  const updateSuppressedSegments = (value: string) => {
    update({
      drawingOverrides: setConstructionDimensionDrawingSuppressedSegments(
        dimension,
        activeDrawingType,
        parseSuppressedSegments(value),
      ),
    })
  }

  return (
    <PanelWrapper
      icon="/icons/blueprint.webp"
      onClose={() => setSelection({ selectedIds: [] })}
      title="Quota"
      width={320}
    >
      <PanelSection title="Quota">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Tipo</span>
          <span className="font-medium text-foreground">{MODE_LABELS[dimension.mode]}</span>
        </div>
        <SliderControl
          label="Numero di elementi"
          max={999}
          min={1}
          onChange={(featureCount) => update({ featureCount })}
          precision={0}
          step={1}
          value={dimension.featureCount}
        />
        {supportsCenterMark ? (
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Segno di centro</span>
            <input
              checked={dimension.showCenterMark}
              onChange={(event) => update({ showCenterMark: event.target.checked })}
              type="checkbox"
            />
          </label>
        ) : null}
      </PanelSection>

      <PanelSection title="Coordinamento delle tavole">
        <SelectField
          label="Tavola principale"
          onChange={(drawingType) =>
            update({ drawingType: drawingType as ConstructionDrawingType })
          }
          options={DRAWING_TYPE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.id,
          }))}
          value={dimension.drawingType}
        />
        <SelectField
          label={`Visualizzazione in ${activeDrawingLabel}`}
          onChange={(presentation) =>
            updateDrawingPresentation(
              activeDrawingType,
              presentation as ConstructionDimensionDrawingPresentation,
            )
          }
          options={[
            { label: 'Visibile', value: 'shown' },
            { label: 'Nascosta', value: 'omit' },
            ...(activeDrawingType === 'floor-plan'
              ? [{ label: 'Controllata dalle fondazioni', value: 'controlled' }]
              : []),
          ]}
          value={activePresentation}
        />
        {activeDrawingType === 'floor-plan' && activePresentation === 'controlled' ? (
          <FoundationControllerField
            dimensionId={dimension.id}
            onChange={(controllingDimensionId) =>
              update({
                controllingDimensionId,
              })
            }
            value={dimension.controllingDimensionId ?? ''}
          />
        ) : null}
        <p className="text-muted-foreground text-xs">
          Le quote collegate riusano i punti di aggancio della quota di controllo e si aggiornano
          con lei.
        </p>
        <TextField
          label={`Tratti nascosti in ${activeDrawingLabel}`}
          onCommit={updateSuppressedSegments}
          placeholder="es. 2, 4"
          value={suppressedSegmentsText}
        />
        <p className="text-muted-foreground text-xs">
          I tratti si contano da 1 e valgono solo in questa tavola.
        </p>
      </PanelSection>

      <PanelSection title="Notazione">
        <TextField
          label="Prefisso"
          onCommit={(prefix) => update({ prefix })}
          value={dimension.prefix}
        />
        <TextField
          label="Suffisso"
          onCommit={(suffix) => update({ suffix })}
          value={dimension.suffix}
        />
        <TextField
          label="Testo personalizzato"
          onCommit={(textOverride) => update({ textOverride: textOverride || null })}
          placeholder="Usa il valore misurato"
          value={dimension.textOverride ?? ''}
        />
      </PanelSection>

      <PanelSection title="Norme di disegno">
        <SelectField
          label="Riferimento di misura"
          onChange={(datumPolicy) =>
            update({ datumPolicy: datumPolicy as ConstructionDimensionDatumPolicy })
          }
          options={DATUM_POLICY_OPTIONS}
          value={dimension.datumPolicy}
        />
        <SelectField
          label="Terminazione"
          onChange={(terminator) =>
            update({ terminator: terminator as ConstructionDimensionTerminator })
          }
          options={TERMINATOR_OPTIONS}
          value={dimension.terminator}
        />
        <SelectField
          label="Posizione del testo"
          onChange={(textPosition) =>
            update({ textPosition: textPosition as ConstructionDimensionTextPosition })
          }
          options={TEXT_POSITION_OPTIONS}
          value={dimension.textPosition}
        />
        <SelectField
          label="Precisione in pollici"
          onChange={(imperialPrecision) =>
            update({
              imperialPrecision: imperialPrecision as ConstructionDimensionImperialPrecision,
            })
          }
          options={IMPERIAL_PRECISION_OPTIONS}
          value={dimension.imperialPrecision}
        />
        <SelectField
          label="Notazione metrica"
          onChange={(metricNotation) =>
            update({ metricNotation: metricNotation as ConstructionDimensionMetricNotation })
          }
          options={METRIC_NOTATION_OPTIONS}
          value={dimension.metricNotation}
        />
        <SliderControl
          label="Distacco della linea di riferimento"
          max={0.5}
          min={0}
          onChange={(extensionStartGap) => update({ extensionStartGap })}
          precision={3}
          step={0.005}
          value={dimension.extensionStartGap}
        />
        <SliderControl
          label="Sporgenza della linea di riferimento"
          max={0.5}
          min={0}
          onChange={(extensionOvershoot) => update({ extensionOvershoot })}
          precision={3}
          step={0.005}
          value={dimension.extensionOvershoot}
        />
      </PanelSection>

      <PanelSection title="Azioni">
        <ActionGroup>
          <ActionButton
            className="border-red-500/40 text-red-700 dark:text-red-200 hover:bg-red-500/15"
            icon={<Trash2 className="h-4 w-4" />}
            label="Elimina"
            onClick={() => {
              triggerSFX('sfx:structure-delete')
              deleteNode(dimension.id)
              setSelection({ selectedIds: [] })
            }}
          />
        </ActionGroup>
      </PanelSection>
    </PanelWrapper>
  )
}

function selectFoundationControllers(
  nodes: Record<string, AnyNode>,
  excludedId: AnyNodeId,
): ConstructionDimensionNode[] {
  return Object.values(nodes).filter(
    (candidate): candidate is ConstructionDimensionNode =>
      candidate.type === 'construction-dimension' &&
      candidate.id !== excludedId &&
      candidate.drawingType === 'foundation-plan',
  )
}

function FoundationControllerField({
  dimensionId,
  value,
  onChange,
}: {
  dimensionId: AnyNodeId
  value: string
  onChange: (value: NonNullable<ConstructionDimensionNode['controllingDimensionId']>) => void
}) {
  const foundationControllers = useScene(
    useShallow((state) => selectFoundationControllers(state.nodes, dimensionId)),
  )
  return (
    <SelectField
      disabled={foundationControllers.length === 0}
      label="Quota di controllo delle fondazioni"
      onChange={(controllingDimensionId) =>
        onChange(
          controllingDimensionId as NonNullable<
            ConstructionDimensionNode['controllingDimensionId']
          >,
        )
      }
      options={foundationControllers.map((controller) => ({
        label: controller.name || 'Quota delle fondazioni',
        value: controller.id,
      }))}
      placeholder="Nessuna quota delle fondazioni"
      value={value}
    />
  )
}

function parseSuppressedSegments(value: string): number[] {
  return [
    ...new Set(
      value
        .split(/[,\s]+/)
        .map((part) => Number.parseInt(part, 10))
        .filter((index) => Number.isInteger(index) && index > 0)
        .map((index) => index - 1),
    ),
  ].sort((left, right) => left - right)
}

function formatSuppressedSegments(indexes: readonly number[]): string {
  return indexes.map((index) => index + 1).join(', ')
}

function SelectField({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ label: string; value: string }>
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-foreground disabled:opacity-50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {placeholder && options.length === 0 ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string
  value: string
  placeholder?: string
  onCommit: (value: string) => void
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-foreground"
        defaultValue={value}
        key={value}
        onBlur={(event) => onCommit(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
