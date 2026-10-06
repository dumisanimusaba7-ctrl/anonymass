export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers / insecure contexts
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

/** Web Share API where available, clipboard otherwise. */
export async function shareOrCopy(text: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(`${text}\n${url}`)) ? 'copied' : 'failed'
}

export const gameUrl = (code: string) => `${location.origin}/g/${code}`
export const displayUrl = (code: string) => `${location.host}/g/${code}`
export const homeUrl = () => `${location.origin}/`

export const shareText = {
  invite: 'How well do you know me? 👀\nSomeone who clicks this has to try to fool me.\nThink you can beat me?',
  played: 'I just got played 💀\nI thought I knew who it was.\nTry your own:',
  gotThem: (time: string, score: number) =>
    `I figured out who was hiding behind my link in ${time} 💀\nApparently I know them ${score}%.\nTry your own:`,
  fooledThem: (host: string) => `I just played ${host} 😈\nThey had no idea it was me.\nTry your own:`,
  busted: (host: string) => `${host} figured out it was me 💀\nThink you could fool someone?`,
}
