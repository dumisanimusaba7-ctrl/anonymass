-- =============================================================================
-- ANONYMASS — product metrics
--
-- Read-only views for the Supabase SQL editor / dashboard. They live in the
-- `analytics` schema, which is not exposed through the API and not readable by
-- the anon or authenticated roles.
--
--   select * from analytics.daily;
--   select * from analytics.summary;
-- =============================================================================

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

-- One row per day with the funnel and engagement numbers.
create view analytics.daily as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where name = 'landing_view') as landing_views,
  count(*) filter (where name = 'game_created') as games_created,
  count(*) filter (where name = 'game_joined') as games_joined,
  count(*) filter (where name in ('link_copied', 'share_clicked')) as link_shares,
  count(*) filter (where name = 'message_sent') as messages,
  count(*) filter (where name = 'hint_requested') as hints_requested,
  count(*) filter (where name = 'guess_submitted') as guesses,
  count(*) filter (where name = 'guess_correct') as guesses_correct,
  count(*) filter (where name = 'game_completed') as games_completed,
  count(*) filter (where name = 'game_abandoned') as games_abandoned,
  count(*) filter (where name = 'result_shared') as results_shared,
  count(*) filter (where name = 'replay_clicked') as replays,
  count(*) filter (where name = 'report_submitted') as reports
from public.events
group by 1
order by 1 desc;

-- The key questions from the brief, over the last 30 days.
create view analytics.summary as
with e as (
  select * from public.events where created_at > now() - interval '30 days'
),
created as (
  select game_id, device_hash from e where name = 'game_created'
),
completed as (
  select game_id, props from e where name = 'game_completed'
)
select
  -- Virality
  (select count(*) from created) as games_created,
  (select count(*) from e where name = 'game_joined') as games_joined,
  round((select count(*) from e where name = 'game_joined')::numeric
        / nullif((select count(*) from created), 0), 2) as guests_per_link,
  round((select count(distinct game_id) from e where name in ('link_copied', 'share_clicked'))::numeric
        / nullif((select count(*) from created), 0), 2) as share_rate,
  -- Engagement
  round((select count(*) from e where name = 'message_sent')::numeric
        / nullif((select count(distinct game_id) from e where name = 'game_joined'), 0), 1) as messages_per_joined_game,
  round((select count(*) from completed)::numeric
        / nullif((select count(distinct game_id) from e where name = 'game_joined'), 0), 2) as completion_rate,
  (select round(avg((props ->> 'duration')::numeric)) from completed) as avg_duration_seconds,
  (select round(avg((props ->> 'hints_requested')::numeric), 1) from completed) as hints_per_completed_game,
  round((select count(*) from e where name = 'guess_correct')::numeric
        / nullif((select count(*) from e where name = 'guess_submitted'), 0), 2) as correct_guess_rate,
  -- Retention
  round((select count(*) from created)::numeric
        / nullif((select count(distinct device_hash) from created), 0), 2) as games_per_creating_device,
  (select count(*) from (select device_hash from created group by 1 having count(*) > 1) r) as repeat_creator_devices;

revoke all on all tables in schema analytics from public, anon, authenticated;
