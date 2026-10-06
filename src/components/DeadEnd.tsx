import type { ReactNode } from 'react'
import { track } from '../lib/analytics'
import { ButtonLink, Page } from './ui'

/** Full-page state for links that can't be played (expired, invalid, taken...). */
export function DeadEnd({
  eyebrow,
  title,
  children,
  cta = 'Create your own',
  code,
}: {
  eyebrow?: string
  title: ReactNode
  children?: ReactNode
  cta?: string
  code?: string
}) {
  return (
    <Page>
      <div className="flex flex-col gap-6 pt-6 sm:pt-12">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="headline animate-rise text-[clamp(2.6rem,12vw,4.8rem)]">{title}</h1>
        {children && <div className="animate-rise space-y-3 text-lg text-[#cfccc4] [animation-delay:100ms]">{children}</div>}
        <div className="mt-4 animate-rise [animation-delay:180ms]">
          <ButtonLink
            to="/create"
            className="w-full sm:w-auto sm:min-w-64"
            onClick={() => track('replay_clicked', code, { from: 'dead_end' })}
          >
            {cta} <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>
      </div>
    </Page>
  )
}

export function NotFoundState({ code }: { code?: string }) {
  return (
    <DeadEnd title={<>This mystery doesn't exist.</>} code={code}>
      <p>Possible reasons:</p>
      <ul className="space-y-1 font-mono text-base text-mute">
        <li>— the link expired</li>
        <li>— the game was deleted</li>
        <li>— the link is invalid</li>
      </ul>
    </DeadEnd>
  )
}

export function ExpiredState({ code }: { code?: string }) {
  return (
    <DeadEnd title="This game has expired." cta="Create a new game" code={code}>
      <p>The mystery is over.</p>
    </DeadEnd>
  )
}
