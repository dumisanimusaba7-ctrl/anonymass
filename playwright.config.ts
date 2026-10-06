import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { ANON_KEY, SUPABASE_URL } from './e2e/env'

// Use the preinstalled Chromium when present (CI images, cloud sandboxes).
const chromiumPath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p))
const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: 'api', testMatch: /api\.spec\.ts/ },
    { name: 'browser', testMatch: /game\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { VITE_SUPABASE_URL: SUPABASE_URL, VITE_SUPABASE_ANON_KEY: ANON_KEY },
      },
})
