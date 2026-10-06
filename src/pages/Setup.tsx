import { Page } from '../components/ui'

/** Shown in development when the Supabase env vars are missing. */
export default function Setup() {
  return (
    <Page>
      <h1 className="headline text-5xl">Almost there.</h1>
      <div className="prose-anx mt-6">
        <p>
          The game backend isn't configured. Set <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong>{' '}
          (see <strong>.env.example</strong> and the README), then restart the dev server or redeploy.
        </p>
      </div>
    </Page>
  )
}
