import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { joinGameChannel, type GameChannel } from '../lib/realtime'
import type { GameState, HintCategory, Message, MessageKind, ReportCategory, SoftResult } from '../lib/types'

export interface PendingMessage {
  id: number
  kind: MessageKind
  category: HintCategory | null
  content: string
}

const ENDED = new Set(['completed', 'expired', 'cancelled'])

/**
 * Owns one seat in one game: fetches state, merges messages incrementally,
 * listens on the realtime channel and falls back to polling.
 */
export function useGame(code: string, token: string) {
  const [state, setState] = useState<GameState | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [fatal, setFatal] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [live, setLive] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [skew, setSkew] = useState(0)

  const seqRef = useRef(0)
  const roundRef = useRef<number | null>(null)
  const inflight = useRef<Promise<void> | null>(null)
  const again = useRef(false)
  const channelRef = useRef<GameChannel | null>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const lastTypingSent = useRef(0)
  const pendingId = useRef(0)

  const refresh = useCallback((): Promise<void> => {
    if (inflight.current) {
      again.current = true
      return inflight.current
    }
    const run = async () => {
      do {
        again.current = false
        try {
          const s = await api.getState(code, token, seqRef.current)
          setSkew(Math.round((new Date(s.server_now).getTime() - Date.now()) / 1000) * 1000)
          setOffline(false)
          if (!s.removed) {
            const roundChanged = roundRef.current !== null && s.round !== roundRef.current
            roundRef.current = s.round
            if (s.messages.length) seqRef.current = s.messages[s.messages.length - 1].seq
            if (roundChanged) {
              setMessages(s.messages)
            } else if (s.messages.length) {
              if (s.messages.some((m) => !m.mine)) setOtherTyping(false)
              setMessages((prev) => {
                const seen = new Set(prev.map((m) => m.seq))
                return [...prev, ...s.messages.filter((m) => !seen.has(m.seq))]
              })
            }
          }
          setState(s)
        } catch (e) {
          if (e instanceof ApiError && e.code === 'not_found') setFatal('not_found')
          else setOffline(true)
        }
      } while (again.current)
    }
    inflight.current = run().finally(() => {
      inflight.current = null
    })
    return inflight.current
  }, [code, token])

  // Initial load
  useEffect(() => {
    void refresh()
  }, [refresh])

  const status = state?.status
  const removed = state?.removed ?? false
  const ended = removed || (status ? ENDED.has(status) : false)
  const channel = state && !state.removed ? state.channel : null

  // Realtime channel (rotates when the guest seat changes hands)
  useEffect(() => {
    if (!channel) return
    const ch = joinGameChannel(channel, {
      onSync: () => void refresh(),
      onTyping: () => {
        setOtherTyping(true)
        window.clearTimeout(typingTimer.current)
        typingTimer.current = window.setTimeout(() => setOtherTyping(false), 3500)
      },
      onStatus: setLive,
    })
    channelRef.current = ch
    return () => {
      ch.close()
      channelRef.current = null
      setLive(false)
    }
  }, [channel, refresh])

  // Polling fallback + heartbeat. Fast when realtime is down.
  const loaded = state !== null
  useEffect(() => {
    if (!loaded || ended) return
    const interval = live ? 8000 : 2500
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' || !live) void refresh()
    }, interval)
    return () => window.clearInterval(id)
  }, [loaded, ended, live, refresh])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    const onOnline = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [refresh])

  const soft = useCallback(
    async (fn: () => Promise<SoftResult>): Promise<SoftResult> => {
      try {
        const res = await fn()
        void refresh()
        return res
      } catch (e) {
        void refresh()
        if (e instanceof ApiError) return { ok: false, error: e.code, retry_after: e.retryAfter }
        return { ok: false, error: 'unknown' }
      }
    },
    [refresh],
  )

  const send = useCallback(
    async (content: string, kind: MessageKind = 'text', category: HintCategory | null = null) => {
      const id = ++pendingId.current
      setPending((p) => [...p, { id, kind, category, content }])
      let res = await soft(() => api.sendMessage(code, token, content, kind, category))
      // The server rejects messages sent within ~350ms of the previous one.
      // That's a burst guard, not something to bother the player with.
      if (!res.ok && res.error === 'too_fast') {
        await new Promise((r) => setTimeout(r, 450))
        res = await soft(() => api.sendMessage(code, token, content, kind, category))
      }
      // Keep the optimistic bubble until the real one has been fetched.
      if (res.ok) await refresh()
      setPending((p) => p.filter((m) => m.id !== id))
      return res
    },
    [code, token, soft, refresh],
  )

  const sendTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current < 2000) return
    lastTypingSent.current = now
    channelRef.current?.sendTyping()
  }, [])

  return {
    state,
    messages,
    pending,
    fatal,
    offline,
    live,
    otherTyping,
    /** Milliseconds to add to Date.now() to get server time. */
    skew,
    refresh,
    send,
    sendTyping,
    requestHint: () => soft(() => api.requestHint(code, token)),
    setGuessing: (on: boolean) => soft(() => api.setGuessing(code, token, on)),
    submitGuess: (guess: string) => soft(() => api.submitGuess(code, token, guess)),
    leave: () => soft(() => api.leaveGame(code, token)),
    block: () => soft(() => api.blockGuest(code, token)),
    report: (category: ReportCategory, description: string) => soft(() => api.reportGame(code, token, category, description)),
  }
}

export type GameController = ReturnType<typeof useGame>
