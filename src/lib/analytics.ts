import { api } from './api'
import { isConfigured } from './config'

export type ClientEvent =
  | 'landing_view'
  | 'create_viewed'
  | 'join_viewed'
  | 'link_copied'
  | 'share_clicked'
  | 'result_shared'
  | 'replay_clicked'

// Game events (created, joined, messages, hints, guesses, completion,
// abandonment, reports) are recorded server-side by the game functions.
export function track(event: ClientEvent, code?: string | null, props?: Record<string, unknown>) {
  if (!isConfigured) return
  void api.track(event, code, props)
}
