import type { Metadata } from 'next'
import { AppCard, PRODUCT_NAME } from '@/components/app-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: `Configurazione · ${PRODUCT_NAME}` }

const VARIABLES = [
  [
    'PASCAL_ADMIN_PASSWORD',
    'La password che sblocca questo editor. Obbligatoria su un server in rete.',
  ],
  [
    'PASCAL_PUBLIC_URL',
    "L'indirizzo con cui gli utenti lo raggiungono, per esempio https://cad.example.com.",
  ],
  [
    'PASCAL_SCENE_API_TOKEN',
    "Facoltativo. Un token bearer per agenti e script che usano l'API delle scene.",
  ],
  [
    'PASCAL_AUTH=proxy',
    'Alternativa alla password quando un reverse proxy autentica già ogni richiesta.',
  ],
] as const

export default function SetupPage() {
  return (
    <AppCard className="max-w-lg">
      <h1 className="mt-6 font-semibold text-lg">
        Questo editor è raggiungibile ma non ancora protetto
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Imposta una password di amministratore nell'ambiente e riavvia. Fino ad allora questo
        indirizzo non mostra nulla.
      </p>
      <dl className="mt-5 flex flex-col divide-y divide-border/50 rounded-xl border border-border/50">
        {VARIABLES.map(([name, description]) => (
          <div className="px-4 py-3" key={name}>
            <dt className="font-mono text-sm">{name}</dt>
            <dd className="mt-0.5 text-muted-foreground text-xs">{description}</dd>
          </div>
        ))}
      </dl>
    </AppCard>
  )
}
