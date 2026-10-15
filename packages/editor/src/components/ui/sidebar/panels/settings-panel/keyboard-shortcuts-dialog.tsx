import { Keyboard } from 'lucide-react'
import { Button } from './../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './../../../../../components/ui/primitives/dialog'
import {
  ShortcutToken,
  shortcutDisplayValue,
} from './../../../../../components/ui/primitives/shortcut-token'

type Shortcut = {
  keys: string[]
  action: string
  note?: string
}

type ShortcutCategory = {
  title: string
  shortcuts: Shortcut[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Navigazione nell'editor",
    shortcuts: [
      { keys: ['1'], action: 'Passa al lotto' },
      { keys: ['2'], action: "Passa all'edificio" },
      { keys: ['\\'], action: 'Apri o chiudi la vista divisa' },
      { keys: ['F'], action: 'Apri il catalogo degli oggetti con lo strumento Oggetto' },
      { keys: ['Z'], action: 'Disegna una zona' },
      {
        keys: ['Cmd/Ctrl', 'Arrow Up'],
        action: "Seleziona il piano successivo dell'edificio attivo",
      },
      {
        keys: ['Cmd/Ctrl', 'Arrow Down'],
        action: "Seleziona il piano precedente dell'edificio attivo",
      },
      { keys: ['Cmd/Ctrl', 'B'], action: 'Mostra/nascondi barra laterale' },
    ],
  },
  {
    title: 'Modalità e cronologia',
    shortcuts: [
      { keys: ['V'], action: 'Passa alla modalità Seleziona' },
      { keys: ['B'], action: 'Passa alla modalità Costruisci' },
      { keys: ['M'], action: "Attiva l'ultimo strumento di misura usato" },
      { keys: ['X'], action: 'Passa alla modalità Elimina' },
      {
        keys: ['Esc'],
        action: 'Annulla lo strumento attivo e torna alla modalità Seleziona',
        note: 'Mentre disegni annulla solo la sequenza in corso e lascia attivo lo strumento; premilo di nuovo per uscire dallo strumento.',
      },
      { keys: ['Delete / Backspace'], action: 'Elimina gli oggetti selezionati' },
      { keys: ['Cmd/Ctrl', 'Z'], action: 'Annulla' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], action: 'Ripeti' },
      { keys: ['Cmd/Ctrl', 'S'], action: 'Salva' },
    ],
  },
  {
    title: 'Selezione',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'C'],
        action: 'Copia gli oggetti selezionati',
        note: 'La selezione copiata si può incollare in un altro piano, progetto o scheda del browser.',
      },
      {
        keys: ['Cmd/Ctrl', 'X'],
        action: 'Taglia gli oggetti selezionati',
        note: 'Copia la selezione negli appunti, poi la toglie da questa scena.',
      },
      {
        keys: ['Cmd/Ctrl', 'V'],
        action: 'Incolla e posiziona gli oggetti copiati',
        note:
          "Mostra un'anteprima sotto il cursore. Fai clic per posizionarla o premi Esc per annullare.",
      },
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        action: 'Aggiungi o togli un oggetto dalla selezione multipla',
        note: "Funziona in modalità Seleziona nella vista 3D, nella pianta 2D e nell'albero della scena.",
      },
      {
        keys: ['Shift', 'Left click'],
        action: 'Aggiungi o togli un oggetto dalla selezione multipla nella vista',
        note: "Nell'albero della scena, Maiusc+clic seleziona l'intervallo visibile come in un gestore di file.",
      },
      {
        keys: ['Left click'],
        action: 'Sposta tutta la selezione multipla',
        note:
          'Con almeno 2 oggetti selezionati, sia in 2D sia in 3D: trascina la selezione (o il suo riquadro tratteggiato) per spostarla; fai clic per prenderla e posizionala con il clic successivo.',
      },
      {
        keys: ['R', 'T'],
        action: 'Ruota la selezione multipla di ±45° attorno al suo centro',
        note: 'Funziona anche durante lo spostamento della selezione.',
      },
      {
        keys: ['Cmd/Ctrl', 'G'],
        action: 'Raggruppa la selezione multipla (solo per questa sessione)',
        note:
          "Solo nell'editor. In seguito, un clic semplice su un elemento riseleziona tutto il gruppo. Non viene salvato nel progetto.",
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'G'],
        action: 'Separa il gruppo della sessione',
        note: 'Mantiene la selezione attuale; scioglie solo il gruppo della sessione.',
      },
      {
        keys: ['Esc'],
        action: 'Annulla la selezione',
        note: 'Lo stesso succede facendo clic su uno spazio vuoto.',
      },
    ],
  },
  {
    title: 'Modifica diretta',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        action: "Sposta l'oggetto selezionato sotto il cursore",
        note: "Trascina in modalità Seleziona con un solo oggetto selezionato. L'aggancio guidato e le guide sono attivi in modo predefinito.",
      },
      {
        keys: ['Cmd/Ctrl', 'Right click'],
        action: "Ruota l'oggetto selezionato sotto il cursore",
        note: 'Trascina a sinistra o a destra in modalità Seleziona con un solo oggetto selezionato. In modo predefinito la rotazione procede a scatti di 15°.',
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'Right click'],
        action: 'Ruota liberamente',
        note: 'Tieni premuto Maiusc durante il trascinamento per ignorare gli scatti di 15°.',
      },
    ],
  },
  {
    title: 'Strumenti di disegno',
    shortcuts: [
      // Shift and Ctrl each mean one thing held and another tapped, and only
      // the hold was documented — which read as the taps not existing. Both
      // taps are listed first because they are the ones nobody discovers.
      {
        keys: ['Shift'],
        action: 'Cambia la modalità di aggancio',
        note: 'Premi e rilascia senza premere altro, mentre puoi disegnare o spostare.',
      },
      {
        keys: ['Cmd/Ctrl'],
        action: 'Cambia il passo della griglia: 0,5 m → 0,25 m → 0,1 m → 0,05 m',
        note: 'Premi e rilascia da solo. Usalo quando la griglia predefinita da mezzo metro è troppo larga, per esempio per posizionare una finestra.',
      },
      {
        keys: ['Shift'],
        action: "Ignora l'aggancio guidato e i vincoli di angolo",
        note: "Tieni premuto durante l'azione in corso. Guide e misure di riferimento possono restare visibili.",
      },
      {
        keys: ['Shift'],
        action: 'Ruota liberamente, senza gli scatti predefiniti di 15°',
        note: 'Tieni premuto mentre trascini una maniglia di rotazione o ruoti direttamente.',
      },
    ],
  },
  {
    title: 'Posizionamento degli oggetti',
    shortcuts: [
      {
        keys: ['R', 'T'],
        action: "Ruota l'oggetto; con una porta selezionata, R la apre o la chiude e T la chiude",
      },
      {
        keys: ['E'],
        action: "Aziona l'elemento selezionato: porte, finestre e ante o cassetti dei mobili si aprono o si chiudono",
      },
      {
        keys: ['Shift'],
        action: 'Ignora per il momento i vincoli di posizionamento',
        note: 'Tieni premuto mentre posizioni.',
      },
    ],
  },
  {
    title: 'Vista',
    shortcuts: [
      {
        keys: ['W', 'A', 'S', 'D'],
        action: 'Sposta la vista',
        note: 'Sposta sul piano dello schermo, come trascinare la vista.',
      },
      {
        keys: ['Middle click'],
        action: 'Sposta la vista',
        note: 'Trascina con il tasto centrale del mouse, oppure tieni premuto Spazio mentre trascini con il tasto sinistro.',
      },
      {
        keys: ['Right click'],
        action: 'Ruota la vista',
        note: 'Trascina con il tasto destro del mouse.',
      },
    ],
  },
]

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <div className="flex items-center gap-1" key={`${key}-${index}`}>
          {index > 0 ? <span className="text-[10px] text-muted-foreground">+</span> : null}
          <ShortcutToken displayValue={shortcutDisplayValue(key)} value={key} />
        </div>
      ))}
    </div>
  )
}

export function KeyboardShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="outline">
          <Keyboard className="size-4" />
          Scorciatoie da tastiera
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Scorciatoie da tastiera</DialogTitle>
          <DialogDescription>
            Le scorciatoie dipendono dal contesto. I vincoli guidati sono attivi in modo
            predefinito; tieni premuto Maiusc durante un'azione per costruire liberamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <section className="space-y-2" key={category.title}>
              <h3 className="font-medium text-sm">{category.title}</h3>
              <div className="overflow-hidden rounded-md border border-border/80">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    className="grid grid-cols-[minmax(130px,220px)_1fr] gap-3 px-3 py-2"
                    key={`${category.title}-${shortcut.action}`}
                  >
                    <ShortcutKeys keys={shortcut.keys} />
                    <div>
                      <p className="text-sm">{shortcut.action}</p>
                      {shortcut.note ? (
                        <p className="text-muted-foreground text-xs">{shortcut.note}</p>
                      ) : null}
                    </div>
                    {index < category.shortcuts.length - 1 ? (
                      <div className="col-span-2 border-border/60 border-b" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
