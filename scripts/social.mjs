// Regenerates the link-preview cards (public/og/*.jpg) and PNG icons.
// Usage: node scripts/social.mjs   (set CHROMIUM_PATH if Playwright's browser is elsewhere)
//
// Each card is 1200×630 JPEG, well under WhatsApp's preview size limit.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const cards = [
  { id: 'home', title: 'Ward, theatre and lab supplies', sub: 'Build a quote list and send it on WhatsApp.', a: 'lab-glassware.jpg', fit: 'cover', b: 'monitors-ultrasound.jpg' },
  { id: 'products', title: 'Every category, one quote list', sub: 'Diagnostics, theatre, wards, sterile services, consumables and lab ware.', a: 'hospital-furniture.jpg', b: 'gloves.jpg' },
  { id: 'diagnostics', title: 'Diagnostics and monitoring', sub: 'Patient monitors, ultrasound, ECG and radiology equipment.', a: 'medical-equipment.jpg', b: 'radiology.jpg' },
  { id: 'theatre', title: 'Theatre and surgery', sub: 'Instruments, anaesthesia products, operating tables and theatre seating.', a: 'surgical-instruments.jpg', fit: 'cover', b: 'anaesthesia.jpg' },
  { id: 'wards', title: 'Wards and patient care', sub: 'Hospital beds, trolleys, plinths, wheelchairs and first aid.', a: 'hospital-furniture.jpg', b: 'first-aid.jpg' },
  { id: 'sterile-services', title: 'Sterile services and storage', sub: 'Packing tables, pouch sealers, autoclaves, sterile shelving and fridges.', a: 'autoclave.jpg', b: 'packing-table.jpg' },
  { id: 'consumables', title: 'Consumables and PPE', sub: 'Gloves, gauze, infection control, waste bins, uniforms and shoes.', a: 'gloves.jpg', b: 'gauze-bandages.jpg' },
  { id: 'laboratory', title: 'Laboratory ware and chemicals', sub: 'Chemicals, glassware and plasticware, listed item by item.', a: 'lab-glassware.jpg', fit: 'cover' },
  { id: 'sterile-room', title: 'From the packing table to the sterile store', sub: 'Autoclave supply, installation and maintenance.', a: 'autoclave.jpg', b: 'pouch-sealer.jpg' },
  { id: 'about', title: 'A medical supplier in Kitwe', sub: 'Optima Industrial Solutions Limited, Light Industrial Area, Kitwe, Zambia.' },
  { id: 'contact', title: 'Call, message or visit', sub: '+260 966 897076 · +260 770 905057' },
]

const root = fileURLToPath(new URL('..', import.meta.url))
const template = pathToFileURL(`${root}scripts/social.html`).href
mkdirSync(`${root}public/og`, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const { id, ...params } of cards) {
  await page.goto(`${template}?${new URLSearchParams(params)}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${root}public/og/${id}.jpg`, type: 'jpeg', quality: 86 })
}

await page.goto(`${template}?icon`)
await page.screenshot({ path: `${root}public/apple-touch-icon.png`, clip: { x: 0, y: 0, width: 180, height: 180 } })
const small = await browser.newPage({ viewport: { width: 32, height: 32 } })
await small.setContent(`<body style="margin:0"><img src="${pathToFileURL(root + 'public/favicon.svg').href}" width="32" height="32"></body>`)
await small.waitForTimeout(200)
await small.screenshot({ path: `${root}public/favicon-32.png`, clip: { x: 0, y: 0, width: 32, height: 32 } })
await browser.close()
console.log(`wrote ${cards.length} cards to public/og/, plus public/apple-touch-icon.png and public/favicon-32.png`)
