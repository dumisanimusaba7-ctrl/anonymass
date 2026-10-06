import { useEffect, useMemo, useState } from 'react'
import { ButtonLink, Footer, StatusDot, TopBar } from '../components/ui'
import { track } from '../lib/analytics'
import { prefersReducedMotion } from '../lib/format'

export function Landing() {
  useEffect(() => track('landing_view'), [])

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <TopBar
        right={
          <ButtonLink to="/create" variant="outline" size="sm" className="hidden sm:inline-flex">
            Create my game
          </ButtonLink>
        }
      />

      <main className="flex-1">
        {/* Hero: the whole product in one screen */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-4 sm:px-8 sm:pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:pb-24">
          <div>
            <p className="eyebrow animate-rise">A guessing game for people who know you</p>
            <h1 className="headline mt-4 animate-rise text-[clamp(3.4rem,17vw,8.6rem)] lg:text-[clamp(4rem,6.8vw,7rem)] [animation-delay:60ms]">
              How well
              <br />
              do you
              <br />
              know <span className="text-volt">me?</span>
            </h1>
            <div className="mt-6 animate-rise space-y-0.5 text-lg font-medium text-[#cfccc4] sm:text-xl [animation-delay:140ms]">
              <p>I shared a link.</p>
              <p>Someone clicked it.</p>
              <p className="text-bone">Now I have to figure out who they are.</p>
            </div>
            <div className="mt-8 flex animate-rise flex-col gap-3 sm:max-w-sm [animation-delay:220ms]">
              <ButtonLink to="/create" className="w-full text-base">
                Create my game <span aria-hidden="true">→</span>
              </ButtonLink>
              <p className="text-center text-sm text-mute sm:text-left">No account. No profile. No awkward setup.</p>
            </div>
          </div>

          <ChatDemo />
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-ink-2/60">
          <ol className="mx-auto grid w-full max-w-6xl gap-px px-4 sm:px-8 md:grid-cols-3">
            {[
              ['01', 'Create your link', 'Takes ten seconds. Just your name.'],
              ['02', 'Share it anywhere', 'Story, group chat, DMs. Wherever your people are.'],
              ['03', 'Guess who clicked', 'Chat with them anonymously. One final guess.'],
            ].map(([n, title, body]) => (
              <li key={n} className="py-8 md:px-6 md:first:pl-0">
                <span className="font-mono text-sm font-semibold text-volt">{n}</span>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em]">{title}</h2>
                <p className="mt-1 text-mute">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The twist */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
          <h2 className="headline max-w-4xl text-[clamp(2.4rem,9vw,5.5rem)]">Someone you know is hiding behind the screen.</h2>
          <ul className="mt-10 space-y-3 text-[clamp(1.4rem,5.4vw,2.4rem)] font-extrabold leading-tight tracking-[-0.03em]">
            <li>
              They can answer <span className="text-volt">honestly.</span>
            </li>
            <li>
              They can{' '}
              <span className="relative inline-block">
                <span className="text-mute line-through decoration-volt decoration-[5px]">lie.</span>
              </span>
            </li>
            <li>
              They can <span className="inline-block -rotate-3 rounded-md bg-bone px-2 text-ink">troll</span> you.
            </li>
            <li className="text-mute">
              They can give you{' '}
              <span className="text-bone underline decoration-volt decoration-4 underline-offset-[6px]">one tiny clue</span> that
              gives everything away.
            </li>
          </ul>
          <p className="mt-10 max-w-md font-mono text-sm text-mute">
            You can lie. You can troll. You can stay mysterious. Just don't be abusive.
          </p>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8">
          <div className="card flex flex-col items-start gap-8 p-6 sm:p-12 md:flex-row md:items-end md:justify-between">
            <h2 className="headline text-[clamp(2.4rem,10vw,5rem)]">
              Think you know
              <br />
              your <span className="text-volt">friends?</span>
            </h2>
            <ButtonLink to="/create" className="w-full md:w-auto md:min-w-56">
              Try it <span aria-hidden="true">→</span>
            </ButtonLink>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

type DemoLine = { from: 'them' | 'you' | 'hint'; text: string }

const SCRIPT: DemoLine[] = [
  { from: 'them', text: "we've definitely met 👀" },
  { from: 'you', text: 'school??' },
  { from: 'them', text: 'colder' },
  { from: 'you', text: 'is this jake' },
  { from: 'them', text: 'who tf is jake' },
  { from: 'hint', text: 'You still owe me money.' },
  { from: 'you', text: 'WAIT' },
]

/** A looping, scripted preview of the game room. */
function ChatDemo() {
  const reduced = useMemo(prefersReducedMotion, [])
  const [step, setStep] = useState(reduced ? SCRIPT.length : 0)
  const [typing, setTyping] = useState(false)
  const anon = useMemo(() => 1000 + Math.floor(Math.random() * 9000), [])
  const tilt = useMemo(() => (Math.random() * 3 - 1.5).toFixed(2), [])

  useEffect(() => {
    if (reduced) return
    if (step >= SCRIPT.length) {
      const t = window.setTimeout(() => setStep(0), 3200)
      return () => window.clearTimeout(t)
    }
    const next = SCRIPT[step]
    const typingFor = next.from === 'you' ? 0 : 1100
    setTyping(typingFor > 0)
    const t = window.setTimeout(
      () => {
        setTyping(false)
        setStep((s) => s + 1)
      },
      typingFor + (step === 0 ? 500 : 750),
    )
    return () => window.clearTimeout(t)
  }, [step, reduced])

  const shown = SCRIPT.slice(0, step)

  return (
    <div
      aria-hidden="true"
      className="card relative mx-auto w-full max-w-md animate-rise overflow-hidden shadow-[0_30px_80px_-30px_rgba(214,255,61,0.25)] [animation-delay:300ms] lg:mx-0"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="text-sm font-black uppercase tracking-tight">Who's on the other end?</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-mute">
            <StatusDot /> Someone is here.
          </p>
        </div>
        <span className="font-mono text-xs text-dim">#{anon}</span>
      </div>
      <div className="flex h-72 flex-col justify-end gap-2 overflow-hidden px-4 py-4">
        {shown.map((line, i) => (
          <DemoBubble key={`${i}-${line.text}`} line={line} />
        ))}
        {typing && (
          <div className="flex items-center gap-2 text-xs text-mute">
            <span className="flex gap-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            Someone is typing...
          </div>
        )}
      </div>
      <div className="border-t border-line p-4">
        <div className="btn btn-primary pointer-events-none w-full">I know who you are</div>
      </div>
    </div>
  )
}

function DemoBubble({ line }: { line: DemoLine }) {
  if (line.from === 'hint') {
    return (
      <div className="animate-msg-in self-start rounded-xl border border-volt/40 bg-volt/10 px-3.5 py-2.5 text-sm">
        <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-volt">Hint · Shared memory</span>
        <p className="font-semibold">{line.text}</p>
      </div>
    )
  }
  const mine = line.from === 'you'
  return (
    <div className={`flex animate-msg-in flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="mb-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-dim">
        {mine ? 'You' : 'Anonymous'}
      </span>
      <p
        className={`max-w-[80%] rounded-xl px-3.5 py-2 text-[0.95rem] font-medium ${
          mine ? 'bg-bone text-ink' : 'bg-ink-3 text-bone'
        }`}
      >
        {line.text}
      </p>
    </div>
  )
}
