import { execSync } from 'node:child_process'

// Test configuration. Defaults come from the local Supabase stack
// (`supabase start`), so no keys need to live in the repo.
function fromLocalStack(): Record<string, string> {
  try {
    const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    return JSON.parse(out.slice(out.indexOf('{')))
  } catch {
    return {}
  }
}

const local = process.env.SUPABASE_URL ? {} : fromLocalStack()

export const SUPABASE_URL = process.env.SUPABASE_URL ?? local.API_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? local.PUBLISHABLE_KEY ?? local.ANON_KEY ?? ''
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? local.SERVICE_ROLE_KEY ?? ''
