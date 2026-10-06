import type { RealtimeChannel, RealtimeClient } from '@supabase/realtime-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config'

// Realtime is loaded lazily: the landing page never needs it.
let clientPromise: Promise<RealtimeClient> | null = null

function getClient() {
  clientPromise ??= import('@supabase/realtime-js').then(
    ({ RealtimeClient }) =>
      new RealtimeClient(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1`, {
        params: { apikey: SUPABASE_KEY },
        heartbeatIntervalMs: 15_000,
      }),
  )
  return clientPromise
}

export interface GameChannel {
  sendTyping(): void
  close(): void
}

interface Handlers {
  /** Server says something changed: re-fetch state. */
  onSync(): void
  onTyping(): void
  onStatus(connected: boolean): void
}

/**
 * Joins the game's broadcast topic. The topic name is a secret only
 * participants receive; payloads carry no content (state is always re-fetched
 * through the API), so nothing leaks even if a topic name did.
 */
export function joinGameChannel(topic: string, handlers: Handlers): GameChannel {
  let channel: RealtimeChannel | null = null
  let client: RealtimeClient | null = null
  let closed = false
  let subscribed = false

  getClient()
    .then((c) => {
      if (closed) return
      client = c
      channel = c
        .channel(topic, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'sync' }, () => handlers.onSync())
        .on('broadcast', { event: 'typing' }, () => handlers.onTyping())
        .subscribe((status) => {
          subscribed = status === 'SUBSCRIBED'
          handlers.onStatus(subscribed)
          if (subscribed) handlers.onSync()
        })
    })
    .catch(() => handlers.onStatus(false))

  return {
    sendTyping() {
      if (channel && subscribed) void channel.send({ type: 'broadcast', event: 'typing', payload: {} })
    },
    close() {
      closed = true
      if (client && channel) void client.removeChannel(channel)
    },
  }
}
