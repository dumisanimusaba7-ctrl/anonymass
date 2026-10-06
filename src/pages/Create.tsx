import { useEffect, useState, type FormEvent } from 'react'
import { useToast } from '../components/Toasts'
import { Button, Field, Page } from '../components/ui'
import { track } from '../lib/analytics'
import { api, ApiError } from '../lib/api'
import { errorCopy } from '../lib/errors'
import { saveSeat } from '../lib/identity'
import { navigate } from '../lib/router'
import type { Difficulty } from '../lib/types'

const LEVELS: Array<{ id: Difficulty; label: string; blurb: string }> = [
  { id: 'easy', label: 'Easy', blurb: 'Hints whenever you want them.' },
  { id: 'normal', label: 'Normal', blurb: 'Hints unlock after 45 seconds.' },
  { id: 'evil', label: 'Evil', blurb: 'Hints are rare. Good luck.' },
]

export default function Create() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => track('create_viewed'), [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('We need a name. First name is fine.')
      return
    }
    setBusy(true)
    try {
      const { code, token } = await api.createGame(name.trim(), nickname.trim() || null, difficulty)
      saveSeat(code, { token, role: 'creator' })
      navigate(`/g/${code}`)
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError('unknown')
      if (e.code === 'invalid_name') setNameError(errorCopy(e.code))
      else toast(errorCopy(e.code, e.retryAfter), 'error')
      setBusy(false)
    }
  }

  return (
    <Page>
      <h1 className="headline animate-rise text-[clamp(2.6rem,12vw,4.6rem)]">
        Let's make this <span className="text-volt">interesting.</span>
      </h1>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-8" noValidate>
        <Field
          label="Your name"
          placeholder="Dumisani"
          helper="Shown to whoever clicks your link, so they know whose game they walked into."
          error={nameError}
          value={name}
          maxLength={40}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          onChange={(e) => {
            setName(e.target.value)
            setNameError(null)
          }}
        />
        <Field
          label="Your nickname"
          optional
          placeholder="Dumi"
          helper="If your friends call you something else."
          value={nickname}
          maxLength={40}
          autoComplete="nickname"
          autoCapitalize="words"
          onChange={(e) => setNickname(e.target.value)}
        />

        <fieldset>
          <legend className="text-sm font-extrabold uppercase tracking-tight">How hard should this be?</legend>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup">
            {LEVELS.map((level) => {
              const selected = level.id === difficulty
              return (
                <button
                  key={level.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDifficulty(level.id)}
                  className={`flex min-h-16 items-center justify-center rounded-[10px] px-2 text-base font-black uppercase tracking-tight transition active:scale-[0.97] ${
                    selected
                      ? 'bg-volt text-ink'
                      : 'bg-ink-2 text-bone shadow-[inset_0_0_0_2px_var(--color-line)] hover:shadow-[inset_0_0_0_2px_#3a3a3a]'
                  }`}
                >
                  {level.label}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-mute" aria-live="polite">
            {LEVELS.find((l) => l.id === difficulty)?.blurb}
          </p>
        </fieldset>

        <div className="flex flex-col gap-3">
          <Button type="submit" disabled={busy} className="w-full text-base">
            {busy ? 'Making your link...' : 'Create my link'}
          </Button>
          <p className="text-center text-sm text-mute">No account required. Your game lasts 24 hours.</p>
        </div>
      </form>
    </Page>
  )
}
