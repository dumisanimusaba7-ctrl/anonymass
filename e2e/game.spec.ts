import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { admin } from './api'

// Full two-player flows in real browsers. Each player gets their own browser
// context (separate storage, like an incognito window). Set SHOTS=1 to save
// screenshots of every key screen to test-results/shots.

const shots = process.env.SHOTS === '1'
async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `test-results/shots/${name}.png` })
}

async function newPlayer(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ...options,
  })
  const page = await context.newPage()
  return { context, page }
}

async function createGame(page: Page, opts: { name?: string; difficulty?: 'Easy' | 'Normal' | 'Evil' } = {}) {
  await page.goto('/')
  await page
    .getByRole('link', { name: /create my game/i })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /let's make this interesting/i })).toBeVisible()
  await page.getByLabel('Your name').fill(opts.name ?? 'Dumisani')
  if (opts.difficulty) await page.getByRole('radio', { name: opts.difficulty }).click()
  await page.getByRole('button', { name: /create my link/i }).click()
  await expect(page.getByRole('heading', { name: /your game is live/i })).toBeVisible()
  const code = /\/g\/([A-Z0-9]{7})$/.exec(page.url())![1]
  return code
}

async function join(page: Page, code: string, name = 'Sarah', aliases?: string) {
  await page.goto(`/g/${code}`)
  await expect(page.getByRole('heading', { name: /you're on the other end/i })).toBeVisible()
  await page.getByLabel('Your real name').fill(name)
  if (aliases) await page.getByLabel('Other names they might guess').fill(aliases)
  await page.getByRole('button', { name: /enter the game/i }).click()
  await expect(page.getByRole('heading', { name: /keep them guessing/i })).toBeVisible()
}

async function openRoomAfterJoin(creator: Page) {
  await expect(creator.getByText(/someone just clicked your link/i)).toBeVisible()
  await creator.getByRole('button', { name: /open the game/i }).click()
  await expect(creator.getByRole('heading', { name: /who's on the other end/i })).toBeVisible()
}

async function say(page: Page, text: string) {
  const box = page.locator('#composer')
  await box.fill(text)
  await box.press('Enter')
}

const contexts: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()))
})

async function pair(browser: Browser) {
  const a = await newPlayer(browser)
  const b = await newPlayer(browser)
  contexts.push(a.context, b.context)
  return { creator: a.page, guest: b.page, guestContext: b.context }
}

test('full game: chat, hints, guessing and a wrong guess', async ({ browser }) => {
  const { creator, guest } = await pair(browser)

  const code = await createGame(creator, { difficulty: 'Easy' })
  await expect(creator.getByText(`/g/${code}`).first()).toBeVisible()
  await expect(creator.getByText(/waiting for someone brave enough to click/i)).toBeVisible()
  await shot(creator, '01-share')

  await guest.goto(`/g/${code}`)
  await expect(guest.getByText("Dumisani's game")).toBeVisible()
  await shot(guest, '02-join')
  await join(guest, code, 'Sarah')

  await openRoomAfterJoin(creator)
  await expect(creator.getByText('Someone is here.')).toBeVisible()
  await shot(creator, '03-room-empty')

  // Realtime chat both ways
  await say(creator, 'Did we go to school together?')
  await expect(guest.getByText('Did we go to school together?')).toBeVisible()
  await expect(guest.getByText('The Guessing Machine')).toBeVisible()

  await guest.locator('#composer').fill('maybe')
  await expect(creator.getByText('Someone is typing...')).toBeVisible()
  await guest.locator('#composer').press('Enter')
  // Polling runs every 8s while realtime is connected, so arriving well inside
  // that window proves the database push reached the browser.
  await expect(creator.getByText('maybe', { exact: true })).toBeVisible({ timeout: 4000 })
  await expect(creator.getByText('Anonymous', { exact: true })).toBeVisible()

  // The guest's sealed name never reaches the guesser's page
  expect(await creator.content()).not.toContain('Sarah')

  // Hint flow
  await creator.getByRole('button', { name: /give me a hint/i }).click()
  await expect(creator.getByText('You asked for a hint 🔍')).toBeVisible()
  await expect(guest.getByText(/begging for a hint/i)).toBeVisible()
  await guest.getByRole('button', { name: 'Give a hint' }).first().click()
  await guest.getByRole('button', { name: 'City', exact: true }).click()
  await say(guest, 'I live closer than you think')
  await expect(creator.getByText('Hint · City')).toBeVisible()
  await expect(creator.getByText('I live closer than you think')).toBeVisible()
  await expect(creator.getByRole('button', { name: /hint in/i })).toBeVisible()

  await guest.getByRole('button', { name: 'Stay mysterious' }).click()
  await expect(creator.getByText('🤫 Anonymous is staying mysterious.')).toBeVisible()
  await shot(creator, '04-room-creator')
  await shot(guest, '05-room-guest')

  // The guess
  await creator.getByRole('button', { name: /i know who you are/i }).click()
  await expect(creator.getByRole('heading', { name: 'Who is it?' })).toBeVisible()
  await expect(creator.getByText(/you only get one final guess/i)).toBeVisible()
  await expect(guest.getByText(/they think they know who you are/i)).toBeVisible()
  await shot(creator, '06-guess')
  await shot(guest, '07-guest-guessing')

  await creator.getByPlaceholder('Michael').fill('Michael')
  await creator.getByRole('button', { name: /make the guess/i }).click()

  await expect(creator.getByText('You guessed...')).toBeVisible()
  await expect(creator.getByText('Michael').first()).toBeVisible()
  await expect(creator.getByText('You got played. 💀').first()).toBeVisible()
  await shot(creator, '08-reveal')
  await expect(guest.getByText('They guessed...')).toBeVisible()

  await expect(creator.getByRole('heading', { name: 'You got played. 💀' })).toBeVisible({ timeout: 15_000 })
  await expect(creator.getByText('It was').first()).toBeVisible()
  await expect(creator.getByText('Sarah').first()).toBeVisible()
  await expect(creator.getByText('They successfully fooled you.')).toBeVisible()
  await expect(creator.getByRole('link', { name: 'Get revenge' })).toBeVisible()
  await expect(creator.getByText('1 question', { exact: true })).toBeVisible()
  await expect(creator.getByText('1 hint', { exact: true })).toBeVisible()
  await shot(creator, '09-result-creator')

  await expect(guest.getByRole('heading', { name: 'You played them. 😈' })).toBeVisible({ timeout: 15_000 })
  await expect(guest.getByRole('heading', { name: /think you could fool someone/i })).toBeVisible()
  await shot(guest, '10-result-guest')

  // Refreshing the result does not replay the reveal
  await creator.reload()
  await expect(creator.getByRole('heading', { name: 'You got played. 💀' })).toBeVisible()

  // The replay loop leads to a new game
  await guest.getByRole('link', { name: 'Make a game' }).click()
  await expect(guest.getByRole('heading', { name: /let's make this interesting/i })).toBeVisible()
})

test('correct guess shows the score; latecomers are turned away', async ({ browser }) => {
  const { creator, guest } = await pair(browser)
  const late = await newPlayer(browser)
  contexts.push(late.context)

  const code = await createGame(creator)
  await join(guest, code, 'Michael Jordan', 'Mike')
  await openRoomAfterJoin(creator)

  await late.page.goto(`/g/${code}`)
  await expect(late.page.getByRole('heading', { name: /someone beat you to it/i })).toBeVisible()
  await expect(late.page.getByRole('link', { name: /make a game/i })).toBeVisible()

  await creator.getByRole('button', { name: /i know who you are/i }).click()
  await creator.getByPlaceholder('Michael').fill('mike')
  await creator.getByRole('button', { name: /make the guess/i }).click()
  await creator.getByRole('button', { name: 'Skip' }).click()

  await expect(creator.getByRole('heading', { name: 'You got them. 💀' })).toBeVisible()
  await expect(creator.getByText('Michael Jordan').first()).toBeVisible()
  await expect(creator.getByText(/how well do you/i)).toBeVisible()
  await expect(creator.getByText(/\d+%/)).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'They got you. 💀' })).toBeVisible({ timeout: 15_000 })

  await late.page.reload()
  await expect(late.page.getByRole('heading', { name: /this mystery is over/i })).toBeVisible()
})

test('invalid links and unknown pages', async ({ browser }) => {
  const { page, context } = await newPlayer(browser)
  contexts.push(context)
  await page.goto('/g/ZZZZZZZ')
  await expect(page.getByRole('heading', { name: /this mystery doesn't exist/i })).toBeVisible()
  await expect(page.getByText('the link expired')).toBeVisible()
  await page.goto('/what-is-this')
  await expect(page.getByRole('heading', { name: /this mystery doesn't exist/i })).toBeVisible()
  await page.getByRole('link', { name: /create your own/i }).click()
  await expect(page).toHaveURL(/\/create$/)
})

test('expired games', async ({ browser }) => {
  const { creator, guest } = await pair(browser)
  const code = await createGame(creator)
  await admin.patchGame(code, { expires_at: new Date(Date.now() - 1000).toISOString() })
  await creator.reload()
  await expect(creator.getByRole('heading', { name: /this game has expired/i })).toBeVisible()
  await expect(creator.getByText('The mystery is over.')).toBeVisible()
  await guest.goto(`/g/${code}`)
  await expect(guest.getByRole('heading', { name: /this game has expired/i })).toBeVisible()
  await expect(guest.getByRole('link', { name: /create a new game/i })).toBeVisible()
})

test('guest leaves, seat reopens; refresh keeps the conversation', async ({ browser }) => {
  const { creator, guest } = await pair(browser)
  const code = await createGame(creator)
  await join(guest, code)
  await openRoomAfterJoin(creator)

  await say(guest, 'remember me?')
  await expect(creator.getByText('remember me?')).toBeVisible()

  // An abandoned guess dialog doesn't survive a reload
  await creator.getByRole('button', { name: /i know who you are/i }).click()
  await expect(guest.getByText(/they think they know who you are/i)).toBeVisible()

  // Refresh / reconnect
  await Promise.all([creator.reload(), guest.reload()])
  await expect(guest.getByText(/they think they know who you are/i)).toHaveCount(0)
  await expect(creator.getByText('remember me?')).toBeVisible()
  await expect(guest.getByText('remember me?')).toBeVisible()
  await say(creator, 'still here')
  await expect(guest.getByText('still here')).toBeVisible()

  await guest.getByRole('button', { name: /game menu/i }).click()
  await guest.getByRole('button', { name: 'Leave game' }).click()
  await guest.getByRole('dialog').getByRole('button', { name: 'Leave game' }).click()
  await expect(guest.getByRole('heading', { name: 'You left the game.' })).toBeVisible()

  await expect(creator.getByText('The other end disappeared 👻').first()).toBeVisible()
  await expect(creator.getByText('remember me?')).toHaveCount(0)
  await shot(creator, '11-guest-left')

  // Someone new can take the seat and starts from a clean slate
  const next = await newPlayer(browser)
  contexts.push(next.context)
  await join(next.page, code, 'Thandi')
  await expect(creator.getByText(/someone just clicked your link/i)).toBeVisible()
  await expect(next.page.getByText('remember me?')).toHaveCount(0)
})

test('report and block; creator ending the game', async ({ browser }) => {
  const { creator, guest } = await pair(browser)
  const code = await createGame(creator)
  await join(guest, code, 'Troll')
  await openRoomAfterJoin(creator)
  await say(guest, 'something nasty')
  await expect(creator.getByText('something nasty')).toBeVisible()

  await creator.getByRole('button', { name: /game menu/i }).click()
  await creator.getByRole('button', { name: 'Report', exact: true }).click()
  await creator.getByRole('button', { name: 'Harassment' }).click()
  await creator.getByLabel(/details/i).fill('not funny')
  await expect(creator.getByLabel('Also block them')).toBeChecked()
  await shot(creator, '12-report')
  await creator.getByRole('button', { name: 'Send report' }).click()
  await expect(creator.getByText("Thanks. We'll look into it.")).toBeVisible()

  await expect(guest.getByRole('heading', { name: "You've been removed." })).toBeVisible()
  await expect(creator.getByText('The other end disappeared 👻').first()).toBeVisible()

  const game = await admin.getGame(code)
  expect(game.status).toBe('waiting')

  // A new guest joins, then the creator ends the game
  const next = await newPlayer(browser)
  contexts.push(next.context)
  await join(next.page, code, 'Friend')
  await creator.getByRole('button', { name: /open the game/i }).click()
  await creator.getByRole('button', { name: /game menu/i }).click()
  await creator.getByRole('button', { name: 'End game' }).click()
  await creator.getByRole('dialog').getByRole('button', { name: 'End game' }).click()
  await expect(creator.getByRole('heading', { name: 'Game ended.' })).toBeVisible()
  await expect(next.page.getByRole('heading', { name: 'They ended the game.' })).toBeVisible()
})

test('message rate limiting shows a cooldown', async ({ browser }) => {
  const { creator, guest } = await pair(browser)
  const code = await createGame(creator)
  await join(guest, code)
  await openRoomAfterJoin(creator)

  const box = guest.locator('#composer')
  let limited = false
  for (let i = 0; i < 25 && !limited; i++) {
    await box.fill(`spam ${i}`)
    await box.press('Enter')
    await guest.waitForTimeout(120)
    limited = await guest.getByText(/slow down|one message at a time/i).isVisible()
  }
  expect(limited).toBe(true)
})

test('public report page', async ({ browser }) => {
  const { page, context } = await newPlayer(browser)
  contexts.push(context)
  await page.goto('/report')
  await page.getByLabel('Game link').fill('https://anonymass.com/g/ABCDEFG')
  await page.getByRole('button', { name: 'Spam' }).click()
  await page.getByLabel('Details').fill('weird link')
  await page.getByRole('button', { name: 'Send report' }).click()
  await expect(page.getByText("Thanks. We'll look into it.")).toBeVisible()
})

test('static pages and landing', async ({ browser }) => {
  const { page, context } = await newPlayer(browser)
  contexts.push(context)
  await page.goto('/')
  await expect(page).toHaveTitle('ANONYMASS — How Well Do You Know Me?')
  await expect(page.getByRole('heading', { name: /how well do you know me/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /create my game/i }).first()).toBeInViewport()
  await shot(page, '00-landing')
  await page.getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { name: /we don't want your data/i })).toBeVisible()
  await page.getByRole('link', { name: 'Rules' }).click()
  await expect(page.getByRole('heading', { name: /trolling is allowed/i })).toBeVisible()
})

test('desktop layout shows the game status panel', async ({ browser }) => {
  const a = await newPlayer(browser, { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })
  const b = await newPlayer(browser)
  contexts.push(a.context, b.context)
  const code = await createGame(a.page)
  await join(b.page, code)
  await openRoomAfterJoin(a.page)
  await say(b.page, 'hi from my phone')
  await expect(a.page.getByRole('complementary', { name: 'Game status' })).toBeVisible()
  await expect(a.page.getByText('hi from my phone')).toBeVisible()
  await shot(a.page, '13-desktop-room')
})
