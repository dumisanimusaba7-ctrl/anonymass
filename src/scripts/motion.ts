export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('')
}

/** Run `init` on every page view, including client-side navigations. */
export function onPage(init: () => void | (() => void)) {
  let cleanup: void | (() => void)
  document.addEventListener('astro:page-load', () => {
    if (typeof cleanup === 'function') cleanup()
    cleanup = init()
  })
}
