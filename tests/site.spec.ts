import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const pages = [
  '/',
  '/products',
  '/products/diagnostics',
  '/products/theatre',
  '/products/wards',
  '/products/sterile-services',
  '/products/consumables',
  '/products/laboratory',
  '/sterile-services',
  '/about',
  '/contact',
  '/quote',
]

const phone = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')))
}

test.describe('every page', () => {
  for (const path of pages) {
    test(`${path}: no sideways scroll at 360px, no console errors, one h1`, async ({ browser }) => {
      const ctx = await browser.newContext(phone)
      const page = await ctx.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await page.goto(path)
      await settle(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
      await expect(page.locator('h1')).toHaveCount(1)
      expect(errors).toEqual([])
      await ctx.close()
    })

    test(`${path}: passes axe (WCAG 2.1 AA)`, async ({ page }) => {
      await page.goto(path)
      await settle(page)
      await page.waitForTimeout(400)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)
      expect(summary).toEqual([])
    })
  }
})

test('unique titles and descriptions', async ({ page }) => {
  const seen = new Set<string>()
  for (const path of pages) {
    await page.goto(path)
    const title = await page.title()
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(seen.has(title), `duplicate title ${title}`).toBe(false)
    seen.add(title)
    expect(description?.length ?? 0).toBeGreaterThan(80)
  }
})

test('quote list: add from catalogue, count updates, edit and build the message', async ({ browser }) => {
  const ctx = await browser.newContext(phone)
  const page = await ctx.newPage()
  await page.goto('/products/consumables')
  await settle(page)
  const gloves = page.getByRole('button', { name: /Add to quote: Gloves/ })
  await gloves.click()
  await expect(gloves).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Add to quote: Medical gauze and bandages/ }).click()
  await expect(page.locator('.mobile-bar [data-quote-count]')).toHaveText('2')

  // Lab items are ticked one by one
  await page.goto('/products/laboratory')
  await settle(page)
  await page.getByLabel('Glass burettes').check()
  await expect(page.locator('.mobile-bar [data-quote-count]')).toHaveText('3')

  await page.goto('/quote')
  await settle(page)
  await expect(page.locator('.qrow')).toHaveCount(3)
  await page.getByRole('button', { name: 'More' }).first().click()
  await page.getByLabel('Note for Gloves').fill('size M')
  await page.getByLabel('Your name').fill('Test Nurse')
  await page.getByLabel(/Hospital, clinic or company/).fill('Kitwe Clinic')
  await page.locator('summary').click()
  const message = await page.locator('[data-preview]').textContent()
  expect(message).toContain('- 2 x Gloves (size M)')
  expect(message).toContain('- 1 x Glass burettes')
  expect(message).toContain('From: Test Nurse, Kitwe Clinic')

  // Removing an item
  await page.getByRole('button', { name: 'Remove Glass burettes' }).click()
  await expect(page.locator('.qrow')).toHaveCount(2)
  await expect(page.locator('.mobile-bar [data-quote-count]')).toHaveText('2')

  // WhatsApp link carries the list
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Send on WhatsApp' }).click(),
  ])
  expect(decodeURIComponent(popup.url()).replaceAll('+', ' ')).toContain('Gloves (size M)')
  await ctx.close()
})

test('quote form asks for a name before sending', async ({ page }) => {
  await page.goto('/products/consumables')
  await settle(page)
  await page.getByRole('button', { name: /Add to quote: Gloves/ }).click()
  await page.goto('/quote')
  await settle(page)
  await page.getByRole('button', { name: 'Send on WhatsApp' }).click()
  await expect(page.getByText('Add your name so we know who the quote is for.')).toBeVisible()
  await expect(page.getByLabel('Your name')).toBeFocused()
})

test('products filter and search', async ({ page }) => {
  await page.goto('/products')
  await settle(page)
  const visible = page.locator('[data-filter-item]:not([hidden])')
  await expect(visible).toHaveCount(28)
  await page.getByRole('button', { name: 'Laboratory', exact: true }).click()
  await expect(visible).toHaveCount(3)
  await expect(page).toHaveURL(/dept=laboratory/)
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByLabel('Search products').fill('autoclave')
  await expect(visible).toHaveCount(1)
  await page.getByLabel('Search products').fill('pipettes')
  await expect(visible).toHaveCount(1)
  await page.getByLabel('Search products').fill('zzzz')
  await expect(page.getByText(/Nothing matches/)).toBeVisible()
  // A shared filtered link opens filtered
  await page.goto('/products?dept=theatre')
  await settle(page)
  await expect(visible).toHaveCount(7)
})

test('home department tabs work with mouse and keyboard', async ({ page }) => {
  await page.goto('/')
  await settle(page)
  const panel = (slug: string) => page.locator(`#panel-${slug}`)
  await expect(panel('diagnostics')).toBeVisible()
  await expect(panel('theatre')).toBeHidden()
  await page.getByRole('tab', { name: /Theatre and surgery/ }).click()
  await expect(panel('theatre')).toBeVisible()
  await expect(panel('diagnostics')).toBeHidden()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /Wards and patient care/ })).toBeFocused()
  await expect(panel('wards')).toBeVisible()
})

test('client-side navigation keeps the header and quote count', async ({ page }) => {
  await page.goto('/products/consumables')
  await settle(page)
  await page.getByRole('button', { name: /Add to quote: Gloves/ }).click()
  const header = await page.locator('[data-header]').elementHandle()
  await page.locator('.site-nav').getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.locator('h1')).toContainText('medical supplier')
  // Same header element survived the navigation
  expect(await header!.evaluate((el) => el.isConnected)).toBe(true)
  await expect(page.locator('[data-header] [data-quote-count]')).toHaveText('1')
  await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('About')
})

test('mobile menu opens, traps nothing, closes on Escape', async ({ browser }) => {
  const ctx = await browser.newContext(phone)
  const page = await ctx.newPage()
  await page.goto('/')
  await settle(page)
  const button = page.getByRole('button', { name: 'Menu' })
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#site-menu').getByRole('link', { name: 'Sterile services' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await button.click()
  await page.locator('#site-menu').getByRole('link', { name: 'Contact' }).click()
  await expect(page).toHaveURL(/\/contact$/)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await ctx.close()
})

test('contact form validates and opens WhatsApp with the message', async ({ page }) => {
  await page.goto('/contact?topic=autoclave%20maintenance')
  await settle(page)
  await expect(page.getByLabel('What do you need?')).toHaveValue('About autoclave maintenance: ')
  await page.getByRole('button', { name: 'Send on WhatsApp' }).click()
  await expect(page.getByText('Add your name so we know who to reply to.')).toBeVisible()
  await page.getByLabel('Your name').fill('Theatre Sister')
  await page.getByLabel('What do you need?').fill('Two IV stands')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Send on WhatsApp' }).click()])
  expect(decodeURIComponent(popup.url()).replaceAll('+', ' ')).toContain('Two IV stands')
  await expect(page.getByText(/WhatsApp should now be open/)).toBeVisible()
})

test('hero mark morphs into a red cross on scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(1500)
  const fill = () => page.locator('#hero-mark [data-blade="1"]').getAttribute('fill')
  expect(await fill()).toBe('#ef5d22')
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(400)
  expect(await fill()).toBe('#e30613')
})

test('header tucks away on scroll down and returns on scroll up', async ({ page }) => {
  await page.goto('/products')
  await settle(page)
  const header = page.locator('[data-header]')
  await page.mouse.wheel(0, 900)
  await expect(header).toHaveClass(/is-tucked/)
  await page.mouse.wheel(0, -200)
  await expect(header).not.toHaveClass(/is-tucked/)
})

test('department row on phones: active tab centred, marker and rail shown', async ({ browser }) => {
  const ctx = await browser.newContext(phone)
  const page = await ctx.newPage()
  await page.goto('/')
  await settle(page)
  const track = page.locator('.depts__tabs')
  await expect(page.locator('.depts__rail')).toBeVisible()
  await page.getByRole('tab', { name: /Sterile services and storage/ }).click()
  await page.waitForTimeout(700)
  const centred = await page.evaluate(() => {
    const t = document.querySelector('.depts__tabs')!.getBoundingClientRect()
    const a = document.querySelector('#tab-sterile-services')!.getBoundingClientRect()
    return Math.abs(a.left + a.width / 2 - (t.left + t.width / 2))
  })
  expect(centred).toBeLessThan(24)
  const marker = await page.locator('.depts__tabs .scroller__indicator').boundingBox()
  const tab = await page.locator('#tab-sterile-services').boundingBox()
  expect(Math.abs(marker!.x - tab!.x)).toBeLessThan(2)
  expect(Math.abs(marker!.width - tab!.width)).toBeLessThan(2)
  // Each department photo stays inside its circle frame
  const lens = await page.locator('#panel-sterile-services .dept-panel__lens').boundingBox()
  expect(lens!.width).toBeLessThan(130)
  await expect(track).toBeVisible()
  await ctx.close()
})

test('reduced motion: content is visible and nothing animates', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => window.scrollTo(0, 1200))
  const hidden = await page.evaluate(
    () => [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length,
  )
  expect(hidden).toBe(0)
  await ctx.close()
})

test('every page has a link-preview card that loads', async ({ page, request }) => {
  for (const path of pages) {
    await page.goto(path)
    const image = await page.locator('meta[property="og:image"]').getAttribute('content')
    const width = await page.locator('meta[property="og:image:width"]').getAttribute('content')
    expect(image, `${path} og:image`).toMatch(/^https?:\/\/.+\/og\/[a-z-]+\.jpg$/)
    expect(width).toBe('1200')
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/)
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    // Fetch the card from this server (the absolute host may not exist locally).
    const res = await request.get(new URL(image!).pathname)
    expect(res.status(), `${path} card`).toBe(200)
    expect(res.headers()['content-type']).toContain('image/jpeg')
    expect((await res.body()).length).toBeLessThan(300_000)
  }
})
