import { execSync } from 'node:child_process'
import { SUPABASE_URL } from './env'

// Local runs share one IP, so clear rate-limit counters between runs.
export default function globalSetup() {
  if (!/127\.0\.0\.1|localhost/.test(SUPABASE_URL)) return
  try {
    execSync(
      `psql "${process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'}" -qc "truncate private.throttle"`,
      { stdio: 'ignore' },
    )
  } catch {
    console.warn('Could not reset rate limits (psql missing?). Tests may hit throttles on repeated runs.')
  }
}
