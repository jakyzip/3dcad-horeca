import type { ToolOption } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { reducerOutletDiameter } from './reducer-size'

const label = (value: string) =>
  (
    ({
      round: 'Tondo',
      rect: 'Rettangolare',
      oval: 'Ovale',
      elbow: 'Curva',
      tee: 'Raccordo a T',
      cross: 'Raccordo a croce',
      reducer: 'Riduzione',
      transition: 'Transizione',
      'end-cap': 'Tappo',
      damper: 'Serranda di taratura',
      'access-panel': 'Portello d’ispezione',
      wye: 'Braga a 45°',
      'sanitary-tee': 'Braga a 87°',
      cleanout: 'Tappo d’ispezione',
      coupling: 'Manicotto',
      end: 'In fondo',
      inline: 'In linea',
      diameter: 'Diametro',
      width: 'Larghezza',
      height: 'Altezza',
      pvc: 'PVC',
      abs: 'ABS',
      'cast-iron': 'Ghisa',
    }) as Record<string, string>
  )[value] ?? value.replace('.', ',')
function option(
  kind: 'duct-fitting' | 'pipe-fitting',
  key: string,
  title: string,
  choices: readonly string[],
  fallback: string,
  numeric = false,
  types?: string[],
): ToolOption {
  return {
    id: key,
    label: title,
    choices: choices.map((value) => ({
      value,
      label: label(value),
      ...(key === 'fittingType' && value === 'reducer'
        ? { description: 'Collega profili uguali di dimensioni diverse.' }
        : key === 'fittingType' && value === 'transition'
          ? {
              description:
                'Collega profili tondi, rettangolari o ovali. Scegli forma e dimensione di ogni estremità.',
            }
          : {}),
    })),
    value: () => String(useEditor.getState().toolDefaults[kind]?.[key] ?? fallback),
    subscribe: (callback) => useEditor.subscribe(callback),
    set: (value) => {
      const defaults = {
        ...useEditor.getState().toolDefaults[kind],
        [key]: numeric ? Number(value) : value,
      }
      if (
        kind === 'duct-fitting' &&
        key === 'fittingType' &&
        ['reducer', 'transition'].includes(value)
      ) {
        defaults.inletShape = value === 'reducer' ? 'round' : 'rect'
        defaults.outletShape = 'round'
      }
      if (kind === 'duct-fitting' && defaults.fittingType === 'transition') {
        const inlet = defaults.inletShape ?? 'rect'
        const outlet = defaults.outletShape ?? 'round'
        if (inlet === outlet) {
          if (key === 'outletShape') defaults.inletShape = outlet === 'round' ? 'rect' : 'round'
          else defaults.outletShape = inlet === 'round' ? 'rect' : 'round'
        }
      }
      if (defaults.fittingType === 'reducer') {
        const inlet = Number(defaults.diameter ?? (kind === 'duct-fitting' ? 12 : 2))
        const outlet = Number(defaults.diameter2 ?? inlet)
        defaults.diameter2 = reducerOutletDiameter(kind, inlet, outlet)
      }
      if (kind === 'duct-fitting' && key === 'shape') defaults.shape2 = value
      useEditor.getState().setToolDefaults(kind, defaults)
    },
    ...(types
      ? {
          visible: {
            subscribe: (callback: () => void) => useEditor.subscribe(callback),
            value: () =>
              types.includes(
                String(useEditor.getState().toolDefaults[kind]?.fittingType ?? 'elbow'),
              ),
          },
        }
      : {}),
  }
}

export const ductFittingToolOptions: ToolOption[] = [
  option(
    'duct-fitting',
    'fittingType',
    'Raccordi e accessori per canali',
    ['elbow', 'tee', 'cross', 'reducer', 'transition', 'end-cap', 'damper', 'access-panel'],
    'elbow',
  ),
  option('duct-fitting', 'shape', 'Profilo', ['round', 'rect', 'oval'], 'rect', false, [
    'elbow',
    'tee',
    'cross',
    'end-cap',
    'damper',
  ]),
  option(
    'duct-fitting',
    'inletShape',
    'Profilo d’ingresso',
    ['round', 'rect', 'oval'],
    'rect',
    false,
    ['transition', 'reducer'],
  ),
  option(
    'duct-fitting',
    'outletShape',
    'Profilo d’uscita',
    ['round', 'rect', 'oval'],
    'round',
    false,
    ['transition', 'reducer'],
  ),
  {
    ...option(
      'duct-fitting',
      'width2',
      'Larghezza d’uscita (in)',
      ['8', '10', '14', '20', '24'],
      '14',
      true,
      ['transition', 'reducer'],
    ),
    id: 'outletWidth',
  },
  {
    ...option(
      'duct-fitting',
      'height2',
      'Altezza d’uscita (in)',
      ['4', '6', '8', '12', '16'],
      '8',
      true,
      ['transition', 'reducer'],
    ),
    id: 'outletHeight',
  },
  option('duct-fitting', 'diameter', 'Diametro (in)', ['4', '6', '8', '10', '12'], '12', true),
  option('duct-fitting', 'width', 'Larghezza (in)', ['8', '10', '14', '20', '24'], '14', true),
  option('duct-fitting', 'height', 'Altezza (in)', ['4', '6', '8', '12', '16'], '8', true),
  option(
    'duct-fitting',
    'diameter2',
    'Diametro d’uscita (in)',
    ['2', '4', '6', '8', '10', '12'],
    '12',
    true,
    ['reducer', 'transition'],
  ),
  {
    ...option(
      'duct-fitting',
      'diameter2',
      'Diametro della derivazione (in)',
      ['2', '4', '6', '8', '10', '12'],
      '12',
      true,
      ['tee', 'cross'],
    ),
    id: 'branchDiameter',
  },
  option(
    'duct-fitting',
    'shape2',
    'Profilo della derivazione',
    ['round', 'rect', 'oval'],
    'rect',
    false,
    ['tee', 'cross'],
  ),
  option(
    'duct-fitting',
    'width2',
    'Larghezza della derivazione (in)',
    ['8', '10', '14', '20', '24'],
    '14',
    true,
    ['tee', 'cross'],
  ),
  option(
    'duct-fitting',
    'height2',
    'Altezza della derivazione (in)',
    ['4', '6', '8', '12', '16'],
    '8',
    true,
    ['tee', 'cross'],
  ),
  option('duct-fitting', 'damperAngle', 'Apertura della lama (°)', ['0', '45', '90'], '0', true, [
    'damper',
  ]),
  option(
    'duct-fitting',
    'panelWidth',
    'Larghezza del portello (m)',
    ['0.15', '0.25', '0.4'],
    '0.25',
    true,
    ['access-panel'],
  ),
  option(
    'duct-fitting',
    'panelHeight',
    'Altezza del portello (m)',
    ['0.1', '0.15', '0.25'],
    '0.15',
    true,
    ['access-panel'],
  ),
]
export const pipeFittingToolOptions: ToolOption[] = [
  option(
    'pipe-fitting',
    'fittingType',
    'Raccordi e accessori per tubi',
    ['elbow', 'wye', 'sanitary-tee', 'cross', 'end-cap', 'cleanout', 'reducer', 'coupling'],
    'elbow',
  ),
  option(
    'pipe-fitting',
    'diameter',
    'Diametro (in)',
    ['1.25', '1.5', '2', '3', '4', '6', '8'],
    '2',
    true,
  ),
  option(
    'pipe-fitting',
    'diameter2',
    'Diametro d’uscita (in)',
    ['1.25', '1.5', '2', '3', '4', '6', '8'],
    '2',
    true,
    ['reducer'],
  ),
  {
    ...option(
      'pipe-fitting',
      'diameter2',
      'Diametro della derivazione (in)',
      ['1.25', '1.5', '2', '3', '4', '6', '8'],
      '2',
      true,
      ['wye', 'sanitary-tee', 'cross'],
    ),
    id: 'branchDiameter',
  },
  option('pipe-fitting', 'cleanoutStyle', 'Tipo di ispezione', ['end', 'inline'], 'end', false, [
    'cleanout',
  ]),
  option('pipe-fitting', 'pipeMaterial', 'Materiale', ['pvc', 'abs', 'cast-iron'], 'pvc'),
]

for (const entry of ductFittingToolOptions) {
  if (!['diameter', 'width', 'height'].includes(entry.id)) continue
  entry.visible = {
    subscribe: (callback) => useEditor.subscribe(callback),
    value: () => {
      const defaults = useEditor.getState().toolDefaults['duct-fitting']
      const type = defaults?.fittingType ?? 'elbow'
      if (type === 'access-panel') return false
      const round = ['reducer', 'transition'].includes(String(type))
        ? (defaults?.inletShape ?? (type === 'reducer' ? 'round' : 'rect')) === 'round'
        : defaults?.shape === 'round'
      return entry.id === 'diameter' ? round : !round
    },
  }
}

for (const entry of ductFittingToolOptions) {
  if (!['branchDiameter', 'shape2', 'width2', 'height2'].includes(entry.id)) continue
  entry.visible = {
    subscribe: (callback) => useEditor.subscribe(callback),
    value: () => {
      const defaults = useEditor.getState().toolDefaults['duct-fitting']
      if (!['tee', 'cross'].includes(String(defaults?.fittingType))) return false
      const roundRun = defaults?.shape === 'round'
      const roundBranch = roundRun || defaults?.shape2 === 'round'
      if (entry.id === 'shape2') return !roundRun
      return entry.id === 'branchDiameter' ? roundBranch : !roundBranch
    },
  }
}

for (const entry of ductFittingToolOptions) {
  if (!['diameter2', 'outletWidth', 'outletHeight'].includes(entry.id)) continue
  entry.visible = {
    subscribe: (callback) => useEditor.subscribe(callback),
    value: () => {
      const defaults = useEditor.getState().toolDefaults['duct-fitting']
      if (!['reducer', 'transition'].includes(String(defaults?.fittingType))) return false
      const round = (defaults?.outletShape ?? 'round') === 'round'
      return entry.id === 'diameter2' ? round : !round
    },
  }
}
