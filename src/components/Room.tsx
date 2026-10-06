import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { GameController, PendingMessage } from '../hooks/useGame'
import { useNow } from '../hooks/useNow'
import { useVisualViewport } from '../hooks/useVisualViewport'
import { errorCopy } from '../lib/errors'
import { clock, pick } from '../lib/format'
import { displayUrl } from '../lib/share'
import {
  HINT_CATEGORIES,
  REPORT_CATEGORIES,
  type ActiveState,
  type HintCategory,
  type Message,
  type ReportCategory,
} from '../lib/types'
import { useShareLink } from './ShareScreen'
import { useToast } from './Toasts'
import { Button, Dialog, Logo, StatusDot } from './ui'

const MAX_LENGTH = 500

const CREATOR_PROMPTS = ['Did we go to school together?', 'Do I have your number?', 'Have we met this month?']

const TROLL_PROMPTS = [
  'Insist you met at a wedding. Confidently.',
  "Claim you're their neighbour.",
  "Give a 'hint' that's completely made up.",
  'Answer every question with a question.',
  'Pretend you have never met. Ever.',
  "Say 'you'll never guess' and mean it.",
]

// Four equal cells on phones (labels may wrap to two lines), a row on bigger screens.
const GUEST_CHIP =
  'chip !min-h-11 justify-center !whitespace-normal !px-1.5 text-center !text-[0.68rem] leading-tight sm:!px-3 sm:!text-[0.78rem]'

const categoryLabel = (c: HintCategory | null) => HINT_CATEGORIES.find(([id]) => id === c)?.[1] ?? null

export function Room({ game, state }: { game: GameController; state: ActiveState }) {
  useVisualViewport()
  const toast = useToast()
  const creator = state.role === 'creator'
  const now = useNow(1000, game.skew)
  const live = state.status === 'active' || state.status === 'guessing'
  const { messages, pending } = game

  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'text' | 'hint'>('text')
  const [category, setCategory] = useState<HintCategory | null>(null)
  const [placeholder, setPlaceholder] = useState(creator ? 'Ask a question...' : "Answer... or don't.")
  const [guessOpen, setGuessOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | 'leave' | 'block'>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const compact = useCompactViewport()

  // A guess dialog can't survive a reload, so don't leave the guest staring at
  // "they think they know who you are" forever.
  const staleGuessing = useRef(creator && state.status === 'guessing')
  const setGuessing = game.setGuessing
  useEffect(() => {
    if (!staleGuessing.current) return
    staleGuessing.current = false
    void setGuessing(false)
  }, [setGuessing])

  // The room is a fixed full-screen layout; stop the page behind it scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const mutedFor = state.muted_until ? Math.ceil((new Date(state.muted_until).getTime() - now) / 1000) : 0
  const elapsed = state.round_started_at ? (now - new Date(state.round_started_at).getTime()) / 1000 : 0
  const hintWait = state.hint.next_at ? Math.max(0, Math.ceil((new Date(state.hint.next_at).getTime() - now) / 1000)) : 0

  // Has the guesser asked for a hint the guest hasn't answered yet?
  const hintPending = useMemo(() => {
    let lastRequest = -1
    let lastHint = -1
    messages.forEach((m, i) => {
      if (m.kind === 'hint_request') lastRequest = i
      if (m.kind === 'hint') lastHint = i
    })
    return lastRequest > lastHint
  }, [messages])

  function focusInput(text?: string) {
    if (text) setPlaceholder(text)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function startHint() {
    setMode('hint')
    setPlaceholder('Drop a hint. True or not.')
    focusInput()
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || !live || mutedFor > 0) return
    setDraft('')
    const sentMode = mode
    if (sentMode === 'hint') {
      setMode('text')
      setCategory(null)
      setPlaceholder("Answer... or don't.")
    }
    const res = await game.send(text, sentMode, sentMode === 'hint' ? category : null)
    if (!res.ok) {
      setDraft((d) => d || text)
      toast(errorCopy(res.error, res.retry_after), 'error')
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  async function askHint() {
    const res = await game.requestHint()
    if (!res.ok) toast(errorCopy(res.error, res.retry_after), 'error')
  }

  async function stayMysterious() {
    const res = await game.send('', 'mysterious')
    if (!res.ok) toast(errorCopy(res.error, res.retry_after), 'error')
  }

  function openGuess() {
    setGuessOpen(true)
    void game.setGuessing(true)
  }

  // Auto-resize the textarea
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [draft])

  const statusLine = (() => {
    if (game.offline) return { tone: 'off' as const, text: 'You disappeared 👻 Reconnecting...' }
    if (creator && !state.guest_present) {
      return {
        tone: 'idle' as const,
        text: state.round > 1 ? 'The other end disappeared 👻' : 'Waiting for someone brave enough to click...',
      }
    }
    if (!state.other_online) return { tone: 'idle' as const, text: 'The other end went quiet 👻' }
    return { tone: 'live' as const, text: creator ? 'Someone is here.' : "They're here. They don't know it's you." }
  })()

  const hintLabel = state.hint.remaining <= 0 ? 'No hints left' : hintWait > 0 ? `Hint in ${clock(hintWait)}` : 'Give me a hint'

  return (
    <div className="fixed inset-x-0 top-[var(--vvt,0px)] flex h-[var(--vvh,100dvh)] bg-ink">
      {/* Chat column */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Game room">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 lg:hidden">
          <Logo className="!text-sm" />
          <div className="flex items-center gap-1">
            {state.round_started_at && (
              <span className="font-mono text-sm tabular-nums text-mute" aria-label={`Time elapsed ${clock(elapsed)}`}>
                {clock(elapsed)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Game menu: report, block or leave"
              className="ml-2 grid h-10 w-10 place-items-center rounded-lg text-xl font-black hover:bg-ink-3"
            >
              <span aria-hidden="true">⋯</span>
            </button>
          </div>
        </header>

        <div className={`shrink-0 border-b border-line px-4 py-3 lg:px-8 lg:py-6 ${compact ? 'hidden' : ''}`}>
          <div className="mx-auto max-w-3xl">
            <h1 className="text-lg font-black uppercase leading-tight tracking-[-0.02em] lg:text-5xl lg:tracking-[-0.04em]">
              {creator ? "Who's on the other end?" : 'Keep them guessing.'}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-mute" role="status" aria-live="polite">
              <StatusDot tone={statusLine.tone} />
              {statusLine.text}
            </p>
          </div>
        </div>

        {!creator && state.status === 'guessing' && (
          <div
            className="shrink-0 animate-pop bg-volt px-4 py-2.5 text-center text-sm font-extrabold uppercase text-ink"
            role="alert"
          >
            😬 They think they know who you are...
          </div>
        )}
        {!creator && state.status === 'active' && hintPending && mode !== 'hint' && (
          <div className="flex shrink-0 animate-pop items-center justify-between gap-3 border-b border-line bg-ink-2 px-4 py-2">
            <p className="text-sm font-bold">They're begging for a hint 🙏</p>
            <Button size="sm" onClick={startHint}>
              Give a hint
            </Button>
          </div>
        )}

        <MessageList
          state={state}
          messages={messages}
          pending={pending}
          otherTyping={game.otherTyping}
          onPrompt={(text) => {
            setDraft(text)
            focusInput()
          }}
        />

        {/* Controls */}
        <div className="shrink-0 border-t border-line bg-ink">
          {creator ? (
            <div className="mx-auto flex max-w-3xl gap-2 px-3 pt-3 lg:px-8">
              <Button
                variant="outline"
                className="!min-h-12 shrink-0 !px-3 !text-xs"
                onClick={askHint}
                disabled={!live || state.hint.remaining <= 0 || hintWait > 0}
                aria-label={hintLabel}
              >
                <span aria-hidden="true">🔍</span> {hintLabel}
              </Button>
              <Button className="!min-h-12 flex-1 whitespace-nowrap !px-4" onClick={openGuess} disabled={!live}>
                I know who you are
              </Button>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-3 pt-3 lg:px-8">
              <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2" role="toolbar" aria-label="Keep them guessing">
                <button
                  type="button"
                  className={GUEST_CHIP}
                  aria-pressed={mode === 'text'}
                  onClick={() => {
                    setMode('text')
                    setCategory(null)
                    focusInput("Answer... or don't.")
                  }}
                >
                  Answer
                </button>
                <button type="button" className={GUEST_CHIP} aria-pressed={mode === 'hint'} onClick={startHint}>
                  Give a hint
                </button>
                <button type="button" className={GUEST_CHIP} onClick={stayMysterious} disabled={!live}>
                  Stay mysterious
                </button>
                <button
                  type="button"
                  className={GUEST_CHIP}
                  onClick={() => {
                    setMode('text')
                    setCategory(null)
                    focusInput(pick(TROLL_PROMPTS))
                  }}
                >
                  Troll them
                </button>
              </div>
              {mode === 'hint' && (
                <div
                  className="no-scrollbar -mx-3 mt-2 flex animate-pop gap-1.5 overflow-x-auto px-3"
                  role="group"
                  aria-label="Hint category (optional)"
                >
                  {HINT_CATEGORIES.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className="chip !min-h-8 !text-[0.7rem]"
                      aria-pressed={category === id}
                      onClick={() => {
                        setCategory(category === id ? null : id)
                        focusInput()
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={submit}
            className="mx-auto flex max-w-3xl items-end gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:px-8 lg:pb-6"
          >
            <div className="relative min-w-0 flex-1">
              {mode === 'hint' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('text')
                    setCategory(null)
                  }}
                  className="absolute -top-0 right-2 z-10 -translate-y-1/2 rounded-md bg-volt px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-ink"
                  aria-label="Cancel hint"
                >
                  Hint{category ? ` · ${categoryLabel(category)}` : ''} ✕
                </button>
              )}
              <label htmlFor="composer" className="sr-only">
                {mode === 'hint' ? 'Write a hint' : creator ? 'Ask a question' : 'Message'}
              </label>
              <textarea
                id="composer"
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={MAX_LENGTH}
                enterKeyHint="send"
                disabled={!live}
                placeholder={
                  !live
                    ? creator
                      ? 'Waiting for someone to join...'
                      : 'Hang tight...'
                    : mutedFor > 0
                      ? `Cooling off... ${mutedFor}s`
                      : placeholder
                }
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (e.target.value) game.sendTyping()
                }}
                onKeyDown={onKeyDown}
                className={`input block max-h-[132px] min-h-12 resize-none !py-3 !text-base leading-snug disabled:opacity-50 ${
                  mode === 'hint' ? '!shadow-[inset_0_0_0_2px_var(--color-volt)]' : ''
                }`}
              />
              {draft.length > MAX_LENGTH - 100 && (
                <span
                  className="pointer-events-none absolute bottom-1 right-2 font-mono text-[0.65rem] text-mute"
                  aria-live="polite"
                >
                  {draft.length}/{MAX_LENGTH}
                </span>
              )}
            </div>
            <button
              type="submit"
              aria-label="Send message"
              disabled={!live || !draft.trim() || mutedFor > 0}
              onPointerDown={(e) => e.preventDefault()}
              className="btn btn-primary !min-h-12 w-12 shrink-0 !px-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      <SidePanel
        state={state}
        elapsed={elapsed}
        now={now}
        onReport={() => setReportOpen(true)}
        onBlock={() => setConfirm('block')}
        onLeave={() => setConfirm('leave')}
      />

      {/* Dialogs */}
      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} label="Game menu">
        <p className="eyebrow">Game {state.code}</p>
        <div className="mt-5 flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setMenuOpen(false)
              setReportOpen(true)
            }}
          >
            Report
          </Button>
          {creator && state.guest_present && (
            <Button
              variant="outline"
              onClick={() => {
                setMenuOpen(false)
                setConfirm('block')
              }}
            >
              Block this person
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => {
              setMenuOpen(false)
              setConfirm('leave')
            }}
          >
            {creator ? 'End game' : 'Leave game'}
          </Button>
          <button type="button" className="link mt-1 text-sm text-mute" onClick={() => setMenuOpen(false)}>
            Back to the game
          </button>
        </div>
        <p className="mt-6 text-xs text-mute">You can lie. You can troll. You can stay mysterious. Just don't be abusive.</p>
      </Dialog>

      <GuessDialog
        open={guessOpen}
        onCancel={() => {
          setGuessOpen(false)
          void game.setGuessing(false)
        }}
        onSubmit={async (guess) => {
          const res = await game.submitGuess(guess)
          if (!res.ok) {
            toast(errorCopy(res.error, res.retry_after), 'error')
            return false
          }
          return true
        }}
      />

      <ReportDialog
        open={reportOpen}
        creator={creator}
        canBlock={creator && state.guest_present}
        onClose={() => setReportOpen(false)}
        onSubmit={async (category, description, alsoEnd) => {
          const res = await game.report(category, description)
          if (!res.ok) {
            toast(res.error === 'rate_limited' ? "You've already reported this game." : errorCopy(res.error), 'error')
            return
          }
          setReportOpen(false)
          toast("Thanks. We'll look into it.")
          if (alsoEnd) {
            if (creator) await game.block()
            else await game.leave()
          }
        }}
      />

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        label={confirm === 'block' ? 'Block this person' : 'Leave game'}
      >
        {confirm === 'block' ? (
          <>
            <h2 className="headline text-4xl">Block them?</h2>
            <p className="mt-3 text-mute">
              They're removed from your game and can't come back. Your link stays live for someone else.
            </p>
          </>
        ) : creator ? (
          <>
            <h2 className="headline text-4xl">End this game?</h2>
            <p className="mt-3 text-mute">Your link stops working. Nobody gets revealed.</p>
          </>
        ) : (
          <>
            <h2 className="headline text-4xl">Leave?</h2>
            <p className="mt-3 text-mute">You'll disappear and they'll never know it was you.</p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="danger"
            onClick={async () => {
              const action = confirm
              setConfirm(null)
              const res = action === 'block' ? await game.block() : await game.leave()
              if (!res.ok) toast(errorCopy(res.error), 'error')
              else if (action === 'block') toast('Blocked. Your link is still live.')
            }}
          >
            {confirm === 'block' ? 'Block' : creator ? 'End game' : 'Leave game'}
          </Button>
          <Button variant="outline" onClick={() => setConfirm(null)}>
            Stay
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

/** True when the visible viewport is short, e.g. while the keyboard is open. */
function useCompactViewport() {
  const read = () => (window.visualViewport?.height ?? window.innerHeight) < 560
  const [compact, setCompact] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    const update = () => setCompact(read())
    vv?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return compact
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

function MessageList({
  state,
  messages,
  pending,
  otherTyping,
  onPrompt,
}: {
  state: ActiveState
  messages: Message[]
  pending: PendingMessage[]
  otherTyping: boolean
  onPrompt: (text: string) => void
}) {
  const creator = state.role === 'creator'
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [unseen, setUnseen] = useState(false)
  const lastCount = useRef(messages.length)

  const scrollToBottom = (smooth = false) => {
    const el = ref.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  useLayoutEffect(() => {
    const grew = messages.length > lastCount.current
    lastCount.current = messages.length
    if (stick.current || pending.length) {
      scrollToBottom()
    } else if (grew) {
      setUnseen(true)
    }
  }, [messages.length, pending.length, otherTyping])

  // Keep the latest message visible when the keyboard opens.
  useEffect(() => {
    const vv = window.visualViewport
    const onResize = () => stick.current && scrollToBottom()
    vv?.addEventListener('resize', onResize)
    return () => vv?.removeEventListener('resize', onResize)
  }, [])

  const otherLabel = creator ? 'Anonymous' : 'The Guessing Machine'
  const waiting = creator && !state.guest_present

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          if (stick.current) setUnseen(false)
        }}
        className="h-full overflow-y-auto overscroll-contain px-4 py-4 lg:px-8"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {waiting ? (
          <WaitingPanel state={state} />
        ) : messages.length === 0 && pending.length === 0 ? (
          <EmptyChat creator={creator} me={state.me} onPrompt={onPrompt} />
        ) : (
          <ol className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {messages.map((m, i) => (
              <MessageItem key={m.seq} m={m} prev={messages[i - 1]} creator={creator} otherLabel={otherLabel} />
            ))}
            {pending.map((p) => (
              <MessageItem
                key={`p${p.id}`}
                m={{ seq: -p.id, mine: true, kind: p.kind, category: p.category, content: p.content, at: '' }}
                prev={messages[messages.length - 1]}
                creator={creator}
                otherLabel={otherLabel}
                pending
              />
            ))}
          </ol>
        )}
        {otherTyping && !waiting && (
          <p className="mx-auto mt-3 flex max-w-3xl items-center gap-2 text-sm text-mute">
            <span className="flex gap-1" aria-hidden="true">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            Someone is typing...
          </p>
        )}
      </div>
      {unseen && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom(true)
            setUnseen(false)
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 animate-pop rounded-full bg-bone px-4 py-2 text-xs font-extrabold uppercase text-ink shadow-lg"
        >
          New messages ↓
        </button>
      )}
    </div>
  )
}

function MessageItem({
  m,
  prev,
  creator,
  otherLabel,
  pending = false,
}: {
  m: Message
  prev?: Message
  creator: boolean
  otherLabel: string
  pending?: boolean
}) {
  if (m.kind === 'hint_request' || m.kind === 'mysterious') {
    const text =
      m.kind === 'hint_request'
        ? creator
          ? 'You asked for a hint 🔍'
          : 'They want a hint 🔍'
        : creator
          ? '🤫 Anonymous is staying mysterious.'
          : "🤫 You're staying mysterious."
    return (
      <li className="my-2 flex animate-msg-in justify-center">
        <span className="rounded-full border border-line px-3 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-mute">
          {text}
        </span>
      </li>
    )
  }

  const showLabel =
    !prev ||
    prev.mine !== m.mine ||
    prev.kind === 'hint_request' ||
    prev.kind === 'mysterious' ||
    prev.kind === 'hint' ||
    m.kind === 'hint'
  const label = m.mine ? 'You' : otherLabel

  return (
    <li className={`flex animate-msg-in flex-col ${m.mine ? 'items-end' : 'items-start'} ${showLabel ? 'mt-2' : ''}`}>
      {showLabel && (
        <span className="mb-1 font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-dim">{label}</span>
      )}
      {m.kind === 'hint' ? (
        <div className={`max-w-[85%] rounded-xl border border-volt/50 bg-volt/10 px-4 py-2.5 ${pending ? 'opacity-60' : ''}`}>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-volt">
            {m.mine ? 'Your hint' : 'Hint'}
            {m.category ? ` · ${categoryLabel(m.category)}` : ''}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.98rem] font-semibold">{m.content}</p>
        </div>
      ) : (
        <p
          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2 text-[0.98rem] font-medium leading-snug ${
            m.mine ? 'bg-bone text-ink' : 'bg-ink-3 text-bone'
          } ${pending ? 'opacity-60' : ''}`}
          title={m.at ? new Date(m.at).toLocaleTimeString() : undefined}
        >
          {m.content}
        </p>
      )}
      {pending && <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-dim">Sending...</span>}
    </li>
  )
}

function EmptyChat({ creator, me, onPrompt }: { creator: boolean; me: string; onPrompt: (text: string) => void }) {
  if (creator) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 text-center">
        <div className="space-y-1 text-xl font-bold leading-snug">
          <p>You know them.</p>
          <p>They know you.</p>
          <p className="text-mute">Neither of you knows who is typing.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {CREATOR_PROMPTS.map((p) => (
            <button key={p} type="button" className="chip !normal-case !font-semibold" onClick={() => onPrompt(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-volt">You are {me}</p>
      <p className="text-xl font-bold leading-snug">
        They have no idea it's you.
        <br />
        <span className="text-mute">Your real name is sealed 🔒</span>
      </p>
      <p className="max-w-xs text-sm text-mute">You can lie. You can troll. You can stay mysterious. Just don't be abusive.</p>
    </div>
  )
}

function WaitingPanel({ state }: { state: ActiveState }) {
  const { copy, share, canShare } = useShareLink(state.code)
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 text-center">
      {state.round > 1 ? (
        <>
          <p className="text-4xl" aria-hidden="true">
            👻
          </p>
          <p className="text-xl font-bold">The other end disappeared.</p>
          <p className="text-mute">Your link is still live. Waiting for someone else brave enough to click...</p>
        </>
      ) : (
        <>
          <span className="flex gap-1.5 text-volt" aria-hidden="true">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
          <p className="text-xl font-bold">Waiting for someone brave enough to click...</p>
        </>
      )}
      <p className="break-all font-mono text-sm text-bone">{displayUrl(state.code)}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={copy}>
          Copy link
        </Button>
        {canShare && (
          <Button size="sm" variant="light" onClick={share}>
            Share
          </Button>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Desktop side panel                                                          */
/* -------------------------------------------------------------------------- */

function SidePanel({
  state,
  elapsed,
  now,
  onReport,
  onBlock,
  onLeave,
}: {
  state: ActiveState
  elapsed: number
  now: number
  onReport: () => void
  onBlock: () => void
  onLeave: () => void
}) {
  const creator = state.role === 'creator'
  const { copy } = useShareLink(state.code)
  const expiresIn = (new Date(state.expires_at).getTime() - now) / 1000
  const rows: Array<[string, string]> = [
    ['Questions', String(state.counts.questions)],
    ['Hints', `${state.counts.hints_requested} / ${state.hint.max}`],
    ['Difficulty', state.difficulty],
    ['Expires in', clock(expiresIn)],
  ]

  return (
    <aside
      className="hidden w-80 shrink-0 flex-col gap-8 overflow-y-auto border-l border-line bg-ink-2/50 p-6 lg:flex xl:w-96"
      aria-label="Game status"
    >
      <Logo />
      <div>
        <p className="eyebrow">Game status</p>
        <p className="mt-2 font-mono text-5xl font-bold tabular-nums" aria-label={`Time elapsed ${clock(elapsed)}`}>
          {clock(state.round_started_at ? elapsed : 0)}
        </p>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-mute">{k}</dt>
              <dd className="font-mono font-semibold uppercase">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border border-line p-4 text-sm leading-relaxed">
        <p className="font-extrabold uppercase">Lying is allowed.</p>
        <p className="mt-1 text-mute">You can lie. You can troll. You can stay mysterious. Just don't be abusive.</p>
      </div>

      {creator && (
        <div>
          <p className="eyebrow">Your link</p>
          <button type="button" onClick={copy} className="link mt-2 break-all text-left font-mono text-sm">
            {displayUrl(state.code)}
          </button>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="outline" size="sm" onClick={onReport}>
          Report
        </Button>
        {creator && state.guest_present && (
          <Button variant="outline" size="sm" onClick={onBlock}>
            Block this person
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={onLeave}>
          {creator ? 'End game' : 'Leave game'}
        </Button>
      </div>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */
/* Dialogs                                                                     */
/* -------------------------------------------------------------------------- */

function GuessDialog({
  open,
  onCancel,
  onSubmit,
}: {
  open: boolean
  onCancel: () => void
  onSubmit: (guess: string) => Promise<boolean>
}) {
  const [guess, setGuess] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (open) {
      setGuess('')
      setBusy(false)
    }
  }, [open])

  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} label="Make your guess">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!guess.trim()) {
            setShake(true)
            window.setTimeout(() => setShake(false), 400)
            return
          }
          setBusy(true)
          const ok = await onSubmit(guess.trim())
          if (!ok) setBusy(false)
        }}
      >
        <h2 className="headline text-[clamp(2.6rem,12vw,3.6rem)]">Who is it?</h2>
        <label htmlFor="guess" className="sr-only">
          Their name
        </label>
        <input
          id="guess"
          className={`input mt-6 !text-2xl ${shake ? 'animate-shake' : ''}`}
          placeholder="Michael"
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          maxLength={60}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
        />
        <p className="mt-4 flex items-center gap-2 text-sm font-bold text-volt">
          <span aria-hidden="true">⚠</span> You only get ONE final guess.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Locking it in...' : 'Make the guess'}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Not yet
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ReportDialog({
  open,
  creator,
  canBlock,
  onClose,
  onSubmit,
}: {
  open: boolean
  creator: boolean
  canBlock: boolean
  onClose: () => void
  onSubmit: (category: ReportCategory, description: string, alsoEnd: boolean) => Promise<void>
}) {
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [description, setDescription] = useState('')
  const [alsoEnd, setAlsoEnd] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory(null)
      setDescription('')
      setAlsoEnd(true)
      setBusy(false)
    }
  }, [open])

  const showAlsoEnd = creator ? canBlock : true

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} label="Report this game">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!category) return
          setBusy(true)
          await onSubmit(category, description, showAlsoEnd && alsoEnd)
          setBusy(false)
        }}
      >
        <h2 className="headline text-4xl">Report</h2>
        <p className="mt-2 text-sm text-mute">What's going on? We'll save a copy of this conversation for review.</p>
        <fieldset className="mt-5">
          <legend className="sr-only">Category</legend>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_CATEGORIES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip !min-h-11 justify-center"
                aria-pressed={category === id}
                onClick={() => setCategory(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="report-details" className="mt-5 block text-sm font-extrabold uppercase tracking-tight">
          Details <span className="eyebrow ml-1">Optional</span>
        </label>
        <textarea
          id="report-details"
          className="input mt-2 min-h-24 resize-none !py-3 !text-base"
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {showAlsoEnd && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--color-volt)]"
              checked={alsoEnd}
              onChange={(e) => setAlsoEnd(e.target.checked)}
            />
            {creator ? 'Also block them' : 'Also leave the game'}
          </label>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <Button type="submit" disabled={!category || busy}>
            {busy ? 'Sending...' : 'Send report'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
