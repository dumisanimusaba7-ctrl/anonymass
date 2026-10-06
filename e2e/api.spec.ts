import { expect, test } from '@playwright/test'
import { admin, createGame, device, joinGame, rest, rpc, rpcError, send, sleep, state } from './api'
import { SERVICE_KEY } from './env'

// API-level tests against the real PostgREST endpoint with the public key,
// i.e. exactly what a browser (or an attacker with devtools) can do.

test.describe.configure({ mode: 'parallel' })

test('creating a game returns a random share code and secret token', async () => {
  const a = await createGame()
  const b = await createGame()
  expect(a.code).toMatch(/^[2-9A-HJKMNP-Z]{7}$/)
  expect(a.token).toMatch(/^[0-9a-f]{64}$/)
  expect(a.code).not.toBe(b.code)

  const s = await state(a.code, a.token)
  expect(s).toMatchObject({ role: 'creator', status: 'waiting', guest_present: false, host: 'Dumisani' })
  expect(s.channel).toMatch(/^anx:[0-9a-f]{32}$/)
  expect(new Date(s.expires_at).getTime() - new Date(s.created_at).getTime()).toBe(24 * 3600 * 1000)

  expect(await rpcError('create_game', { p_name: '   ', p_device: device() })).toBe('invalid_name')
})

test('tables are not readable or writable with the public key', async () => {
  const g = await createGame()
  await joinGame(g.code)
  for (const table of ['games', 'players', 'player_secrets', 'messages', 'guesses', 'hints', 'reports', 'events']) {
    const read = await rest('GET', `${table}?select=*`)
    expect(read.status, `read ${table}`).toBeGreaterThanOrEqual(400)
    const write = await rest('POST', table, {})
    expect(write.status, `write ${table}`).toBeGreaterThanOrEqual(400)
  }
  const patch = await rest('PATCH', `games?share_code=eq.${g.code}`, { status: 'completed', winner: 'creator' })
  expect(patch.status).toBeGreaterThanOrEqual(400)
  expect((await admin.getGame(g.code)).status).toBe('active')

  // Internal helpers and maintenance functions are not exposed.
  for (const fn of ['purge_old_games', 'sha', 'auth', 'throttle']) {
    await expect(rpc(fn, {})).rejects.toThrow()
  }
})

test('a token only opens its own game', async () => {
  const a = await createGame()
  const b = await createGame()
  expect(await rpcError('get_state', { p_code: a.code, p_token: b.token })).toBe('not_found')
  expect(await rpcError('get_state', { p_code: a.code, p_token: 'f'.repeat(64) })).toBe('not_found')
  expect(await rpcError('get_state', { p_code: a.code, p_token: 'nope' })).toBe('not_found')
  expect(await rpcError('send_message', { p_code: b.code, p_token: a.token, p_content: 'hi' })).toBe('not_found')
})

test('peek, join and the single guest seat', async () => {
  const g = await createGame({ nickname: 'Dumi' })
  expect(await rpc('peek_game', { p_code: g.code })).toMatchObject({ state: 'open', host: 'Dumi' })
  expect(await rpc('peek_game', { p_code: g.code.toLowerCase() })).toMatchObject({ state: 'open' })

  const guest = await joinGame(g.code, 'Sarah')
  expect(await rpc('peek_game', { p_code: g.code })).toMatchObject({ state: 'taken' })
  expect(await rpcError('join_game', { p_code: g.code, p_name: 'Late', p_device: device() })).toBe('taken')

  const creator = await state(g.code, g.token)
  expect(creator).toMatchObject({ status: 'active', guest_present: true, other_online: true })
  const guestState = await state(g.code, guest.token)
  expect(guestState).toMatchObject({ role: 'guest', status: 'active', removed: false })
  expect(guestState.me).toMatch(/^Anonymous #\d{4}$/)

  // The creator cannot join their own game from the same device.
  const own = await createGame()
  expect(await rpcError('join_game', { p_code: own.code, p_name: 'Me', p_device: own.device })).toBe('own_game')

  expect(await rpc('peek_game', { p_code: 'ZZZZZZZ' })).toEqual({ state: 'not_found' })
  expect(await rpc('peek_game', { p_code: '1' })).toEqual({ state: 'not_found' })
  expect(await rpc('peek_game', { p_code: "' or 1=1 --" })).toEqual({ state: 'not_found' })
})

test('identities stay hidden until the reveal', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code, 'Zanele Secretname', 'Zee')
  await send(g.code, guest.token, 'hello stranger')
  await sleep(400)
  await send(g.code, g.token, 'who is this')

  const creatorView = JSON.stringify(await state(g.code, g.token))
  expect(creatorView).not.toContain('Zanele')
  expect(creatorView).not.toContain('Secretname')
  expect(creatorView).not.toContain(guest.token)
  expect(creatorView).not.toContain(guest.device)
  expect(creatorView).not.toMatch(/player_id|token|device/)

  const guestView = await state(g.code, guest.token)
  expect(JSON.stringify(guestView)).not.toContain(g.token)
  expect(guestView.messages.map((m: { mine: boolean; content: string }) => [m.mine, m.content])).toEqual([
    [true, 'hello stranger'],
    [false, 'who is this'],
  ])
})

test('chat messages, validation and incremental fetch', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code)

  const r1 = await send(g.code, g.token, 'did we go to school together?')
  expect(r1).toMatchObject({ ok: true, seq: 1 })
  await sleep(400)
  expect(await send(g.code, guest.token, 'maybe 👀')).toMatchObject({ ok: true, seq: 2 })

  const s = await state(g.code, g.token, 1)
  expect(s.messages).toHaveLength(1)
  expect(s.messages[0]).toMatchObject({ seq: 2, mine: false, kind: 'text', content: 'maybe 👀' })
  expect(s.counts).toMatchObject({ questions: 1, messages: 2 })

  expect(await rpcError('send_message', { p_code: g.code, p_token: g.token, p_content: 'x'.repeat(501) })).toBe('too_long')
  expect(await rpcError('send_message', { p_code: g.code, p_token: g.token, p_content: '   ' })).toBe('empty')
  expect(await rpcError('send_message', { p_code: g.code, p_token: g.token, p_content: 'x', p_kind: 'hint' })).toBe(
    'invalid_kind',
  )
  expect(await rpcError('send_message', { p_code: g.code, p_token: guest.token, p_content: 'x', p_kind: 'hint_request' })).toBe(
    'invalid_kind',
  )

  await sleep(400)
  expect(await send(g.code, g.token, 'x'.repeat(500))).toMatchObject({ ok: true })

  // Nobody can chat before a guest arrives.
  const lonely = await createGame()
  expect(await rpcError('send_message', { p_code: lonely.code, p_token: lonely.token, p_content: 'hello?' })).toBe('not_active')
})

test('message rate limiting with cooldown', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code)

  expect(await send(g.code, guest.token, 'one')).toMatchObject({ ok: true })
  expect(await send(g.code, guest.token, 'two')).toMatchObject({ ok: false, error: 'too_fast' })

  for (let i = 0; i < 14; i++) {
    await sleep(380)
    expect(await send(g.code, guest.token, `spam ${i}`)).toMatchObject({ ok: true })
  }
  await sleep(380)
  expect(await send(g.code, guest.token, 'one too many')).toMatchObject({ ok: false, error: 'rate_limited', retry_after: 20 })
  await sleep(400)
  const muted = await send(g.code, guest.token, 'still muted?')
  expect(muted).toMatchObject({ ok: false, error: 'rate_limited' })
  expect((await state(g.code, guest.token)).muted_until).not.toBeNull()

  // The other player is unaffected.
  expect(await send(g.code, g.token, 'calm down')).toMatchObject({ ok: true })
})

test('hints: requests, cooldowns and structured answers', async () => {
  const easy = await createGame({ difficulty: 'easy' })
  const guest = await joinGame(easy.code)

  expect(await rpcError('request_hint', { p_code: easy.code, p_token: guest.token })).toBe('forbidden')
  expect(await rpc('request_hint', { p_code: easy.code, p_token: easy.token })).toEqual({ ok: true })
  const again = await rpc('request_hint', { p_code: easy.code, p_token: easy.token })
  expect(again).toMatchObject({ ok: false, error: 'hint_cooldown' })
  expect(again.retry_after).toBeGreaterThan(15)

  expect(await send(easy.code, guest.token, 'I live closer than you think', 'hint', 'city')).toMatchObject({ ok: true })
  await sleep(400)
  expect(await send(easy.code, guest.token, '', 'mysterious')).toMatchObject({ ok: true })

  const s = await state(easy.code, easy.token)
  expect(s.messages.map((m: { kind: string; category: string | null }) => [m.kind, m.category])).toEqual([
    ['hint_request', null],
    ['hint', 'city'],
    ['mysterious', null],
  ])
  expect(s.counts).toMatchObject({ hints_requested: 1, hints_given: 1 })
  expect(s.hint.remaining).toBe(9)

  // Normal difficulty keeps hints locked for the first 45 seconds.
  const normal = await createGame()
  await joinGame(normal.code)
  expect(await rpc('request_hint', { p_code: normal.code, p_token: normal.token })).toMatchObject({
    ok: false,
    error: 'hint_cooldown',
  })
})

test('wrong guess: one shot, guest wins, identity revealed', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code, 'Sarah Mokoena', 'Sars')
  await send(g.code, g.token, 'are you michael?')

  expect(await rpcError('submit_guess', { p_code: g.code, p_token: guest.token, p_guess: 'me' })).toBe('forbidden')

  await rpc('set_guessing', { p_code: g.code, p_token: g.token, p_on: true })
  expect((await state(g.code, guest.token)).status).toBe('guessing')
  await rpc('set_guessing', { p_code: g.code, p_token: g.token, p_on: false })
  expect((await state(g.code, guest.token)).status).toBe('active')
  await rpc('set_guessing', { p_code: g.code, p_token: g.token, p_on: true })

  expect(await rpc('submit_guess', { p_code: g.code, p_token: g.token, p_guess: 'Michael' })).toEqual({
    ok: true,
    correct: false,
  })
  expect(await rpcError('submit_guess', { p_code: g.code, p_token: g.token, p_guess: 'Sarah' })).toBe('not_active')

  for (const token of [g.token, guest.token]) {
    const s = await state(g.code, token)
    expect(s.status).toBe('completed')
    expect(s.result).toMatchObject({
      guess: 'Michael',
      correct: false,
      name: 'Sarah Mokoena',
      winner: 'guest',
      score: 0,
      questions: 1,
      hints: 0,
      guesses: 1,
    })
    expect(s.channel).toBeNull()
  }
  expect(await rpcError('send_message', { p_code: g.code, p_token: guest.token, p_content: 'gotcha' })).toBe('not_active')
  expect(await rpc('peek_game', { p_code: g.code })).toMatchObject({ state: 'over' })
  expect((await admin.getGame(g.code)).winner).toBe('guest')
})

test('correct guess matches first names, aliases and accents', async () => {
  const cases: Array<[string, string | null, string]> = [
    ['Michael Jordan', null, 'michael'],
    ['Michael', 'Mike, Mikey', 'MIKE'],
    ['José', null, 'jose'],
    ['Thabo', null, '  thabo!  '],
  ]
  for (const [name, aliases, guess] of cases) {
    const g = await createGame()
    await joinGame(g.code, name, aliases)
    expect(await rpc('submit_guess', { p_code: g.code, p_token: g.token, p_guess: guess }), `${guess} vs ${name}`).toEqual({
      ok: true,
      correct: true,
    })
    const s = await state(g.code, g.token)
    expect(s.result).toMatchObject({ correct: true, winner: 'creator', name })
    expect(s.result.score).toBeGreaterThan(90)
  }
})

test('guest leaving reopens the seat with a clean slate', async () => {
  const g = await createGame()
  const first = await joinGame(g.code, 'First')
  await send(g.code, first.token, 'secret stuff from round one')
  const before = await state(g.code, g.token)

  await rpc('leave_game', { p_code: g.code, p_token: first.token })
  const after = await state(g.code, g.token)
  expect(after).toMatchObject({ status: 'waiting', round: 2, guest_present: false })
  expect(after.channel).not.toBe(before.channel)
  expect(await state(g.code, first.token)).toMatchObject({ removed: true, reason: 'left' })
  expect(await rpcError('send_message', { p_code: g.code, p_token: first.token, p_content: 'back' })).toBe('not_active')

  const second = await joinGame(g.code, 'Second')
  const s2 = await state(g.code, second.token)
  expect(s2.messages).toEqual([])
  expect(JSON.stringify(s2)).not.toContain('round one')
})

test('creator can block the current guest', async () => {
  const g = await createGame()
  const troll = await joinGame(g.code, 'Troll')
  expect(await rpcError('block_guest', { p_code: g.code, p_token: troll.token })).toBe('forbidden')

  await rpc('block_guest', { p_code: g.code, p_token: g.token })
  expect(await state(g.code, troll.token)).toMatchObject({ removed: true, reason: 'blocked' })
  expect(await state(g.code, g.token)).toMatchObject({ status: 'waiting', guest_present: false })
  expect(await rpcError('join_game', { p_code: g.code, p_name: 'Troll', p_device: troll.device })).toBe('blocked')

  await joinGame(g.code, 'Friend')
  expect(await state(g.code, g.token)).toMatchObject({ status: 'active', guest_present: true })
})

test('creator leaving cancels the game', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code)
  await rpc('leave_game', { p_code: g.code, p_token: g.token })
  expect(await state(g.code, guest.token)).toMatchObject({ status: 'cancelled' })
  expect(await rpc('peek_game', { p_code: g.code })).toMatchObject({ state: 'over' })
  expect(await rpcError('submit_guess', { p_code: g.code, p_token: g.token, p_guess: 'x' })).toBe('not_active')
})

test('reports are stored with a snapshot and cannot be read back', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code)
  await send(g.code, guest.token, 'something nasty')

  expect(
    await rpc('report_game', { p_code: g.code, p_token: g.token, p_category: 'harassment', p_description: 'not ok' }),
  ).toEqual({ ok: true })
  expect(await rpcError('report_game', { p_code: g.code, p_token: g.token, p_category: 'nonsense' })).toBe('invalid_category')
  await rpc('report_game', { p_code: g.code, p_token: g.token, p_category: 'spam' })
  await rpc('report_game', { p_code: g.code, p_token: g.token, p_category: 'other' })
  expect(await rpc('report_game', { p_code: g.code, p_token: g.token, p_category: 'other' })).toMatchObject({
    ok: false,
    error: 'rate_limited',
  })

  expect(
    await rpc('report_link', { p_link: `https://anonymass.com/g/${g.code}`, p_category: 'threats', p_device: device() }),
  ).toEqual({ ok: true })

  const reports = await rest('GET', `reports?share_code=eq.${g.code}&order=created_at`, undefined, SERVICE_KEY)
  expect(reports.body).toHaveLength(4)
  expect(reports.body[0]).toMatchObject({ category: 'harassment', reporter_role: 'creator', source: 'in_game' })
  expect(reports.body[0].snapshot[0]).toMatchObject({ sender: 'guest', content: 'something nasty' })
  expect(reports.body[3]).toMatchObject({ category: 'threats', source: 'public' })
  expect(reports.body[3].game_id).toBe(reports.body[0].game_id)
})

test('games expire after 24 hours and are purged a day later', async () => {
  const g = await createGame()
  const guest = await joinGame(g.code)
  await send(g.code, guest.token, 'tick tock')

  await admin.patchGame(g.code, { expires_at: new Date(Date.now() - 1000).toISOString() })
  expect((await state(g.code, g.token)).status).toBe('expired')
  expect(await rpcError('send_message', { p_code: g.code, p_token: guest.token, p_content: 'hello?' })).toBe('not_active')
  expect(await rpc('peek_game', { p_code: g.code })).toEqual({ state: 'expired' })
  expect(await rpcError('join_game', { p_code: g.code, p_name: 'x', p_device: device() })).toBe('expired')
  expect((await admin.getGame(g.code)).status).toBe('expired')

  await admin.patchGame(g.code, { expires_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() })
  const purged = await admin.purge()
  expect(purged.deleted).toBeGreaterThanOrEqual(1)
  expect(await admin.getGame(g.code)).toBeUndefined()
  expect(await rpcError('get_state', { p_code: g.code, p_token: g.token })).toBe('not_found')
})

test('two games at once stay isolated', async () => {
  const a = await createGame({ name: 'Alpha' })
  const b = await createGame({ name: 'Bravo' })
  const ga = await joinGame(a.code, 'GuestA')
  const gb = await joinGame(b.code, 'GuestB')
  await Promise.all([send(a.code, ga.token, 'message for A'), send(b.code, gb.token, 'message for B')])
  const [sa, sb] = await Promise.all([state(a.code, a.token), state(b.code, b.token)])
  expect(sa.messages.map((m: { content: string }) => m.content)).toEqual(['message for A'])
  expect(sb.messages.map((m: { content: string }) => m.content)).toEqual(['message for B'])
  expect(sa.channel).not.toBe(sb.channel)
})

test('link probing is throttled per device', async () => {
  const dev = device()
  let limited = false
  for (let i = 0; i < 62 && !limited; i++) {
    try {
      await rpc('peek_game', { p_code: 'ABCDEFG', p_device: dev })
    } catch (e) {
      limited = (e as Error).message === 'rate_limited'
    }
  }
  expect(limited).toBe(true)
})

test('analytics accepts only known client events', async () => {
  const dev = device()
  await rpc('track_event', { p_name: 'landing_view', p_device: dev })
  await rpc('track_event', { p_name: 'drop_table_users', p_device: dev })
  const events = await rest('GET', `events?name=in.(landing_view,drop_table_users)&order=id.desc&limit=5`, undefined, SERVICE_KEY)
  expect(events.body.some((e: { name: string }) => e.name === 'drop_table_users')).toBe(false)
  expect(events.body.some((e: { name: string; device_hash: string }) => e.name === 'landing_view' && e.device_hash !== dev)).toBe(
    true,
  )
})
