import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Absolute site URL for Open Graph tags. Netlify sets URL at build time;
// VITE_SITE_URL overrides it (e.g. for a custom domain).
const siteUrl = (process.env.VITE_SITE_URL || process.env.URL || '').replace(/\/$/, '')

function siteUrlPlugin(): Plugin {
  return {
    name: 'anonymass-site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  }
}

// Two HTML entry points share the same app bundle. `g.html` only differs in
// its meta tags so that shared game links get their own link preview.
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlPlugin()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        game: resolve(import.meta.dirname, 'g.html'),
      },
    },
  },
})
