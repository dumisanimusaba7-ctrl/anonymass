// Regenerates the social card and PNG icons in /public.
// Usage: node scripts/social.mjs  (set CHROMIUM_PATH if Playwright's browser is elsewhere)
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const page_ = pathToFileURL(`${root}scripts/social.html`).href
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto(page_)
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)
await page.screenshot({ path: `${root}public/og.png` })
await page.goto(`${page_}?icon`)
await page.screenshot({ path: `${root}public/apple-touch-icon.png`, clip: { x: 0, y: 0, width: 180, height: 180 } })
await page.setViewportSize({ width: 180, height: 180 })
const small = await browser.newPage({ viewport: { width: 32, height: 32 }, deviceScaleFactor: 1 })
await small.setContent(`<body style="margin:0"><img src="${pathToFileURL(root + 'public/favicon.svg').href}" width="32" height="32"></body>`)
await small.waitForTimeout(200)
await small.screenshot({ path: `${root}public/favicon-32.png`, clip: { x: 0, y: 0, width: 32, height: 32 } })
await browser.close()
console.log('wrote public/og.png, public/apple-touch-icon.png, public/favicon-32.png')
