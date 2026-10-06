import { ANON_KEY, SERVICE_KEY, SUPABASE_URL } from './env'

export type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any

function headers(key: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    apikey: key,
    ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
  }
}

export class RpcError extends Error {
  constructor(
    public status: number,
    public body: Json,
  ) {
    super(body?.message ?? `HTTP ${status}`)
  }
}

export async function rpc(fn: string, args: Record<string, unknown> = {}, key = ANON_KEY): Promise<Json> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(args),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new RpcError(res.status, body)
  return body
}

/** Resolves to the error message code of a failing RPC. */
export async function rpcError(fn: string, args: Record<string, unknown> = {}, key = ANON_KEY): Promise<string> {
  try {
    await rpc(fn, args, key)
  } catch (e) {
    if (e instanceof RpcError) return e.body?.message ?? String(e.status)
    throw e
  }
  throw new Error(`${fn} unexpectedly succeeded`)
}

export async function rest(method: string, path: string, body?: unknown, key = ANON_KEY) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers(key), prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

/** Service-role helpers for setting up scenarios (e.g. expiry). */
export const admin = {
  patchGame: (code: string, patch: Record<string, unknown>) => rest('PATCH', `games?share_code=eq.${code}`, patch, SERVICE_KEY),
  getGame: async (code: string) => (await rest('GET', `games?share_code=eq.${code}`, undefined, SERVICE_KEY)).body[0],
  purge: () => rpc('purge_old_games', {}, SERVICE_KEY),
}

let deviceCounter = 0
export const device = () => `anon_test_${process.pid}_${Date.now().toString(36)}_${deviceCounter++}`

export async function createGame(opts: { name?: string; nickname?: string; difficulty?: string } = {}) {
  const dev = device()
  const res = await rpc('create_game', {
    p_name: opts.name ?? 'Dumisani',
    p_nickname: opts.nickname ?? null,
    p_difficulty: opts.difficulty ?? 'normal',
    p_device: dev,
  })
  return { code: res.code as string, token: res.token as string, device: dev }
}

export async function joinGame(code: string, name = 'Sarah', aliases: string | null = null, dev = device()) {
  const res = await rpc('join_game', { p_code: code, p_name: name, p_aliases: aliases, p_device: dev })
  return { token: res.token as string, device: dev }
}

export const state = (code: string, token: string, after = 0) =>
  rpc('get_state', { p_code: code, p_token: token, p_after: after })

export const send = (code: string, token: string, content: string, kind = 'text', category: string | null = null) =>
  rpc('send_message', { p_code: code, p_token: token, p_content: content, p_kind: kind, p_category: category })

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
