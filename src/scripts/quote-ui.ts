import { quote, type QuoteItem } from './quote-store'
import { onPage, reducedMotion } from './motion'

// Wires every "Add to quote" control and every quote counter on the page.
// Controls carry their item in data attributes:
//   <button data-add-quote data-id="gloves" data-name="Gloves" data-group="Consumables and PPE">

const live = () => document.querySelector<HTMLElement>('.quote-live')

function renderCounts(bump = false) {
  const n = quote.count()
  document.querySelectorAll<HTMLElement>('[data-quote-count]').forEach((el) => {
    el.textContent = String(n)
    el.dataset.count = String(n)
    el.setAttribute('aria-label', `${n} ${n === 1 ? 'item' : 'items'}`)
    if (bump && !reducedMotion()) {
      el.classList.remove('is-bumped')
      void el.offsetWidth
      el.classList.add('is-bumped')
    }
  })
}

function syncControls() {
  document.querySelectorAll<HTMLElement>('[data-add-quote]').forEach((el) => {
    const on = quote.has(el.dataset.id!)
    if (el instanceof HTMLInputElement) el.checked = on
    else el.setAttribute('aria-pressed', String(on))
  })
}

/** The quote control a visitor can currently see: header on desktop, bottom bar on phones. */
function visibleTarget(): HTMLElement | null {
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('.mobile-bar__quote, [data-quote-target]'),
  ]
  return candidates.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) ?? null
}

function fly(from: HTMLElement) {
  const target = visibleTarget()
  if (!target || reducedMotion()) return
  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const x0 = a.left + a.width / 2
  const y0 = a.top + a.height / 2
  const x1 = b.left + b.width / 2
  // If the header is still sliding back in, aim for where it will settle.
  const header = target.closest<HTMLElement>('[data-header]')
  const y1 = b.top + b.height / 2 - (header ? header.getBoundingClientRect().top : 0)
  const dot = document.createElement('div')
  dot.className = 'quote-fly'
  dot.setAttribute('aria-hidden', 'true')
  document.body.append(dot)
  const lift = Math.min(160, Math.abs(y1 - y0) * 0.4 + 60)
  const midX = (x0 + x1) / 2
  const midY = Math.min(y0, y1) - lift
  dot
    .animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${midX}px, ${midY}px) scale(1)`, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.45)`, opacity: 0.9 },
      ],
      { duration: 620, easing: 'cubic-bezier(.45,0,.25,1)' },
    )
    .finished.finally(() => dot.remove())
}

function toggle(el: HTMLElement) {
  const item: Omit<QuoteItem, 'qty' | 'note'> = {
    id: el.dataset.id!,
    name: el.dataset.name!,
    group: el.dataset.group ?? '',
  }
  if (quote.has(item.id)) {
    quote.remove(item.id)
    navigator.vibrate?.([6, 40, 6])
    live()!.textContent = `${item.name} removed from your quote list.`
  } else {
    quote.add(item)
    navigator.vibrate?.(12)
    // Make sure the counter the dot flies to is on screen.
    window.dispatchEvent(new Event('header:show'))
    fly(el)
    live()!.textContent = `${item.name} added to your quote list. ${quote.count()} on the list.`
  }
}

// Event delegation is registered once; it survives client-side navigation.
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('button[data-add-quote]')
  if (el) toggle(el)
})
document.addEventListener('change', (e) => {
  const el = e.target as HTMLElement
  if (el instanceof HTMLInputElement && el.matches('[data-add-quote]')) toggle(el)
})

quote.onChange(() => {
  renderCounts(true)
  syncControls()
})

onPage(() => {
  renderCounts()
  syncControls()
})
