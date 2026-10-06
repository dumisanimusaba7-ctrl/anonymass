# ANONYMASS

**How well do you know me?**

Create a game, share the link anywhere, and try to figure out who anonymously clicked it. They can answer honestly, lie, troll, or drop one tiny clue that gives everything away. You get one final guess. Then everyone is revealed.

```
CREATE → SHARE → CLICK → ANONYMOUS CHAT → HINTS → GUESS → REVEAL → SHARE
```

No accounts, no payments, no AI, no paid APIs. Everything runs on the Supabase and Netlify free tiers.

---

## Stack

| Piece | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Supabase Postgres (RPC functions), Supabase Realtime (broadcast) |
| Hosting | Netlify (static site, no functions) |
| Tests | Playwright (API security tests + two-player browser tests) |

The landing page ships ~70 KB of gzipped JS. The game screens and the realtime client are lazy-loaded. Fonts (Geist, Geist Mono) are self-hosted.

## How it works

### Game flow

1. **Create** (`/create`): the creator enters their name, an optional nickname and a difficulty, and gets a random link like `/g/7XK29FQ`.
2. **Share**: copy the link or use the native share sheet. The share screen waits for someone to click.
3. **Join** (`/g/:code`): the first person to open the link becomes the anonymous player. They seal their real name (plus optional nicknames that count as correct). It's hidden until the reveal.
4. **Play**: realtime text chat. The guesser can ask for hints; the anonymous player can answer, give a (structured) hint, stay mysterious or troll. Lying is allowed.
5. **Guess**: one final guess, checked server-side against the sealed name (first name, full name or any alias, ignoring case, accents and punctuation).
6. **Reveal + result**: suspense reveal, a result card with time/questions/hints/score, then share it or make another game.

### Product decisions worth knowing

- **One anonymous player per link at a time.** Later clickers see "Someone beat you to it" with a big "Make a game" button, which is the viral conversion point. If the anonymous player leaves or is blocked, the seat reopens and the next person starts from a clean conversation.
- **The creator's name is shown to whoever opens the link** ("Dumisani's game") so they know whose game they walked into. The *guest's* name is what gets revealed.
- **Difficulty only changes hint timing**: Easy (hints any time, 20s cooldown, 10 max), Normal (unlock after 45s, 45s cooldown, 7 max), Evil (unlock after 2 min, 2 min cooldown, 4 max).
- **Score** (correct guesses only): `100 − 8×hints − 2×(questions beyond 5) − 3×(minutes beyond the first)`, minimum 5. It's there to make results shareable, nothing more.
- **Games last 24 hours.**

### Security model

There are no accounts, so access is capability-based:

- Creating or joining a game returns a random 64-character **seat token** (~244 bits of randomness, stored in `localStorage` with a cookie fallback). Only its SHA-256 hash is stored.
- **Clients never touch tables.** Every table has Row Level Security enabled with *no policies*, and all table privileges are revoked from `anon`/`authenticated`. The browser can only call a fixed set of `SECURITY DEFINER` functions, and each one checks `(share_code, token)` first. That rules out listing games, reading other games, editing messages, changing results, extra guesses and reading reports.
- Helpers live in a `private` schema and metrics in an `analytics` schema. Neither is exposed through the API.
- Share codes are 7 random characters from an unambiguous 31-symbol alphabet (~27 billion combinations). Probing links is rate-limited.
- Player IDs never leave the database: messages only carry a `mine` flag. The anonymous player's sealed name is only returned after the game completes.
- **Realtime**: state changes ping a broadcast topic named after a random per-game channel key that only participants receive. Pings carry no content (clients re-fetch through the API), and the key rotates whenever the guest seat changes hands. If Realtime is unavailable the app falls back to polling.
- **Rate limits** (enforced in Postgres): 15 messages per 30s per player, then a 20s cooldown; a 350ms burst guard; 300 messages per round; game creation, joins, link probing and reports are throttled per device and per IP (salted hashes only, deleted within a day).
- **Safety**: text only (no media), 500-character messages, report (with a saved conversation snapshot), block (creator removes the guest; that device can't rejoin), leave/end at any time.

### Data retention

- Games are playable for 24 hours.
- Expired games and everything about them (messages, hints, guesses, sealed names) are **deleted within ~24 hours of expiry** by `public.purge_old_games()`, scheduled every 30 minutes with `pg_cron` (with an opportunistic fallback inside `create_game`).
- Reports keep their own snapshot for 90 days. Anonymous product events are kept for 180 days.

## Project structure

```
src/
  App.tsx               tiny router + lazy routes
  pages/                Landing, Create, Game (join gate + session), Privacy, Rules, Report
  components/           Room (game room), ShareScreen, Result (magic moment, reveal, result card), UI kit
  hooks/useGame.ts      state, incremental messages, realtime + polling, actions
  lib/                  API client, identity storage, realtime, share, analytics, copy
supabase/
  migrations/           schema, security, game logic, metrics views
  config.toml           local stack config
e2e/                    Playwright: api.spec.ts (security/logic), game.spec.ts (two-player browser flows)
g.html                  same app, different meta tags, so shared /g/* links get their own preview
netlify.toml            build, rewrites, security headers
scripts/og.mjs          regenerates the Open Graph images in public/
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Your project URL, e.g. `https://abcd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | yes | The project's **anon** key or **publishable** key (`sb_publishable_…`). Both work. It is public by design: the database only exposes the game functions. |
| `VITE_SITE_URL` | no | Absolute site URL for Open Graph tags (e.g. `https://anonymass.com`). On Netlify the deploy URL is used automatically. |

Never put a `service_role` / secret key in the frontend. The app doesn't need one.

Copy `.env.example` to `.env.local` for local development.

## Local development

Requires Node 20+ and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # local Postgres, API and Realtime; applies migrations
npx supabase status         # shows the local API URL and publishable/anon key
cp .env.example .env.local  # paste the local URL + key
npm run dev                 # http://localhost:5173
```

Use a second browser profile or an incognito window to play the other side.

`npx supabase db reset` re-applies the migrations from scratch.

## Tests

```bash
npx supabase start
npm run test:e2e
```

- `e2e/api.spec.ts` hits the real REST API with the public key: tables unreadable/unwritable, private functions unreachable, tokens scoped to their game, identity hidden until the reveal, message validation, rate limiting, hint cooldowns, one-guess rule, name matching, leave/block/cancel, reports, expiry and purge, isolation between simultaneous games, link-probe throttling.
- `e2e/game.spec.ts` runs two real browser contexts (like an incognito window) at 390px: create → share → join → magic moment → realtime chat and typing → hints → guessing → wrong and correct reveals → results, latecomers, invalid links, expiry, leaving and seat reopening, refresh/reconnect, report + block, ending a game, UI rate limiting, desktop layout.

Set `SHOTS=1` to save screenshots of every key screen to `test-results/shots/`. The suite reads keys from `npx supabase status`, so no secrets live in the repo. To run it against another project, set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_KEY` (used only for test setup such as forcing expiry).

## Deploying

### 1. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations, either:
   - with the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`, or
   - by pasting `supabase/migrations/*.sql` (in order) into the SQL editor.
3. Check that **Realtime → Settings → "Allow public access"** is enabled (the default). The game uses public broadcast topics with secret names. If you turn it off, the game still works but falls back to polling every 2.5s.
4. Check that the purge job exists: `select * from cron.job;` should list `anonymass-purge`. If `pg_cron` wasn't available when the migration ran, enable it under **Integrations → Cron** and run:
   ```sql
   select cron.schedule('anonymass-purge', '*/30 * * * *', 'select public.purge_old_games()');
   ```
5. Copy the project URL and anon/publishable key from **Project Settings → API**.

No auth providers, storage buckets, edge functions or third-party services are needed.

### 2. Netlify (free tier)

1. Import the repository in Netlify. Build settings come from `netlify.toml` (`npm run build`, publish `dist`).
2. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and `VITE_SITE_URL` if you use a custom domain).
3. Deploy. `netlify.toml` rewrites `/g/*` to `g.html` (game link previews) and everything else to the SPA, and sets security headers including a CSP that only allows connections to `*.supabase.co`.

## Moderation and metrics

There's no admin UI in V1. Use the Supabase dashboard:

```sql
-- Open reports, newest first (snapshot holds the reported conversation)
select created_at, category, source, share_code, description, snapshot
from public.reports where status = 'open' order by created_at desc;

-- Mark one handled
update public.reports set status = 'actioned' where id = '<id>';

-- Kill a game immediately
update public.games set status = 'cancelled' where share_code = '<CODE>';

-- Product metrics
select * from analytics.summary;  -- last 30 days: virality, engagement, retention
select * from analytics.daily;    -- day-by-day funnel
```

Tracked events: `landing_view`, `game_created`, `link_copied`, `share_clicked`, `game_joined`, `message_sent`, `hint_requested`, `guess_started`, `guess_submitted`, `guess_correct`, `guess_wrong`, `game_completed`, `game_abandoned`, `report_submitted`, `replay_clicked` (plus `create_viewed`, `join_viewed`, `result_shared`). Game events are recorded server-side; only page/share events come from the browser.

## Free-tier notes

- No paid APIs, no AI, no auth provider. Everything fits the Supabase free tier (database, API and Realtime; check Supabase's pricing page for current quotas). Data is purged daily, so the database stays small.
- Netlify serves static files only.
- Realtime connections are only opened inside a game, never on the landing page.

## Deliberately not built

Accounts, profiles, feeds, friends, leaderboards, DMs outside games, media, voice, push notifications, payments, AI, native apps, admin dashboard. If a feature doesn't directly improve create → share → play → guess → reveal → share, it waits until the core loop proves people want it.
