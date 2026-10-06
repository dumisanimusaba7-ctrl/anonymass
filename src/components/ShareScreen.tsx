import { useNow } from '../hooks/useNow'
import { track } from '../lib/analytics'
import { clock } from '../lib/format'
import { copyText, displayUrl, gameUrl, shareOrCopy, shareText } from '../lib/share'
import type { ActiveState } from '../lib/types'
import { useToast } from './Toasts'
import { Button, Page, StatusDot } from './ui'

export function useShareLink(code: string) {
  const toast = useToast()
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    const ok = await copyText(gameUrl(code))
    track('link_copied', code)
    toast(ok ? 'Link copied. Go cause chaos.' : "Couldn't copy. Long-press the link instead.", ok ? 'info' : 'error')
  }

  async function share() {
    track('share_clicked', code)
    const outcome = await shareOrCopy(shareText.invite, gameUrl(code))
    if (outcome === 'copied') toast('Copied. Paste it anywhere.')
    if (outcome === 'failed') toast("Couldn't share. Copy the link instead.", 'error')
  }

  return { copy, share, canShare }
}

export function ShareScreen({ state, onOpenGame }: { state: ActiveState; onOpenGame: () => void }) {
  const { copy, share, canShare } = useShareLink(state.code)
  const now = useNow(1000)
  const expiresIn = (new Date(state.expires_at).getTime() - now) / 1000

  return (
    <Page footer={false}>
      <p className="eyebrow animate-rise">Game {state.code}</p>
      <h1 className="headline mt-4 animate-rise text-[clamp(3rem,15vw,5.6rem)] [animation-delay:60ms]">
        Your game
        <br />
        is <span className="text-volt">live.</span>
      </h1>

      <button
        type="button"
        onClick={copy}
        className="group mt-8 flex w-full animate-rise items-center justify-between gap-3 rounded-[12px] bg-ink-2 px-4 py-4 text-left shadow-[inset_0_0_0_2px_var(--color-line)] transition hover:shadow-[inset_0_0_0_2px_var(--color-volt)] [animation-delay:120ms]"
        aria-label={`Copy link ${displayUrl(state.code)}`}
      >
        <span className="min-w-0 break-all font-mono text-[clamp(1rem,4.6vw,1.35rem)] font-semibold">
          {displayUrl(state.code)}
        </span>
        <span className="eyebrow shrink-0 group-hover:text-volt">Copy</span>
      </button>

      <div className={`mt-4 grid animate-rise gap-3 [animation-delay:160ms] ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Button onClick={copy}>Copy link</Button>
        {canShare && (
          <Button variant="light" onClick={share}>
            Share
          </Button>
        )}
      </div>
      <Button variant="outline" className="mt-3 w-full animate-rise [animation-delay:200ms]" onClick={onOpenGame}>
        Open game <span aria-hidden="true">→</span>
      </Button>

      <ul className="mt-10 animate-rise space-y-1.5 text-lg font-semibold [animation-delay:260ms]">
        <li>Send this link to your friends.</li>
        <li>Post it on your story.</li>
        <li>Drop it in the group chat.</li>
        <li className="text-mute">Then wait...</li>
      </ul>

      <div className="card mt-8 flex animate-rise items-center gap-3 px-4 py-4 [animation-delay:320ms]" role="status">
        <StatusDot tone="idle" />
        <p className="font-bold">Waiting for someone brave enough to click...</p>
      </div>
      <p className="mt-3 font-mono text-xs text-mute">Expires in {clock(expiresIn)}</p>
    </Page>
  )
}
