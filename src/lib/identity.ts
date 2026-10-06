import type { Role } from './types'

// Temporary identity. There are no accounts: a random device id (used only
// for rate limiting and repeat-play stats, always hashed server-side) and one
// secret token per game seat. Stored in localStorage with a cookie fallback
// for browsers where storage is blocked.

const DEVICE_KEY = 'anx_device'
const seatKey = (code: string) => `anx_seat_${code.toUpperCase()}`

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string | null, maxAgeSeconds: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    value === null
      ? `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
      : `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`
}

const memory = new Map<string, string>()

export const store = {
  get(key: string): string | null {
    try {
      const v = localStorage.getItem(key)
      if (v !== null) return v
    } catch {
      /* storage blocked */
    }
    return readCookie(key) ?? memory.get(key) ?? null
  },
  set(key: string, value: string, maxAgeSeconds = 60 * 60 * 48) {
    memory.set(key, value)
    try {
      localStorage.setItem(key, value)
      return
    } catch {
      /* storage blocked: fall back to a cookie */
    }
    writeCookie(key, value, maxAgeSeconds)
  },
  remove(key: string) {
    memory.delete(key)
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    writeCookie(key, null, 0)
  },
}

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function deviceId(): string {
  let id = store.get(DEVICE_KEY)
  if (!id || !/^anon_[0-9a-f]{16}$/.test(id)) {
    id = `anon_${randomHex(8)}`
    store.set(DEVICE_KEY, id, 60 * 60 * 24 * 365)
  }
  return id
}

export interface Seat {
  token: string
  role: Role
}

export function getSeat(code: string): Seat | null {
  const raw = store.get(seatKey(code))
  if (!raw) return null
  try {
    const seat = JSON.parse(raw) as Seat
    return /^[0-9a-f]{64}$/.test(seat.token) ? seat : null
  } catch {
    return null
  }
}

export function saveSeat(code: string, seat: Seat) {
  store.set(seatKey(code), JSON.stringify(seat))
}

export function clearSeat(code: string) {
  store.remove(seatKey(code))
}
