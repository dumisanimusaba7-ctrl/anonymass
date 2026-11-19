import { onPage, reducedMotion } from './motion'

// One reveal type (fade and rise 12px), played once per element.
onPage(() => {
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)')]
  const counters = [...document.querySelectorAll<HTMLElement>('[data-count-to]')]
  const vh = window.innerHeight

  // Anything already on screen shows immediately, with no animation.
  for (const el of els) {
    if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('is-in')
  }
  document.documentElement.classList.add('reveal-ready')

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  els.filter((el) => !el.classList.contains('is-in')).forEach((el) => io.observe(el))

  // Real counts (taken from the catalogue data) tick up once.
  const co = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        co.unobserve(entry.target)
        tick(entry.target as HTMLElement)
      }
    },
    { threshold: 0.6 },
  )
  for (const el of counters) {
    if (el.getBoundingClientRect().top < vh * 0.92 || reducedMotion()) continue
    el.textContent = '0'
    co.observe(el)
  }

  return () => {
    io.disconnect()
    co.disconnect()
  }
})

function tick(el: HTMLElement) {
  const to = Number(el.dataset.countTo)
  if (reducedMotion() || !Number.isFinite(to)) {
    el.textContent = String(to)
    return
  }
  const start = performance.now()
  const duration = 700
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    el.textContent = String(Math.round(to * (1 - (1 - t) ** 3)))
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
