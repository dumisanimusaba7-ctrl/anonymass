import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// Link previews (WhatsApp, Facebook, LinkedIn, X) need absolute URLs, so the
// build must know the public address of the site. In order of preference:
//   1. PUBLIC_SITE_URL, set by you once the custom domain is live
//   2. Vercel's production domain (set automatically on every Vercel build)
//   3. The Vercel deployment URL
//   4. Netlify's site URL
const fromHost = (host) => (host ? `https://${host}` : undefined)
const site = (
  process.env.PUBLIC_SITE_URL ||
  fromHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  fromHost(process.env.VERCEL_URL) ||
  process.env.URL ||
  'http://localhost:4321'
).replace(/\/$/, '')

if (process.env.VERCEL || process.env.NETLIFY) console.log(`[optima] Link previews and canonical URLs use ${site}`)

export default defineConfig({
  site,
  trailingSlash: 'never',
  integrations: [sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  build: { inlineStylesheets: 'auto' },
})
