import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { DeadEnd, ExpiredState, NotFoundState } from '../components/DeadEnd'
import { Room } from '../components/Room'
import { ShareScreen } from '../components/ShareScreen'
import { MagicMoment, Result, Reveal } from '../components/Result'
import { useToast } from '../components/Toasts'
import { Button, Field, Loading, Page, TextLink } from '../components/ui'
import { useGame } from '../hooks/useGame'
import { track } from '../lib/analytics'
import { api, ApiError } from '../lib/api'
import { errorCopy } from '../lib/errors'
import { clearSeat, getSeat, saveSeat, store, type Seat } from '../lib/identity'
import type { ActiveState, Peek } from '../lib/types'

export default function Game({ code }: { code: string }) {
  const [seat, setSeat] = useState<Seat | null>(() => getSeat(code))

  useEffect(() => setSeat(getSeat(code)), [code])

  const lose = useCallback(() => {
    clearSeat(code)
    setSeat(null)
  }, [code])

  if (!seat) return <JoinGate code={code} onJoined={setSeat} />
  return <Session key={`${code}:${seat.token}`} code={code} seat={seat} onSeatLost={lose} />
}

/* -------------------------------------------------------------------------- */
/* Visitors without a seat                                                     */
/* -------------------------------------------------------------------------- */

function JoinGate({ code, onJoined }: { code: string; onJoined: (seat: Seat) => void }) {
  const [peek, setPeek] = useState<Peek | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback(() => {
    setError(null)
    api
      .peekGame(code)
      .then(setPeek)
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError('unknown')))
  }, [code])

  useEffect(load, [load])

  if (error) {
    return (
      <DeadEnd title="Hold up." code={code} cta="Create your own">
        <p>{errorCopy(error.code, error.retryAfter)}</p>
        <p>
          <button type="button" className="link font-semibold text-bone" onClick={load}>
            Try again
          </button>
        </p>
      </DeadEnd>
    )
  }
  if (!peek) return <Loading />

  switch (peek.state) {
    case 'not_found':
      return <NotFoundState code={code} />
    case 'expired':
      return <ExpiredState code={code} />
    case 'over':
      return (
        <DeadEnd title="This mystery is over." cta="Make a game" code={code}>
          <p>Someone already played this one.</p>
          <p className="text-bone">Think you could fool someone?</p>
        </DeadEnd>
      )
    case 'taken':
      return (
        <DeadEnd title="Someone beat you to it." cta="Make a game" code={code}>
          <p>Someone else is already on the other end of {peek.host ? `${peek.host}'s` : 'this'} game.</p>
          <p className="text-bone">Think you could fool someone?</p>
        </DeadEnd>
      )
    default:
      return <JoinScreen code={code} host={peek.host ?? 'Someone'} onJoined={onJoined} />
  }
}

function JoinScreen({ code, host, onJoined }: { code: string; host: string; onJoined: (seat: Seat) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [aliases, setAliases] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => track('join_viewed', code), [code])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('We need your real name for the reveal. It stays sealed until then.')
      return
    }
    setBusy(true)
    try {
      const { token } = await api.joinGame(code, name.trim(), aliases.trim() || null)
      const seat: Seat = { token, role: 'guest' }
      saveSeat(code, seat)
      onJoined(seat)
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError('unknown')
      toast(errorCopy(e.code, e.retryAfter), 'error')
      setBusy(false)
    }
  }

  return (
    <Page>
      <p className="eyebrow animate-rise">{host}'s game</p>
      <h1 className="headline mt-4 animate-rise text-[clamp(2.7rem,13vw,5rem)] [animation-delay:60ms]">
        You're on the <span className="text-volt">other end.</span>
      </h1>
      <div className="mt-5 animate-rise space-y-0.5 text-lg text-[#cfccc4] [animation-delay:120ms]">
        <p>They know someone clicked.</p>
        <p className="text-bone">They don't know it's you.</p>
      </div>

      <div className="card mt-8 flex animate-rise items-center gap-4 p-4 [animation-delay:180ms]">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-volt text-xl">
          🕶️
        </span>
        <div>
          <p className="font-black uppercase tracking-tight">Your identity is hidden.</p>
          <p className="text-sm text-mute">No login. {host} just sees “Anonymous Player”.</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-7" noValidate>
        <Field
          label="Your real name"
          placeholder="Sarah"
          helper="What should we reveal when they guess you? Sealed until the reveal: the one thing you can't lie about."
          error={nameError}
          value={name}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="words"
          onChange={(e) => {
            setName(e.target.value)
            setNameError(null)
          }}
        />
        <Field
          label="Other names they might guess"
          optional
          placeholder="Mike, Mikey"
          helper="Nicknames that should count as a correct guess. Comma separated."
          value={aliases}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => setAliases(e.target.value)}
        />
        <div className="flex flex-col gap-3">
          <Button type="submit" disabled={busy} className="w-full text-base">
            {busy ? 'Hiding you...' : 'Enter the game'}
          </Button>
          <p className="text-center text-sm text-mute">
            You can lie. You can troll. Just don't be abusive. <TextLink to="/rules">Rules</TextLink>
          </p>
        </div>
      </form>
    </Page>
  )
}

/* -------------------------------------------------------------------------- */
/* Participants                                                                */
/* -------------------------------------------------------------------------- */

function Session({ code, seat, onSeatLost }: { code: string; seat: Seat; onSeatLost: () => void }) {
  const game = useGame(code, seat.token)
  const { state, fatal, messages } = game
  const active = state && !state.removed ? state : null

  // Creator starts on the share screen; the room opens once someone joins.
  const [view, setView] = useState<'share' | 'room'>('share')
  const [magic, setMagic] = useState(false)
  const revealKey = `anx_revealed_${code}`
  const [revealed, setRevealed] = useState(() => store.get(revealKey) === '1')

  const guestPresent = active?.role === 'creator' ? active.guest_present : null
  const prevPresent = useRef<boolean | null>(null)
  useEffect(() => {
    if (guestPresent === null) return
    if (prevPresent.current === null) {
      // First load: go straight to the room if someone is already here
      if (guestPresent || (active && active.round > 1)) setView('room')
    } else if (!prevPresent.current && guestPresent) {
      setMagic(true)
      navigator.vibrate?.([60, 40, 60])
    }
    prevPresent.current = guestPresent
  }, [guestPresent, active])

  // Tab title nudges while the tab is in the background.
  const lastOther = [...messages].reverse().find((m) => !m.mine)?.seq ?? 0
  useAttentionTitle(lastOther, guestPresent ?? false)

  useEffect(() => {
    if (fatal === 'not_found') onSeatLost()
  }, [fatal, onSeatLost])

  if (fatal) return <NotFoundState code={code} />
  if (!state) return <Loading />

  if (state.removed) {
    return state.reason === 'blocked' ? (
      <DeadEnd title="You've been removed." cta="Make a game" code={code}>
        <p>{state.host} ended things with you. It happens.</p>
        <p className="text-bone">Think you could fool someone?</p>
      </DeadEnd>
    ) : (
      <DeadEnd title="You left the game." cta="Make a game" code={code}>
        <p>They'll never know it was you. Probably.</p>
        <p className="text-bone">Think you could fool someone?</p>
      </DeadEnd>
    )
  }

  const s = state as ActiveState

  if (s.status === 'expired') return <ExpiredState code={code} />

  if (s.status === 'cancelled') {
    return s.role === 'creator' ? (
      <DeadEnd title="Game ended." cta="Create a new game" code={code}>
        <p>You ended this game. The link doesn't work anymore.</p>
      </DeadEnd>
    ) : (
      <DeadEnd title="They ended the game." cta="Make a game" code={code}>
        <p>The mystery is over. They'll never know it was you.</p>
        <p className="text-bone">Think you could fool someone?</p>
      </DeadEnd>
    )
  }

  if (s.status === 'completed' && s.result) {
    if (!revealed) {
      return (
        <Reveal
          role={s.role}
          result={s.result}
          onDone={() => {
            store.set(revealKey, '1')
            setRevealed(true)
          }}
        />
      )
    }
    return <Result state={s} result={s.result} />
  }

  return (
    <>
      {s.role === 'creator' && view === 'share' && !s.guest_present ? (
        <ShareScreen state={s} onOpenGame={() => setView('room')} />
      ) : (
        <Room game={game} state={s} />
      )}
      {magic && (
        <MagicMoment
          onDone={() => {
            setMagic(false)
            setView('room')
          }}
        />
      )}
    </>
  )
}

function useAttentionTitle(lastOtherSeq: number, guestPresent: boolean) {
  const seen = useRef({ seq: lastOtherSeq, present: guestPresent })
  useEffect(() => {
    const base = document.title.replace(/^👀 /, '')
    const changed = lastOtherSeq > seen.current.seq || (guestPresent && !seen.current.present)
    if (document.visibilityState === 'hidden' && changed) document.title = `👀 ${base}`
    seen.current = { seq: lastOtherSeq, present: guestPresent }
    const onVisible = () => {
      if (document.visibilityState === 'visible') document.title = document.title.replace(/^👀 /, '')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [lastOtherSeq, guestPresent])
}
