import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const executablePath =
  process.env.CHROMIUM_PATH ?? ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find((p) => existsSync(p))

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4322',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npx astro preview --port 4322 --ignore-lock',
    port: 4322,
    reuseExistingServer: true,
  },
})
