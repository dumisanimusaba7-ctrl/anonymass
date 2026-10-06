import { Page, TextLink } from '../components/ui'

export default function Privacy() {
  return (
    <Page>
      <p className="eyebrow">Privacy</p>
      <h1 className="headline mt-4 text-[clamp(2.8rem,13vw,5rem)]">
        We don't want <span className="text-volt">your data.</span>
      </h1>

      <div className="prose-anx mt-8">
        <p>
          ANONYMASS is a game, not a social network. There are no accounts and no profiles. Here is everything we store and why,
          in plain language.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Names you type in.</strong> The guesser's name (shown to whoever opens their link) and the anonymous player's
            sealed name (revealed at the end of the game). Use whatever name your friends know you by.
          </li>
          <li>
            <strong>Messages and hints</strong> sent during a game, plus the final guess.
          </li>
          <li>
            <strong>A random game ID and seat token.</strong> When you create or join a game your browser gets a random secret
            that proves the seat is yours. We only store a one-way hash of it.
          </li>
          <li>
            <strong>A random device ID</strong> (like <code className="font-mono">anon_8f71b92c…</code>) kept in your browser's
            storage. It is hashed before it reaches us and is only used to prevent spam and count repeat games.
          </li>
          <li>
            <strong>Reports</strong> you submit, including a copy of the reported conversation.
          </li>
          <li>
            <strong>Basic product events</strong> such as "game created" or "link copied", attached to the hashed device ID. No
            advertising trackers, no third-party analytics.
          </li>
        </ul>

        <h2>What we don't collect</h2>
        <ul>
          <li>No email, phone number, address, contacts or account.</li>
          <li>No GPS or precise location.</li>
          <li>No photos, voice or files. The game is text only.</li>
          <li>
            Your IP address is never stored in readable form or shown to the other player. A salted hash of it is used for rate
            limiting and deleted within a day.
          </li>
        </ul>

        <h2>Who can see what</h2>
        <ul>
          <li>The guesser never sees who the anonymous player is until the reveal.</li>
          <li>Players can only ever access the game they are in. Nobody can browse other games.</li>
          <li>Reports are only visible to the people who run ANONYMASS, for moderation.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Games expire 24 hours after they're created.</li>
          <li>
            Expired games are permanently deleted, along with their messages, hints, guesses and sealed names, within about a day
            after that.
          </li>
          <li>Reports (and their conversation copy) are kept for up to 90 days, then deleted.</li>
          <li>Anonymous product events are kept for up to 180 days.</li>
        </ul>

        <h2>Deleting your stuff</h2>
        <p>
          Leaving or ending a game stops it immediately, and everything is deleted automatically on the schedule above. To clear
          the IDs stored on your device, clear this site's data in your browser.
        </p>

        <h2>Honest limits</h2>
        <p>
          Anything you type can be screenshotted by the other player. Anonymity here is about the game, not a guarantee against
          someone working out who you are from what you say. Don't share anything you wouldn't want seen.
        </p>
        <p>
          The game runs on Supabase (database) and Netlify (hosting), which process data on our behalf. Questions? Use the{' '}
          <TextLink to="/report">Report</TextLink> page.
        </p>
      </div>
    </Page>
  )
}
