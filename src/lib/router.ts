import { useSyncExternalStore, type MouseEvent } from 'react'

// A tiny history router. The app has five routes; a library would be overkill.

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}

export function usePath() {
  return useSyncExternalStore(subscribe, () => location.pathname)
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === location.pathname + location.search) return
  history[replace ? 'replaceState' : 'pushState'](null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

/** onClick handler for internal <a> links that keeps cmd/ctrl-click working. */
export function linkHandler(to: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
}
