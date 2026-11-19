import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// Canonical site URL for sitemap, canonical links and social cards.
// Set PUBLIC_SITE_URL once the domain is live; Netlify (URL) and Vercel
// (VERCEL_PROJECT_PRODUCTION_URL) provide a fallback automatically.
const site =
  process.env.PUBLIC_SITE_URL ||
  process.env.URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4321')

export default defineConfig({
  site,
  integrations: [sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  build: { inlineStylesheets: 'auto' },
})
