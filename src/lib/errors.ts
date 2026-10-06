import { clock } from './format'

// Every error the backend can raise, in human words.
export function errorCopy(code: string, retryAfter?: number): string {
  switch (code) {
    case 'offline':
      return 'You disappeared 👻 Check your connection and try again.'
    case 'rate_limited':
      return retryAfter && retryAfter > 120
        ? `Whoa, slow down. Try again in about ${Math.ceil(retryAfter / 60)} minutes.`
        : `Slow down. You're typing faster than your secrets. Try again${retryAfter ? ` in ${retryAfter}s` : ' soon'}.`
    case 'too_fast':
      return 'Easy. One message at a time.'
    case 'message_cap':
      return "That's the message limit for this game. Time to make your guess."
    case 'hint_cooldown':
      return retryAfter ? `Next hint unlocks in ${clock(retryAfter)}.` : 'No hints just yet.'
    case 'no_hints_left':
      return "You're out of hints. Trust your gut."
    case 'too_long':
      return 'Keep it under 500 characters.'
    case 'empty':
      return 'Say something first.'
    case 'invalid_name':
      return 'We need a name for the reveal.'
    case 'invalid_guess':
      return 'Type a name to guess.'
    case 'not_active':
      return 'This game is not live right now.'
    case 'taken':
      return 'Someone beat you to it.'
    case 'blocked':
      return "You can't rejoin this game."
    case 'own_game':
      return "That's your own link. Send it to someone else 😅"
    case 'expired':
      return 'This game has expired.'
    case 'over':
      return 'This mystery is already over.'
    case 'not_found':
      return "This mystery doesn't exist."
    default:
      return 'Something glitched. Try again.'
  }
}
