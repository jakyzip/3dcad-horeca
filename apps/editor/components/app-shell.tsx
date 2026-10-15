import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The dark chrome every page outside the editor shares, so the scenes list,
 * settings and sign-in read as the same product as the editor itself.
 */
export function AppShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'dark min-h-screen bg-sidebar font-sans text-foreground [color-scheme:dark]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export const PRODUCT_NAME = '3DCadHo.Re.Ca'

/** The product mark: an isometric block, plan on top (blue) and 3D sides. Same art as app/icon.svg. */
export function ProductMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={cn('h-5 w-5', className)} viewBox="0 0 64 64">
      <rect fill="#1c1917" height="64" rx="14" width="64" />
      <path d="M32 14 48 23 32 32 16 23Z" fill="#2563eb" />
      <path d="M16 23 32 32V50L16 41Z" fill="#fafaf9" />
      <path d="M48 23 32 32V50L48 41Z" fill="#a8a29e" />
      <path
        d="M24 18.5 40 27.5M40 18.5 24 27.5"
        stroke="#1c1917"
        strokeOpacity=".35"
        strokeWidth="1.2"
      />
    </svg>
  )
}

export function ProductLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex h-5 items-center gap-2 font-semibold text-sm', className)}>
      <ProductMark className="h-full w-auto" />
      {PRODUCT_NAME}
    </span>
  )
}

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-border/50 border-b bg-sidebar">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          aria-label={`${PRODUCT_NAME} home`}
          className="-mx-2 flex items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
          href="/"
        >
          <ProductLogo />
        </Link>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  )
}

/** A centred card for single-purpose pages (sign-in, setup, not found). */
export function AppCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <AppShell className="flex items-center justify-center p-6">
      <div
        className={cn(
          'w-full max-w-sm rounded-2xl border border-border/60 bg-background p-6 shadow-2xl',
          className,
        )}
      >
        <ProductLogo className="h-4" />
        {children}
      </div>
    </AppShell>
  )
}

export const PRIMARY_PILL =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50'

export const SECONDARY_PILL =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-accent disabled:opacity-50'

export const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
