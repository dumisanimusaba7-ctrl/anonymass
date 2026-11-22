import { onPage, reducedMotion } from './motion'

// Horizontal tab/chip rows ([data-scroller]):
// - a marker slides to the active item (aria-selected or aria-pressed)
// - the active item scrolls into the middle of the row
// - a thin rail shows how far along the row you are, and that there is more

const ACTIVE = '[aria-selected="true"], [aria-pressed="true"]'

onPage(() => {
  const cleanups: Array<() => void> = []

  for (const root of document.querySelectorAll<HTMLElement>('[data-scroller]')) {
    const track = root.querySelector<HTMLElement>('[data-scroller-track]')
    if (!track) continue
    const indicator = track.querySelector<HTMLElement>('[data-scroller-indicator]')
    const rail = root.querySelector<HTMLElement>('.scroller__rail')
    const thumb = rail?.querySelector<HTMLElement>('span')
    let frame = 0

    const active = () => track.querySelector<HTMLElement>(ACTIVE)

    const placeIndicator = (animate: boolean) => {
      const el = active()
      if (!indicator || !el || getComputedStyle(indicator).display === 'none') return
      if (!animate || reducedMotion()) indicator.style.transition = 'none'
      indicator.style.width = `${el.offsetWidth}px`
      indicator.style.height = `${el.offsetHeight}px`
      indicator.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`
      if (!animate || reducedMotion()) {
        void indicator.offsetWidth
        indicator.style.transition = ''
      }
    }

    const updateRail = () => {
      frame = 0
      if (!rail || !thumb) return
      const max = track.scrollWidth - track.clientWidth
      const scrollable = max > 2 && getComputedStyle(track).overflowX !== 'visible'
      rail.hidden = !scrollable
      if (!scrollable) return
      const ratio = track.clientWidth / track.scrollWidth
      const railWidth = rail.clientWidth
      const thumbWidth = Math.max(28, railWidth * ratio)
      thumb.style.setProperty('--thumb-w', `${thumbWidth}px`)
      thumb.style.setProperty('--thumb-x', `${(track.scrollLeft / max) * (railWidth - thumbWidth)}px`)
    }

    const centreActive = (smooth: boolean) => {
      const el = active()
      if (!el || track.scrollWidth <= track.clientWidth) return
      const left = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2
      track.scrollTo({ left, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateRail)
    }
    const onResize = () => {
      placeIndicator(false)
      updateRail()
    }
    const observer = new MutationObserver(() => {
      placeIndicator(true)
      centreActive(true)
    })
    observer.observe(track, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] })
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    if (indicator) root.classList.add('has-indicator')
    placeIndicator(false)
    centreActive(false)
    updateRail()
    // Fonts can change item widths after first paint.
    document.fonts?.ready.then(onResize)

    cleanups.push(() => {
      observer.disconnect()
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frame)
    })
  }

  return () => cleanups.forEach((fn) => fn())
})
