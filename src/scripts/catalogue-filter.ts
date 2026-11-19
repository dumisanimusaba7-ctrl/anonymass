import { onPage, reducedMotion } from './motion'
import { whatsappLink } from '../data/site'

// Product index filtering. Matching tiles slide into their new places (FLIP)
// instead of jumping; newly shown tiles fade in. State lives in the URL so a
// filtered view can be shared.

onPage(() => {
  const controls = document.querySelector<HTMLElement>('[data-filter-controls]')
  const grid = document.querySelector<HTMLElement>('[data-filter-grid]')
  if (!controls || !grid) return
  const search = controls.querySelector<HTMLInputElement>('[data-search]')!
  const chips = [...controls.querySelectorAll<HTMLButtonElement>('[data-dept]')]
  const status = controls.querySelector<HTMLElement>('[data-status]')!
  const items = [...grid.querySelectorAll<HTMLElement>('[data-filter-item]')]
  const empty = document.querySelector<HTMLElement>('[data-empty]')!
  const total = items.length

  const params = new URLSearchParams(location.search)
  let dept = params.get('dept') ?? ''
  if (!chips.some((c) => c.dataset.dept === dept)) dept = ''
  search.value = params.get('q') ?? ''

  function apply(animate: boolean) {
    const q = search.value.trim().toLowerCase()
    const words = q.split(/\s+/).filter(Boolean)
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.dept === dept)))

    const before = new Map(items.filter((el) => !el.hidden).map((el) => [el, el.getBoundingClientRect()]))
    let shown = 0
    for (const el of items) {
      const match = (!dept || el.dataset.dept === dept) && words.every((w) => el.dataset.text!.includes(w))
      el.hidden = !match
      if (match) shown++
    }

    const deptName = chips.find((c) => c.dataset.dept === dept)?.textContent?.trim()
    status.textContent =
      shown === total
        ? `Showing all ${total} categories`
        : `Showing ${shown} of ${total} categories${deptName && dept ? ` in ${deptName}` : ''}${q ? ` matching “${search.value.trim()}”` : ''}`
    empty.hidden = shown > 0
    if (!shown) {
      empty.querySelector('[data-empty-term]')!.textContent = search.value.trim()
      empty.querySelector<HTMLAnchorElement>('[data-empty-ask]')!.href = whatsappLink(
        `Hello Optima, do you supply ${search.value.trim()}?`,
      )
    }

    const url = new URL(location.href)
    dept ? url.searchParams.set('dept', dept) : url.searchParams.delete('dept')
    q ? url.searchParams.set('q', search.value.trim()) : url.searchParams.delete('q')
    history.replaceState(history.state, '', url)

    if (!animate || reducedMotion()) return
    for (const el of items) {
      if (el.hidden) continue
      const prev = before.get(el)
      const next = el.getBoundingClientRect()
      if (prev) {
        const dx = prev.left - next.left
        const dy = prev.top - next.top
        if (dx || dy)
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration: 420,
            easing: 'cubic-bezier(.2,.8,.2,1)',
          })
      } else {
        el.animate(
          [
            { opacity: 0, transform: 'scale(.96)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 300, delay: 80, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
        )
      }
    }
  }

  const onChip = (e: Event) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-dept]')
    if (!chip) return
    dept = chip.dataset.dept ?? ''
    apply(true)
  }
  let timer = 0
  const onInput = () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => apply(true), 140)
  }
  controls.addEventListener('click', onChip)
  search.addEventListener('input', onInput)
  apply(false)

  return () => {
    controls.removeEventListener('click', onChip)
    search.removeEventListener('input', onInput)
  }
})
