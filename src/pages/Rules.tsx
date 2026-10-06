import { ButtonLink, Page, TextLink } from '../components/ui'

export default function Rules() {
  return (
    <Page>
      <p className="eyebrow">The rules</p>
      <h1 className="headline mt-4 text-[clamp(2.8rem,13vw,5rem)]">
        Trolling is allowed.
        <br />
        <span className="text-volt">Abuse is not.</span>
      </h1>

      <div className="prose-anx mt-8">
        <h2>How it works</h2>
        <ul>
          <li>Someone creates a game and shares their link.</li>
          <li>The first person to click it joins anonymously and seals their real name.</li>
          <li>They chat. The guesser asks questions and begs for hints.</li>
          <li>
            The guesser gets <strong>one</strong> final guess. Then everyone is revealed.
          </li>
        </ul>

        <h2>Lying is part of the game</h2>
        <p>
          If you're the anonymous one, you can answer honestly, lie, troll, give fake hints or stay completely mysterious. Nobody
          has to tell the truth in the chat.
        </p>
        <p>
          The one exception: the name you seal when you join must be your real name (or the name they'd know you by). That's what
          gets revealed and what the guess is checked against.
        </p>

        <h2>Not allowed. Ever.</h2>
        <ul>
          <li>Harassment, bullying or targeting someone.</li>
          <li>Threats or encouraging self-harm.</li>
          <li>Sexual content, or anything sexual involving minors.</li>
          <li>Hate speech or abuse based on who someone is.</li>
          <li>Sharing someone else's private information.</li>
          <li>Spam, scams or links to anything sketchy.</li>
        </ul>

        <h2>If something feels wrong</h2>
        <p>
          Use <strong>Report</strong> in the game menu. Guessers can also <strong>block</strong> the person in their game, and
          anyone can <strong>leave</strong> at any time. You can also <TextLink to="/report">report a link</TextLink> without
          being in the game.
        </p>
        <p>If anyone is in immediate danger, contact your local emergency services.</p>

        <h2>The fine print</h2>
        <ul>
          <li>Text only. No images, voice, files or locations.</li>
          <li>Games expire after 24 hours.</li>
          <li>Messages are rate limited. Spamming earns you a timeout.</li>
        </ul>
      </div>

      <ButtonLink to="/create" className="mt-10 w-full sm:w-auto">
        Make a game <span aria-hidden="true">→</span>
      </ButtonLink>
    </Page>
  )
}
