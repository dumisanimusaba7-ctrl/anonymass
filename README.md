# Optima Medical Supplies website

Website for **Optima Industrial Solutions Limited, Medical Supplies** (Kitwe, Zambia), built from the 2024 company profile and the Alldit Anti-AI-Slop Guide.

Visitors browse the range, add products to a **quote list**, and send that list to Optima on **WhatsApp or by email**. There is no server, database or account system: the list lives in the visitor's browser until they send it.

## Pages

| Page | Path | What it does |
| --- | --- | --- |
| Home | `/` | Hero, department explorer, lab list, sterile services teaser, live quote list preview, contact details |
| Products | `/products` | All 28 categories with department filter and search (shareable as `?dept=…&q=…`) |
| Departments | `/products/diagnostics`, `theatre`, `wards`, `sterile-services`, `consumables`, `laboratory` | Catalogue plates with "Add to quote"; the laboratory page lists all 28 items as tick boxes |
| Sterile services | `/sterile-services` | The four steps of a sterile services room (pack, seal, sterilise, store), plus autoclave installation and maintenance |
| About | `/about` | Company details and the range by department |
| Contact | `/contact` | Phones, WhatsApp, emails, fax, address, directions, enquiry form (opens WhatsApp or email) |
| Quote list | `/quote` | Quantities, notes, contact details; send on WhatsApp or email, copy or print |
| 404 | any unknown path | Links back to products and home |

## Brand decisions

- **Colours** are sampled from the profile PDF: indigo `#333399` (cover), navy `#000066` (lab panel), sky blue `#5B9BD5` (catalogue label bars), ice blue `#CCECFF` and red (cover wave), and the four logo blade colours. The red is darkened very slightly to `#E30613` so it passes WCAG AA as text. Catalogue label bars keep the exact sky blue but use navy text, because white on that blue fails contrast.
- **Type**: Saira Extra Condensed for headings (closest free match to the tall, rounded wordmark) and Jost for body text (a geometric face in the spirit of the Century Gothic used in the profile). Both are self-hosted.
- **Logo**: the four-blade mark is redrawn as an SVG from a 400 dpi render of the profile, keeping its 90° symmetry. It always sits on indigo, as in the profile.
- **Signature element**: the logo blades. They assemble when the home page opens and morph into a medical cross as you scroll. The header mark turns a quarter each time you change page.
- **Brand devices reused**: circular photo "lenses" with an ice-blue rim (profile cover), sky-blue label bars over product photos (profile catalogue pages), and the red-and-ice wave (cover), used once, on top of the footer.

### Anti-AI-Slop Guide checklist

- Tokens defined first (`src/styles/global.css`): colours, type scale, radius scale, spacing, motion.
- No gradients, glows, coloured shadows, blur, glass or aurora backgrounds anywhere.
- No pulsing or "Live"/"New" badges. The only red badge is the quote count, and it only shows when the list has items.
- No badge above the H1, no thick one-sided card borders, no row of three identical icon cards.
- Small radius scale (4/8/12px). Circles are used only for the brand lens device.
- Real product photos from the company profile, no stock or generated imagery, no emoji icons.
- No invented numbers, names or testimonials. Every count on the site is computed from the catalogue data.
- Copy has no buzzwords or em dashes ("Solutions" appears only in the legal company name).
- WCAG 2.1 AA verified with axe on every page. LCP image has `fetchpriority="high"`. Custom favicon and social card.

### Motion

All motion is tied to something the visitor does, and every piece is switched off under `prefers-reduced-motion`.

- Hero: logo blades assemble on arrival; scroll morphs them into a medical cross.
- Page transitions (Astro view transitions): the header persists, content fades up, and a department's photo and title morph into the department page header.
- Department explorer: circular wipe on the photo, category list comes in line by line.
- Products filter: tiles slide to their new positions (FLIP) instead of jumping.
- Add to quote: the plus turns into a drawn tick, a red dot flies to the quote counter, and the counter bumps.
- Sterile services: a progress line fills as you scroll and each step lights up when reached.
- Mobile menu: circular wipe from the menu button; the hamburger morphs into a cross.
- One scroll-reveal type (fade and 12px rise), played once.

## Before launch: please confirm

1. **WhatsApp number.** WhatsApp buttons go to **+260 966 897076**. Confirm that number is on WhatsApp, or change `whatsapp` in `src/data/site.ts`.
2. **Email address.** The profile prints `info@optimaindustrialcom.com`. That may be missing a dot (`optimaindustrial.com`). It is used exactly as printed in `src/data/site.ts`.
3. **Photo quality.** The product photos were extracted from the PDF and some are small (about 130 to 600px wide). The site never upscales them, but original photos would look sharper. Drop replacements into `src/assets/products/` with the same file names.
4. **Catalogue labels.** Two photos in the PDF carry the wrong heading. The IV stand and Mayo trolley (page 6, labelled "Autoclaves") are shown as "IV stands and instrument trolleys". The pouch sealers (page 7, labelled "Patient trolleys and plinths") are shown as "Pouch sealers". "Hospital funiture" is spelled correctly on the site.
5. **Not stated in the profile, so not on the site:** opening hours, years trading, prices, delivery areas, brands carried. Add them to the data files if you want them shown.
6. **Domain.** Set `PUBLIC_SITE_URL` (for example `https://www.optimaindustrial.com`) so canonical links, the sitemap and social cards use the real domain.

## Editing content

- **Products, departments and lab items:** `src/data/catalogue.ts`
- **Company name, address, phones, emails, WhatsApp:** `src/data/site.ts`
- **Product photos:** `src/assets/products/` (Astro resizes them and serves WebP automatically)
- **Colours, type and spacing:** the tokens at the top of `src/styles/global.css`
- **Social card and PNG icons:** edit `scripts/social.html`, then run `node scripts/social.mjs`

## Develop, test, deploy

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # type-checks, then builds the static site into dist/
npm run preview    # serves dist/
npm test           # Playwright: layout at 360px, axe accessibility, quote list, filters, menu, forms, motion
```

The tests need a Chromium browser. Run `npx playwright install chromium` once, or set `CHROMIUM_PATH` to an existing Chrome or Chromium.

**Deploy:** the site is fully static. On Vercel or Netlify, import the repository. Both detect Astro and use `npm run build` with `dist` as the output folder. Add `PUBLIC_SITE_URL` as an environment variable. No other services, keys or databases are needed.

## Project structure

```
src/
  data/           catalogue.ts (departments, categories, items), site.ts (contact details)
  assets/products catalogue photos from the company profile
  components/     Header, Footer, MobileBar, Mark (logo), Plate, AddToQuote, LabList, QuotePreview, Breadcrumbs
  layouts/        Base.astro (SEO, social tags, LocalBusiness structured data, view transitions)
  pages/          index, products/index, products/[department], sterile-services, about, contact, quote, 404, robots.txt
  scripts/        quote store and UI, hero mark morph, department explorer, catalogue filter, reveal, motion helpers
  styles/         global.css (tokens and shared components)
scripts/          social card and icon generator
tests/            Playwright suite
```
