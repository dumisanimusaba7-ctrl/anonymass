import { BLADES, BLADE_COLOURS, CROSS, align, toPath, type Point } from './mark-geometry'
import { clamp, easeInOut, lerp, mix, onPage, reducedMotion } from './motion'

// Hero signature: the four Optima blades assemble on arrival, then morph
// into a medical cross as the visitor scrolls out of the hero. Driven by
// scroll position, never by a timer loop.

const rotate = ([x, y]: Point, deg: number): Point => {
  const r = (deg * Math.PI) / 180
  const dx = x - 50
  const dy = y - 50
  return [50 + dx * Math.cos(r) - dy * Math.sin(r), 50 + dx * Math.sin(r) + dy * Math.cos(r)]
}

// The cross is pre-rotated by -45° so that, with the whole mark turning 45°
// during the morph, it lands upright.
const TARGETS = CROSS.map((arm, i) => align(BLADES[i], arm.map((p) => rotate(p, -45))))

onPage(() => {
  const hero = document.querySelector<HTMLElement>('[data-hero]')
  const svg = document.querySelector<SVGSVGElement>('#hero-mark')
  if (!hero || !svg) return
  const group = svg.querySelector<SVGGElement>('.mark__blades')!
  const blades = [...svg.querySelectorAll<SVGPathElement>('.mark__blade')]
  const lenses = [...hero.querySelectorAll<HTMLElement>('[data-lens]')]

  if (reducedMotion()) return

  // Arrival: blades fly in from outside and lock into the ring.
  blades.forEach((blade, i) => {
    const [cx, cy] = BLADES[i].reduce(([ax, ay], [x, y]) => [ax + x / 5, ay + y / 5], [0, 0])
    const dx = (cx - 50) * 0.9
    const dy = (cy - 50) * 0.9
    blade.style.transformBox = 'fill-box'
    blade.style.transformOrigin = 'center'
    blade.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(-40deg)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 760, delay: 120 + i * 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
    )
  })
  lenses.forEach((lens, i) =>
    lens.animate(
      [
        { transform: 'scale(.86)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 620, delay: 60 + i * 110, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
    ),
  )

  // Scroll morph: ring -> cross while the mark travels up the screen, from
  // where it first sits (or 60% down, if lower) to just under the header.
  const markPageTop = svg.getBoundingClientRect().top + window.scrollY
  let frame = 0
  let last = -1
  const update = () => {
    frame = 0
    const headerBottom = document.querySelector('[data-header]')?.getBoundingClientRect().bottom ?? 0
    const from = Math.min(markPageTop, window.innerHeight * 0.6)
    const to = headerBottom + 16
    const top = markPageTop - window.scrollY
    const t = clamp((from - top) / Math.max(1, from - to))
    if (Math.abs(t - last) < 0.001) return
    last = t
    const e = easeInOut(t)
    blades.forEach((blade, i) => {
      const pts = BLADES[i].map(([x, y], j): Point => [lerp(x, TARGETS[i][j][0], e), lerp(y, TARGETS[i][j][1], e)])
      const colour = mix(BLADE_COLOURS[i], '#ffffff', e)
      blade.setAttribute('d', toPath(pts))
      blade.setAttribute('fill', colour)
      blade.setAttribute('stroke', colour)
    })
    group.style.transform = `rotate(${45 * e}deg) scale(${1 + 0.06 * Math.sin(Math.PI * e)})`
  }
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update)
  }

  let active = false
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting === active) return
    active = entry.isIntersecting
    if (active) {
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    } else window.removeEventListener('scroll', onScroll)
  })
  io.observe(hero)
  update()

  return () => {
    io.disconnect()
    window.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(frame)
  }
})
