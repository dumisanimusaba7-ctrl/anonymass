import { SUPABASE_KEY, SUPABASE_URL } from './config'
import type { Difficulty, GameState, Peek, ReportCategory, SoftResult } from './types'
import type { HintCategory, MessageKind } from './types'
import { deviceId } from './identity'

/** Error codes raised by the database functions (see the migration). */
export class ApiError extends Error {
  constructor(
    public code: string,
    public retryAfter?: number,
  ) {
    super(code)
  }
}

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  // Legacy anon keys are JWTs and go in Authorization too; new publishable
  // keys must only be sent as `apikey`.
  ...(SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
}

async function rpc<T>(fn: string, args: Record<string, unknown>, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      ...init,
    })
  } catch {
    throw new ApiError('offline')
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // fall through with null body
  }
  if (!res.ok) {
    const err = body as { message?: string; hint?: string } | null
    throw new ApiError(err?.message ?? `http_${res.status}`, err?.hint ? Number(err.hint) : undefined)
  }
  return body as T
}

export const api = {
  createGame: (name: string, nickname: string | null, difficulty: Difficulty) =>
    rpc<{ code: string; token: string }>('create_game', {
      p_name: name,
      p_nickname: nickname,
      p_difficulty: difficulty,
      p_device: deviceId(),
    }),

  peekGame: (code: string) => rpc<Peek>('peek_game', { p_code: code, p_device: deviceId() }),

  joinGame: (code: string, name: string, aliases: string | null) =>
    rpc<{ token: string }>('join_game', { p_code: code, p_name: name, p_aliases: aliases, p_device: deviceId() }),

  getState: (code: string, token: string, after: number) =>
    rpc<GameState>('get_state', { p_code: code, p_token: token, p_after: after }),

  sendMessage: (code: string, token: string, content: string, kind: MessageKind = 'text', category: HintCategory | null = null) =>
    rpc<SoftResult>('send_message', { p_code: code, p_token: token, p_content: content, p_kind: kind, p_category: category }),

  requestHint: (code: string, token: string) => rpc<SoftResult>('request_hint', { p_code: code, p_token: token }),

  setGuessing: (code: string, token: string, on: boolean) =>
    rpc<SoftResult>('set_guessing', { p_code: code, p_token: token, p_on: on }),

  submitGuess: (code: string, token: string, guess: string) =>
    rpc<SoftResult>('submit_guess', { p_code: code, p_token: token, p_guess: guess }),

  leaveGame: (code: string, token: string) => rpc<SoftResult>('leave_game', { p_code: code, p_token: token }),

  blockGuest: (code: string, token: string) => rpc<SoftResult>('block_guest', { p_code: code, p_token: token }),

  reportGame: (code: string, token: string, category: ReportCategory, description: string) =>
    rpc<SoftResult>('report_game', { p_code: code, p_token: token, p_category: category, p_description: description }),

  reportLink: (link: string, category: ReportCategory, description: string) =>
    rpc<SoftResult>('report_link', { p_link: link, p_category: category, p_description: description, p_device: deviceId() }),

  track: (name: string, code?: string | null, props?: Record<string, unknown>) =>
    rpc<null>(
      'track_event',
      { p_name: name, p_device: deviceId(), p_code: code ?? null, p_props: props ?? {} },
      { keepalive: true },
    ).catch(() => null),
}
