import { useEffect, useId, useRef, type ComponentProps, type InputHTMLAttributes, type ReactNode } from 'react'
import { linkHandler } from '../lib/router'

type Variant = 'primary' | 'light' | 'outline' | 'danger'

export function Button({
  variant = 'primary',
  size,
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: 'sm' }) {
  return <button type="button" className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} {...props} />
}

/** An internal link that looks like a button. */
export function ButtonLink({
  to,
  variant = 'primary',
  size,
  className = '',
  children,
  onClick,
}: {
  to: string
  variant?: Variant
  size?: 'sm'
  className?: string
  children: ReactNode
  onClick?: () => void
}) {
  const go = linkHandler(to)
  return (
    <a
      href={to}
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      onClick={(e) => {
        onClick?.()
        go(e)
      }}
    >
      {children}
    </a>
  )
}

export function TextLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={to} onClick={linkHandler(to)} className={`link ${className}`}>
      {children}
    </a>
  )
}

export function Field({
  label,
  optional,
  helper,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; optional?: boolean; helper?: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-extrabold uppercase tracking-tight">{label}</span>
        {optional && <span className="eyebrow">Optional</span>}
      </label>
      <input
        id={id}
        className="input"
        aria-describedby={helper || error ? `${id}-help` : undefined}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      {(helper || error) && (
        <p id={`${id}-help`} className={`text-sm ${error ? 'text-danger' : 'text-mute'}`}>
          {error || helper}
        </p>
      )}
    </div>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <a
      href="/"
      onClick={linkHandler('/')}
      className={`inline-flex items-center gap-1.5 text-[1.05rem] font-black uppercase tracking-[-0.04em] ${className}`}
      aria-label="ANONYMASS home"
    >
      ANONYMASS
      <span aria-hidden="true" className="inline-block h-[0.95em] w-[0.5em] translate-y-[1px] bg-volt animate-blink" />
    </a>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-16 sm:px-8">
      <div className="flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-mute">Trolling is allowed. Abuse is not.</p>
        </div>
        <nav aria-label="Footer" className="flex gap-6 text-sm font-semibold text-mute">
          <TextLink to="/privacy">Privacy</TextLink>
          <TextLink to="/rules">Rules</TextLink>
          <TextLink to="/report">Report</TextLink>
        </nav>
      </div>
    </footer>
  )
}

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
      <Logo />
      {right}
    </header>
  )
}

/** Standard page layout: top bar, centred content column, footer. */
export function Page({ children, width = 'max-w-xl', footer = true }: { children: ReactNode; width?: string; footer?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className={`mx-auto w-full flex-1 px-4 pb-8 pt-6 sm:px-8 sm:pt-12 ${width}`}>{children}</main>
      {footer && <Footer />}
    </div>
  )
}

export function StatusDot({ tone = 'live' }: { tone?: 'live' | 'idle' | 'off' }) {
  const color = tone === 'live' ? 'bg-volt' : tone === 'idle' ? 'bg-mute' : 'bg-danger'
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      {tone === 'live' && <span className={`absolute inset-0 rounded-full ${color} animate-ping-slow`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  )
}

export function Loading({ label = 'Finding the mystery...' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center" role="status">
      <span className="flex gap-1.5 text-volt" aria-hidden="true">
        <span className="typing-dot !h-2.5 !w-2.5" />
        <span className="typing-dot !h-2.5 !w-2.5" />
        <span className="typing-dot !h-2.5 !w-2.5" />
      </span>
      <p className="text-lg font-bold">{label}</p>
    </div>
  )
}

/** Native <dialog>: focus trapping, Esc and an inert background for free. */
export function Dialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(100%-2rem,30rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-line bg-ink-2 p-0 text-bone shadow-2xl open:animate-pop"
    >
      {open && <div className="p-6 sm:p-8">{children}</div>}
    </dialog>
  )
}
