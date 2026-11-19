import type { QuoteItem } from './quote-store'

export interface Details {
  name?: string
  facility?: string
  town?: string
  phone?: string
  message?: string
}

/** Plain-text quote request that reads well in WhatsApp and email. */
export function formatQuote(items: QuoteItem[], details: Details = {}) {
  const lines = ['Hello Optima, please quote for the following:', '']
  const groups = new Map<string, QuoteItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  for (const [group, list] of groups) {
    lines.push(group ? `${group}:` : 'Items:')
    for (const item of list) {
      lines.push(`- ${item.qty} x ${item.name}${item.note.trim() ? ` (${item.note.trim()})` : ''}`)
    }
    lines.push('')
  }
  if (details.message?.trim()) lines.push(details.message.trim(), '')
  const who = [details.name, details.facility, details.town].map((v) => v?.trim()).filter(Boolean).join(', ')
  if (who) lines.push(`From: ${who}`)
  if (details.phone?.trim()) lines.push(`Phone: ${details.phone.trim()}`)
  return lines.join('\n').trim()
}
