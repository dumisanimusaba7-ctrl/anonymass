import { onPage, reducedMotion } from './motion'

// Department explorer on the home page: an accessible tab set. Switching
// tabs opens the new department's photo with a circular wipe and brings its
// category list in line by line.

onPage(() => {
  const root = document.querySelector<HTMLElement>('[data-dept-selector]')
  if (!root) return
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')]

  const stage = root.querySelector<HTMLElement>('[data-dept-stage]')!
  let resize: Animation | null = null

  function select(tab: HTMLButtonElement, focus = false) {
    if (tab.getAttribute('aria-selected') === 'true') return
    const next = panels.find((p) => p.id === tab.getAttribute('aria-controls'))!
    const before = stage.getBoundingClientRect().height
    tabs.forEach((t) => {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
    })
    panels.forEach((p) => (p.hidden = p !== next))
    // The row scrolls the tab into the middle itself (see scroller.ts).
    if (focus) tab.focus({ preventScroll: true })

    if (reducedMotion()) return

    // Departments have 3 to 7 categories: ease the height change instead of
    // letting the page below jump.
    const after = stage.getBoundingClientRect().height
    resize?.cancel()
    if (Math.abs(after - before) > 1) {
      stage.style.overflow = 'hidden'
      resize = stage.animate([{ height: `${before}px` }, { height: `${after}px` }], {
        duration: 420,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      })
      resize.finished.then(() => (stage.style.overflow = '')).catch(() => {})
    }

    const lens = next.querySelector<HTMLElement>('[data-dept-lens]')
    lens?.animate(
      [
        { clipPath: 'circle(8% at 50% 50%)', transform: 'rotate(-12deg) scale(.94)' },
        { clipPath: 'circle(71% at 50% 50%)', transform: 'none' },
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    next.querySelectorAll<HTMLElement>('.dept-panel__list li, .dept-panel__summary, [data-dept-link]').forEach((el, i) =>
      el.animate(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 260, delay: 80 + i * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
      ),
    )
  }

  const onClick = (e: Event) => {
    const target = e.target as HTMLElement
    const tab = target.closest<HTMLButtonElement>('[role="tab"]')
    if (tab) return select(tab)
    // Leaving for a department page: name the photo and title so the page
    // transition morphs them into the department page header.
    const panel = target.closest<HTMLElement>('[role="tabpanel"]')
    if (panel && target.closest('a')) {
      const slug = panel.dataset.slug
      const lens = panel.querySelector<HTMLElement>('[data-dept-lens]')
      const title = root.querySelector<HTMLElement>(`#tab-${slug} .dept-tab__name`)
      if (lens) lens.style.viewTransitionName = `dept-img-${slug}`
      if (title) title.style.viewTransitionName = `dept-title-${slug}`
    }
  }
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    const keys: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    if (!(e.key in keys)) return
    e.preventDefault()
    select(tabs[(keys[e.key] + tabs.length) % tabs.length], true)
  }
  root.addEventListener('click', onClick)
  root.addEventListener('keydown', onKey)
  return () => {
    root.removeEventListener('click', onClick)
    root.removeEventListener('keydown', onKey)
  }
})
