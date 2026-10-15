import type { Metadata } from 'next'
import { AppCard, PRODUCT_NAME } from '@/components/app-shell'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: `Accedi · ${PRODUCT_NAME}` }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return (
    <AppCard>
      <h1 className="mt-6 font-semibold text-lg">Accedi a questo editor</h1>
      <p className="mt-1 text-muted-foreground text-sm">
        Inserisci la password di amministratore impostata per questa installazione.
      </p>
      <LoginForm next={safeNextPath(next)} />
    </AppCard>
  )
}

/** Only same-origin paths may be used as the post-login destination. */
function safeNextPath(next: string | undefined): string {
  if (!next?.startsWith('/') || next.startsWith('//')) return '/'
  return next
}
