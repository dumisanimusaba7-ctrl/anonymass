// The quote list lives in localStorage. There is no server: the list is
// sent by the visitor as a WhatsApp message or an email.

export interface QuoteItem {
  id: string
  name: string
  group: string
  qty: number
  note: string
}

const KEY = 'optima-quote-v1'
const EVENT = 'quote:change'

function read(): QuoteItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.id === 'string') : []
  } catch {
    return []
  }
}

function write(items: QuoteItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage full or blocked: the list still works for this page view */
  }
  memory = items
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items }))
}

let memory: QuoteItem[] | null = null

export const quote = {
  all(): QuoteItem[] {
    memory ??= read()
    return memory
  },
  has(id: string) {
    return quote.all().some((i) => i.id === id)
  },
  count() {
    return quote.all().length
  },
  add(item: Omit<QuoteItem, 'qty' | 'note'> & Partial<QuoteItem>) {
    if (quote.has(item.id)) return
    write([...quote.all(), { qty: 1, note: '', ...item }])
  },
  remove(id: string) {
    write(quote.all().filter((i) => i.id !== id))
  },
  update(id: string, patch: Partial<Pick<QuoteItem, 'qty' | 'note'>>) {
    write(quote.all().map((i) => (i.id === id ? { ...i, ...patch } : i)))
  },
  clear() {
    write([])
  },
  onChange(fn: (items: QuoteItem[]) => void) {
    const handler = (e: Event) => fn((e as CustomEvent<QuoteItem[]>).detail)
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  },
}

// Keep other tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  memory = read()
  window.dispatchEvent(new CustomEvent(EVENT, { detail: memory }))
})
