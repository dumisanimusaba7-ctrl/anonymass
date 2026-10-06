export type Role = 'creator' | 'guest'
export type Difficulty = 'easy' | 'normal' | 'evil'
export type GameStatus = 'waiting' | 'active' | 'guessing' | 'completed' | 'expired' | 'cancelled'
export type MessageKind = 'text' | 'hint' | 'hint_request' | 'mysterious'

export const HINT_CATEGORIES = [
  ['age', 'Age'],
  ['city', 'City'],
  ['school', 'School'],
  ['work', 'Work'],
  ['mutual_friend', 'Mutual friend'],
  ['hobby', 'Hobby'],
  ['personality', 'Personality'],
  ['shared_memory', 'Shared memory'],
  ['random_fact', 'Random fact'],
] as const
export type HintCategory = (typeof HINT_CATEGORIES)[number][0]

export const REPORT_CATEGORIES = [
  ['harassment', 'Harassment'],
  ['threats', 'Threats'],
  ['sexual', 'Sexual content'],
  ['spam', 'Spam'],
  ['hate', 'Hate / abuse'],
  ['other', 'Other'],
] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number][0]

export interface Message {
  seq: number
  mine: boolean
  kind: MessageKind
  category: HintCategory | null
  content: string
  at: string
}

export interface GameResult {
  guess: string
  correct: boolean
  name: string
  score: number
  winner: Role
  duration: number
  questions: number
  hints: number
  guesses: number
}

export interface RemovedState {
  role: 'guest'
  removed: true
  reason: 'left' | 'blocked'
  status: GameStatus
  code: string
  host: string
  server_now: string
}

export interface ActiveState {
  role: Role
  removed: false
  me: string
  status: GameStatus
  code: string
  host: string
  difficulty: Difficulty
  round: number
  channel: string | null
  created_at: string
  expires_at: string
  round_started_at: string | null
  completed_at: string | null
  guest_present: boolean
  other_online: boolean
  muted_until: string | null
  messages: Message[]
  counts: { questions: number; hints_requested: number; hints_given: number; messages: number }
  hint: { next_at: string | null; remaining: number; max: number }
  result: GameResult | null
  server_now: string
}

export type GameState = ActiveState | RemovedState

export type PeekState = 'open' | 'taken' | 'over' | 'expired' | 'not_found'
export interface Peek {
  state: PeekState
  host?: string
  difficulty?: Difficulty
  expires_at?: string
}

export type SoftResult = { ok: true; seq?: number; correct?: boolean } | { ok: false; error: string; retry_after?: number }
