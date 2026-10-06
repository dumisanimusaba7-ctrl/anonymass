import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { clock, plural, prefersReducedMotion } from '../lib/format'
import { homeUrl, shareOrCopy, shareText } from '../lib/share'
import type { ActiveState, GameResult, Role } from '../lib/types'
import { useToast } from './Toasts'
import { Button, ButtonLink, Footer, TopBar } from './ui'

/* -------------------------------------------------------------------------- */
/* Magic moment: someone just clicked your link                                */
/* -------------------------------------------------------------------------- */

export function MagicMoment({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timers = [window.setTimeout(() => setPhase(1), 900), window.setTimeout(() => setPhase(2), 1700)]
    return () => timers.forEach(window.clearTimeout)
  }, [])

  useEffect(() => {
    if (phase === 2) button.current?.focus()
  }, [phase])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="magic-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-center"
    >
      <p className="eyebrow">Game update</p>
      <h2 id="magic-title" className="headline mt-5 max-w-3xl animate-stamp text-[clamp(2.8rem,13vw,6.5rem)] [--tilt:-2deg]">
        Someone just clicked your link <span className="inline-block">👀</span>
      </h2>
      <p
        className={`mt-8 text-xl font-semibold transition-all duration-500 sm:text-2xl ${phase >= 1 ? 'opacity-100' : 'translate-y-2 opacity-0'}`}
      >
        You have <span className="text-volt">NO IDEA</span> who this is.
      </p>
      <div
        className={`mt-10 w-full max-w-xs transition-all duration-500 ${phase >= 2 ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <Button ref={button} className="w-full" onClick={onDone}>
          Open the game <span aria-hidden="true">→</span>
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Reveal: YOU GUESSED... MICHAEL... YOU GOT PLAYED                            */
/* -------------------------------------------------------------------------- */

export function verdict(role: Role, correct: boolean) {
  if (role === 'creator') return correct ? 'You got them. 💀' : 'You got played. 💀'
  return correct ? 'They got you. 💀' : 'You played them. 😈'
}

export function Reveal({ role, result, onDone }: { role: Role; result: GameResult; onDone: () => void }) {
  const reduced = useMemo(prefersReducedMotion, [])
  const [phase, setPhase] = useState(reduced ? 2 : 0)
  // Keep the sequence running even if the parent re-renders mid-reveal.
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const finish = () => done.current()
    const timers = reduced
      ? [window.setTimeout(finish, 1400)]
      : [window.setTimeout(() => setPhase(1), 1100), window.setTimeout(() => setPhase(2), 2700), window.setTimeout(finish, 4600)]
    return () => timers.forEach(window.clearTimeout)
  }, [reduced])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-center"
      role="status"
      aria-live="assertive"
    >
      <p className="text-2xl font-extrabold uppercase tracking-tight text-mute sm:text-3xl">
        {role === 'creator' ? 'You guessed...' : 'They guessed...'}
      </p>
      <div className="mt-6 min-h-[1em] text-[clamp(3.2rem,16vw,8rem)]">
        {phase >= 1 && <p className="headline animate-pop break-words">{result.guess}</p>}
      </div>
      <div className="mt-8 min-h-[4rem]">
        {phase >= 2 && (
          <p
            className={`headline inline-block animate-stamp rounded-xl px-5 py-3 text-[clamp(2rem,9vw,4rem)] [--tilt:-3deg] ${
              result.correct === (role === 'creator') ? 'bg-volt text-ink' : 'bg-bone text-ink'
            }`}
          >
            {verdict(role, result.correct)}
          </p>
        )}
      </div>
      <button type="button" onClick={onDone} className="link absolute bottom-8 text-sm text-mute">
        Skip
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Result page                                                                 */
/* -------------------------------------------------------------------------- */

export function Result({ state, result }: { state: ActiveState; result: GameResult }) {
  const toast = useToast()
  const creator = state.role === 'creator'
  const time = clock(result.duration)

  async function shareResult() {
    track('result_shared', state.code, { role: state.role, correct: result.correct })
    const text = creator
      ? result.correct
        ? shareText.gotThem(time, result.score)
        : shareText.played
      : result.correct
        ? shareText.busted(state.host)
        : shareText.fooledThem(state.host)
    const outcome = await shareOrCopy(text, homeUrl())
    if (outcome === 'copied') toast('Result copied. Paste it anywhere.')
    if (outcome === 'failed') toast("Couldn't share. Screenshot it instead.", 'error')
  }

  const replay = (from: string) => () => track('replay_clicked', state.code, { from, role: state.role })

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-6 sm:px-8 sm:pt-10">
        <h1 className="headline animate-stamp text-[clamp(3rem,15vw,5.8rem)] [--tilt:-1.5deg]">
          {verdict(state.role, result.correct)}
        </h1>

        <div className="mt-6 animate-rise space-y-1 text-xl font-semibold [animation-delay:120ms]">
          {creator && result.correct && (
            <p>
              It was <span className="text-volt">{result.name}</span>.
            </p>
          )}
          {creator && !result.correct && (
            <>
              <p>
                You guessed <span className="text-mute line-through decoration-2">{result.guess}</span>.
              </p>
              <p>
                It was <span className="text-volt">{result.name}</span>.
              </p>
              <p className="pt-2 text-lg font-medium text-mute">They successfully fooled you.</p>
            </>
          )}
          {!creator && result.correct && (
            <>
              <p>
                They guessed <span className="text-volt">{result.guess}</span>.
              </p>
              <p className="text-lg font-medium text-mute">Busted. {state.host} knows you too well.</p>
            </>
          )}
          {!creator && !result.correct && (
            <>
              <p>
                They guessed <span className="text-mute line-through decoration-2">{result.guess}</span>.
              </p>
              <p>
                It was you, <span className="text-volt">{result.name}</span>.
              </p>
              <p className="pt-2 text-lg font-medium text-mute">You successfully fooled {state.host}.</p>
            </>
          )}
        </div>

        <ResultCard state={state} result={result} />
        <p className="mt-3 text-center font-mono text-xs text-mute">Screenshot it. Post it. Start something.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {creator ? (
            <>
              <ButtonLink to="/create" onClick={replay(result.correct ? 'create_another' : 'get_revenge')}>
                {result.correct ? 'Create another game' : 'Get revenge'}
              </ButtonLink>
              <Button variant="light" onClick={shareResult}>
                Share your result
              </Button>
            </>
          ) : (
            <>
              <ButtonLink to="/create" onClick={replay('make_a_game')}>
                Make a game
              </ButtonLink>
              <Button variant="light" onClick={shareResult}>
                Share result
              </Button>
            </>
          )}
        </div>

        {/* The viral conversion point */}
        <section className="card mt-10 p-6 text-center sm:p-8">
          <h2 className="headline text-[clamp(2rem,9vw,3.2rem)]">
            {creator ? (
              <>
                Run it <span className="text-volt">back?</span>
              </>
            ) : (
              <>
                Think you could <span className="text-volt">fool</span> someone?
              </>
            )}
          </h2>
          <p className="mt-3 text-mute">
            {creator ? 'New link. New mystery. Same chaos.' : 'Make your own link and see who clicks.'}
          </p>
          <ButtonLink to="/create" className="mt-6 w-full" onClick={replay('loop_card')}>
            {creator ? 'Create my own game' : 'Create your own game'} <span aria-hidden="true">→</span>
          </ButtonLink>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function ResultCard({ state, result }: { state: ActiveState; result: GameResult }) {
  const creator = state.role === 'creator'
  return (
    <figure
      className="mt-8 animate-rise overflow-hidden rounded-2xl bg-bone text-ink shadow-[0_24px_60px_-24px_rgba(214,255,61,0.35)] [animation-delay:200ms]"
      aria-label="Result card"
    >
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-bone">
        <span className="font-black uppercase tracking-[-0.04em]">
          ANONYMASS<span className="text-volt">▮</span>
        </span>
        <span className="font-mono text-xs text-mute">#{state.code}</span>
      </div>
      <div className="px-5 pb-5 pt-4">
        <p className="headline text-[clamp(1.9rem,8.5vw,2.8rem)]">{verdict(state.role, result.correct)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-y-2 border-ink/10 py-4">
          <div>
            <dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-ink/55">
              {creator ? 'You guessed' : 'They guessed'}
            </dt>
            <dd className="mt-0.5 break-words text-xl font-black uppercase tracking-tight">{result.guess}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-ink/55">Actual</dt>
            <dd className="mt-0.5 break-words text-xl font-black uppercase tracking-tight">{result.name}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-sm font-semibold">
          <span className="text-2xl font-bold">{clock(result.duration)}</span>
          <span>{plural(result.questions, 'question')}</span>
          <span>{plural(result.hints, 'hint')}</span>
          <span>{plural(result.guesses, 'guess', 'guesses')}</span>
        </div>
        {result.correct && (
          <div className="mt-5 flex items-end justify-between gap-4 rounded-xl bg-ink px-4 py-3 text-bone">
            <span className="text-sm font-extrabold uppercase leading-tight tracking-tight">
              How well do {creator ? 'you' : 'they'}
              <br />
              know {creator ? 'them' : 'you'}?
            </span>
            <span className="font-mono text-4xl font-bold text-volt">{result.score}%</span>
          </div>
        )}
      </div>
    </figure>
  )
}
