// Regenerates the link-preview images and app icon in public/.
// Usage: node scripts/og.mjs
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const page_ = pathToFileURL(`${root}scripts/og.html`).href
const executablePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync)
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const [query, out, clip] of [
  ['', 'og.png', { x: 0, y: 0, width: 1200, height: 630 }],
  ['?game', 'og-game.png', { x: 0, y: 0, width: 1200, height: 630 }],
  ['?icon', 'apple-touch-icon.png', { x: 0, y: 0, width: 180, height: 180 }],
]) {
  await page.goto(`${page_}${query}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${root}public/${out}`, clip })
}
await browser.close()
console.log('wrote public/og.png, public/og-game.png, public/apple-touch-icon.png')
