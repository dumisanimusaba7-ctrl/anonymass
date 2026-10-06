-- =============================================================================
-- ANONYMASS — schema, security and game logic
--
-- Security model
-- --------------
-- There are no accounts. Every participant gets a random secret token when
-- they create or join a game; only its SHA-256 hash is stored.
--
-- Clients never touch tables. Every table has RLS enabled with *no* policies
-- and all privileges revoked from the API roles (anon, authenticated). The
-- only way in is the small set of SECURITY DEFINER functions at the bottom of
-- this file, each of which checks (share_code, token) before doing anything.
-- That makes it impossible to list games, read another game's messages, edit
-- messages, rewrite results, submit extra guesses or read reports.
--
-- Realtime
-- --------
-- State changes ping a public Realtime broadcast topic named after a random
-- per-game channel key that is only ever handed to participants. Pings carry
-- no content; clients re-fetch state through get_state(). The key rotates
-- whenever the guest seat changes hands.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Single-row config. The salt is used to hash device ids and IP addresses so
-- that raw values are never stored.
create table private.config (
  id boolean primary key default true check (id),
  salt text not null default encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex')
);
insert into private.config default values;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  share_code text not null unique check (share_code ~ '^[2-9A-HJKMNP-Z]{7}$'),
  creator_player_id uuid,
  creator_display_name text not null check (char_length(creator_display_name) between 1 and 40),
  creator_nickname text check (char_length(creator_nickname) between 1 and 40),
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'guessing', 'completed', 'expired', 'cancelled')),
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'evil')),
  -- A "round" is one guest's turn in the seat. If a guest leaves or is
  -- blocked the round advances, so the next guest never sees old messages.
  round integer not null default 1,
  channel_key text not null default encode(uuid_send(gen_random_uuid()), 'hex'),
  message_seq integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  round_started_at timestamptz,
  completed_at timestamptz,
  winner text check (winner in ('creator', 'guest')),
  score integer check (score between 0 and 100)
);
create index games_expires_at_idx on public.games (expires_at);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  role text not null check (role in ('creator', 'guest')),
  anonymous_name text not null,
  token_hash text not null unique,
  device_hash text,
  round integer not null default 1,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  is_banned boolean not null default false,
  left_reason text check (left_reason in ('left', 'blocked')),
  muted_until timestamptz
);
create index players_game_id_idx on public.players (game_id);

alter table public.games
  add constraint games_creator_player_id_fkey
  foreign key (creator_player_id) references public.players (id) on delete set null;

-- The name a guest seals when they join. It is what gets revealed at the end
-- and what the guess is checked against. Kept apart from `players` so the
-- players table never holds anything identifying.
create table public.player_secrets (
  player_id uuid primary key references public.players (id) on delete cascade,
  sealed_name text not null check (char_length(sealed_name) between 1 and 40),
  aliases text[] not null default '{}'
);

create table public.messages (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  round integer not null,
  seq integer not null,
  kind text not null default 'text' check (kind in ('text', 'hint', 'hint_request', 'mysterious')),
  category text,
  content text not null default '' check (char_length(content) <= 500),
  created_at timestamptz not null default now(),
  unique (game_id, seq)
);
create index messages_player_created_idx on public.messages (player_id, created_at);
create index messages_game_round_idx on public.messages (game_id, round, seq);

create table public.guesses (
  id uuid primary key default gen_random_uuid(),
  -- One final guess per game, enforced by the database.
  game_id uuid not null unique references public.games (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  guess text not null check (char_length(guess) between 1 and 60),
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table public.hints (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  round integer not null,
  -- null when the guest volunteered a hint nobody asked for
  requested_by uuid references public.players (id) on delete cascade,
  content text check (char_length(content) <= 500),
  category text check (category in (
    'age', 'city', 'school', 'work', 'mutual_friend', 'hobby', 'personality', 'shared_memory', 'random_fact'
  )),
  message_id bigint references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index hints_game_round_idx on public.hints (game_id, round);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete set null,
  share_code text,
  reporter_player_id uuid references public.players (id) on delete set null,
  reporter_role text check (reporter_role in ('creator', 'guest')),
  category text not null check (category in ('harassment', 'threats', 'sexual', 'spam', 'hate', 'other')),
  description text check (char_length(description) <= 1000),
  -- Copy of the reported conversation, so evidence survives the game purge.
  snapshot jsonb,
  source text not null default 'in_game' check (source in ('in_game', 'public')),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Minimal product analytics. No IPs, no raw device ids.
create table public.events (
  id bigint generated always as identity primary key,
  name text not null,
  game_id uuid,
  device_hash text,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_name_created_idx on public.events (name, created_at);

-- Sliding-window rate limiting keyed by salted hashes.
create table private.throttle (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index throttle_lookup_idx on private.throttle (bucket, key_hash, created_at);

-- -----------------------------------------------------------------------------
-- Lock everything down
-- -----------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.player_secrets enable row level security;
alter table public.messages enable row level security;
alter table public.guesses enable row level security;
alter table public.hints enable row level security;
alter table public.reports enable row level security;
alter table public.events enable row level security;
alter table private.config enable row level security;
alter table private.throttle enable row level security;

-- No policies are created on purpose: with RLS on and no policy, the API
-- roles see zero rows even if a grant slips through later.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Private helpers (not callable through the API)
-- -----------------------------------------------------------------------------

create function private.sha(p text)
returns text language sql immutable set search_path = ''
as $$ select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex') $$;

create function private.salted(p text)
returns text language sql stable set search_path = ''
as $$
  select case when p is null or btrim(p) = '' then null
    else encode(sha256(convert_to((select salt from private.config) || ':' || left(p, 200), 'UTF8')), 'hex') end
$$;

create function private.random_token()
returns text language sql volatile set search_path = ''
as $$ select encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex') $$;

-- Random share code from an unambiguous alphabet (no 0/O, 1/I/L).
-- 31^7 ≈ 27 billion combinations, drawn from the random bytes of UUIDv4s.
create function private.random_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := uuid_send(gen_random_uuid());
  -- bytes 6 and 8 carry the UUID version/variant bits, so skip them
  positions constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15];
  code text := '';
begin
  for i in 1..7 loop
    code := code || substr(alphabet, (get_byte(bytes, positions[i]) % 31) + 1, 1);
  end loop;
  return code;
end $$;

create function private.normalize_code(p text)
returns text language sql immutable set search_path = ''
as $$ select upper(btrim(coalesce(p, ''))) $$;

-- Client IP from the PostgREST request headers, if present. Only ever used
-- hashed, for rate limiting. Per-IP limits are deliberately loose (schools and
-- offices share IPs); per-device limits do the fine-grained work.
create function private.client_ip()
returns text language plpgsql stable set search_path = ''
as $$
declare
  h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then
    return null;
  end if;
  return nullif(btrim(coalesce(
    h ->> 'cf-connecting-ip',
    split_part(h ->> 'x-forwarded-for', ',', 1),
    h ->> 'x-real-ip'
  )), '');
end $$;

-- Returns true (and records a hit) when the key is under its limit.
create function private.throttle(p_bucket text, p_key text, p_max int, p_window interval)
returns boolean language plpgsql volatile set search_path = ''
as $$
declare
  k text;
  n int;
begin
  if p_key is null or btrim(p_key) = '' then
    return true;
  end if;
  k := private.salted(p_bucket || ':' || p_key);
  select count(*) into n from private.throttle
   where bucket = p_bucket and key_hash = k and created_at > now() - p_window;
  if n >= p_max then
    return false;
  end if;
  insert into private.throttle (bucket, key_hash) values (p_bucket, k);
  return true;
end $$;

create function private.clean_text(p text, p_max int)
returns text language sql immutable set search_path = ''
as $$
  select left(btrim(regexp_replace(regexp_replace(
    replace(replace(coalesce(p, ''), E'\r\n', E'\n'), E'\t', ' '),
    '[\x01-\x08\x0B-\x1F\x7F]', '', 'g'),
    E'\n{3,}', E'\n\n', 'g')), p_max)
$$;

create function private.clean_name(p text)
returns text language sql immutable set search_path = ''
as $$ select left(btrim(regexp_replace(coalesce(p, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), 40) $$;

-- Lowercase, strip common accents and punctuation, collapse whitespace.
create function private.norm(p text)
returns text language sql immutable set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūñçýÿšžłÁÀÂÄÃÅĀÉÈÊËĒÍÌÎÏĪÓÒÔÖÕØŌÚÙÛÜŪÑÇÝŠŽŁ',
      'aaaaaaaeeeeeiiiiiooooooouuuuuncyyszlaaaaaaaeeeeeiiiiiooooooouuuuuncyszl'),
    '[[:punct:][:space:]]+', ' ', 'g'))
$$;

-- Is the guess "close enough"? Full name, first name or any sealed alias.
create function private.is_match(p_guess text, p_name text, p_aliases text[])
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  g text := private.norm(p_guess);
  n text := private.norm(p_name);
  a text;
begin
  if g = '' or n = '' then
    return false;
  end if;
  if replace(g, ' ', '') = replace(n, ' ', '') then
    return true;
  end if;
  if char_length(split_part(g, ' ', 1)) >= 2 and split_part(g, ' ', 1) = split_part(n, ' ', 1) then
    return true;
  end if;
  foreach a in array coalesce(p_aliases, '{}'::text[]) loop
    if private.norm(a) <> '' and replace(g, ' ', '') = replace(private.norm(a), ' ', '') then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- Difficulty only changes hint timing.
create function private.hint_rules(p_difficulty text, out unlock_after interval, out cooldown interval, out max_hints int)
language sql immutable set search_path = ''
as $$
  select
    case p_difficulty when 'easy' then interval '0 seconds' when 'evil' then interval '120 seconds' else interval '45 seconds' end,
    case p_difficulty when 'easy' then interval '20 seconds' when 'evil' then interval '120 seconds' else interval '45 seconds' end,
    case p_difficulty when 'easy' then 10 when 'evil' then 4 else 7 end
$$;

-- Status as players should see it: anything past its lifetime is expired.
create function private.effective_status(g public.games)
returns text language sql stable set search_path = ''
as $$
  select case
    when g.status in ('waiting', 'active', 'guessing', 'completed') and now() >= g.expires_at then 'expired'
    else g.status
  end
$$;

create function private.host_name(g public.games)
returns text language sql immutable set search_path = ''
as $$ select coalesce(g.creator_nickname, g.creator_display_name) $$;

create function private.auth(p_code text, p_token text)
returns public.players language plpgsql stable set search_path = ''
as $$
declare
  pl public.players;
begin
  if p_token is null or char_length(p_token) <> 64 then
    raise exception 'not_found';
  end if;
  select p.* into pl
    from public.players p
    join public.games g on g.id = p.game_id
   where p.token_hash = private.sha(p_token)
     and g.share_code = private.normalize_code(p_code);
  if not found then
    raise exception 'not_found';
  end if;
  return pl;
end $$;

-- The guest currently holding the seat, if any.
create function private.current_guest(g public.games)
returns public.players language sql stable set search_path = ''
as $$
  select p.* from public.players p
   where p.game_id = g.id and p.role = 'guest' and p.is_active and p.round = g.round
   order by p.joined_at desc
   limit 1
$$;

create function private.log(p_name text, p_game uuid, p_device text, p_props jsonb default '{}')
returns void language sql volatile set search_path = ''
as $$
  insert into public.events (name, game_id, device_hash, props)
  values (p_name, p_game, p_device, coalesce(p_props, '{}'::jsonb))
$$;

-- Ping everyone on the game's channel. Realtime is a nice-to-have: clients
-- also poll, so any failure here is swallowed.
create function private.notify(p_channel_key text, p_event text default 'sync')
returns void language plpgsql volatile set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('at', extract(epoch from now())),
    p_event,
    'anx:' || p_channel_key,
    false
  );
exception when others then
  null;
end $$;

-- Close the current guest's round and reopen the seat for someone else.
create function private.reopen_seat(g public.games)
returns void language plpgsql volatile set search_path = ''
as $$
begin
  update public.games
     set status = 'waiting',
         round = round + 1,
         round_started_at = null,
         channel_key = encode(uuid_send(gen_random_uuid()), 'hex')
   where id = g.id;
  -- tell the old channel; everyone re-fetches and picks up the new key
  perform private.notify(g.channel_key);
end $$;

create function private.round_counts(p_game uuid, p_round int, p_creator uuid)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'questions', count(*) filter (where kind = 'text' and player_id = p_creator),
    'hints_requested', count(*) filter (where kind = 'hint_request'),
    'hints_given', count(*) filter (where kind = 'hint'),
    'messages', count(*)
  )
  from public.messages
  where game_id = p_game and round = p_round
$$;

-- Deliberately simple. It exists to make the result shareable, nothing more.
create function private.score(p_correct boolean, p_questions int, p_hints int, p_seconds int)
returns int language sql immutable set search_path = ''
as $$
  select case when not p_correct then 0 else
    greatest(5, least(100,
      100
      - p_hints * 8
      - greatest(0, p_questions - 5) * 2
      - greatest(0, p_seconds / 60 - 1) * 3
    ))
  end
$$;

-- -----------------------------------------------------------------------------
-- Retention: games live 24h; everything about them is deleted 24h after that.
-- Reports keep their own snapshot for 90 days.
-- -----------------------------------------------------------------------------

create function public.purge_old_games()
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  expired int;
  deleted int;
begin
  update public.games set status = 'expired'
   where status in ('waiting', 'active', 'guessing') and expires_at <= now();
  get diagnostics expired = row_count;

  delete from public.games where expires_at < now() - interval '24 hours';
  get diagnostics deleted = row_count;

  delete from private.throttle where created_at < now() - interval '1 day';
  delete from public.reports where created_at < now() - interval '90 days';
  delete from public.events where created_at < now() - interval '180 days';

  return json_build_object('expired', expired, 'deleted', deleted);
end $$;

-- -----------------------------------------------------------------------------
-- Public API (the only functions the browser can call)
-- -----------------------------------------------------------------------------

create function public.create_game(
  p_name text,
  p_nickname text default null,
  p_difficulty text default 'normal',
  p_device text default null
)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := private.clean_name(p_name);
  v_nick text := nullif(private.clean_name(p_nickname), '');
  v_diff text := case when p_difficulty in ('easy', 'normal', 'evil') then p_difficulty else 'normal' end;
  v_dev text := private.salted(p_device);
  v_token text := private.random_token();
  v_game public.games;
  v_player uuid;
  attempts int := 0;
begin
  if v_name = '' then
    raise exception 'invalid_name';
  end if;
  if not private.throttle('create_ip', private.client_ip(), 120, interval '1 hour')
     or not private.throttle('create_device', p_device, 15, interval '1 hour') then
    raise exception 'rate_limited' using hint = '600';
  end if;

  loop
    begin
      insert into public.games (share_code, creator_display_name, creator_nickname, difficulty)
      values (private.random_code(), v_name, v_nick, v_diff)
      returning * into v_game;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise;
      end if;
    end;
  end loop;

  insert into public.players (game_id, role, anonymous_name, token_hash, device_hash)
  values (v_game.id, 'creator', 'The Guessing Machine', private.sha(v_token), v_dev)
  returning id into v_player;

  update public.games set creator_player_id = v_player where id = v_game.id;

  perform private.log('game_created', v_game.id, v_dev, jsonb_build_object('difficulty', v_diff));

  -- Fallback housekeeping in case pg_cron is not enabled on the project.
  if random() < 0.02 then
    perform public.purge_old_games();
  end if;

  return json_build_object('code', v_game.share_code, 'token', v_token);
end $$;

-- What a visitor without a seat may know about a link.
create function public.peek_game(p_code text, p_device text default null)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := private.normalize_code(p_code);
  g public.games;
  st text;
begin
  if not private.throttle('peek_ip', private.client_ip(), 300, interval '1 minute')
     or not private.throttle('peek_device', p_device, 60, interval '1 minute') then
    raise exception 'rate_limited' using hint = '60';
  end if;
  if v_code !~ '^[2-9A-HJKMNP-Z]{7}$' then
    return json_build_object('state', 'not_found');
  end if;

  select * into g from public.games where share_code = v_code;
  if not found then
    return json_build_object('state', 'not_found');
  end if;

  st := private.effective_status(g);
  if st = 'expired' then
    return json_build_object('state', 'expired');
  end if;

  return json_build_object(
    'state', case
      when st in ('completed', 'cancelled') then 'over'
      when (private.current_guest(g)).id is not null then 'taken'
      else 'open'
    end,
    'host', private.host_name(g),
    'difficulty', g.difficulty,
    'expires_at', g.expires_at
  );
end $$;

create function public.join_game(
  p_code text,
  p_name text,
  p_aliases text default null,
  p_device text default null
)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := private.clean_name(p_name);
  v_aliases text[];
  v_dev text := private.salted(p_device);
  v_token text := private.random_token();
  g public.games;
  st text;
  v_player uuid;
begin
  if v_name = '' then
    raise exception 'invalid_name';
  end if;
  if not private.throttle('join_ip', private.client_ip(), 120, interval '10 minutes')
     or not private.throttle('join_device', p_device, 20, interval '10 minutes') then
    raise exception 'rate_limited' using hint = '300';
  end if;

  select coalesce(array_agg(a), '{}') into v_aliases
    from (
      select left(private.clean_name(x), 30) as a
        from unnest(string_to_array(coalesce(p_aliases, ''), ',')) as x
       where private.clean_name(x) <> ''
       limit 5
    ) s;

  select * into g from public.games where share_code = private.normalize_code(p_code) for update;
  if not found then
    raise exception 'not_found';
  end if;

  st := private.effective_status(g);
  if st = 'expired' then
    raise exception 'expired';
  elsif st in ('completed', 'cancelled') then
    raise exception 'over';
  elsif (private.current_guest(g)).id is not null then
    raise exception 'taken';
  end if;

  if v_dev is not null then
    if exists (select 1 from public.players where game_id = g.id and device_hash = v_dev and is_banned) then
      raise exception 'blocked';
    end if;
    if exists (select 1 from public.players where game_id = g.id and device_hash = v_dev and role = 'creator') then
      raise exception 'own_game';
    end if;
  end if;

  insert into public.players (game_id, role, anonymous_name, token_hash, device_hash, round)
  values (g.id, 'guest', 'Anonymous #' || (1000 + floor(random() * 9000))::int, private.sha(v_token), v_dev, g.round)
  returning id into v_player;

  insert into public.player_secrets (player_id, sealed_name, aliases) values (v_player, v_name, v_aliases);

  update public.games set status = 'active', round_started_at = now() where id = g.id;

  perform private.log('game_joined', g.id, v_dev, jsonb_build_object('round', g.round));
  perform private.notify(g.channel_key);

  return json_build_object('token', v_token);
end $$;

-- Everything a participant needs to render the game. Also acts as heartbeat.
-- Messages are returned incrementally after `p_after` (a per-game sequence
-- number). Player ids are never returned: messages only say whether they are
-- `mine`.
create function public.get_state(p_code text, p_token text, p_after int default 0)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  st text;
  other public.players;
  v_counts jsonb;
  v_messages json;
  v_hint json;
  v_result json;
  v_rules record;
  v_last_request timestamptz;
  v_unlock timestamptz;
begin
  select * into g from public.games where id = pl.game_id;
  st := private.effective_status(g);

  if st = 'expired' and g.status in ('waiting', 'active', 'guessing') then
    update public.games set status = 'expired' where id = g.id;
  end if;

  if pl.is_active and pl.last_seen_at < now() - interval '4 seconds' then
    update public.players set last_seen_at = now() where id = pl.id;
  end if;

  -- A guest who left or was removed only learns that much.
  if pl.role = 'guest' and (not pl.is_active or pl.round <> g.round) then
    return json_build_object(
      'role', 'guest',
      'removed', true,
      'reason', coalesce(pl.left_reason, 'left'),
      'status', st,
      'code', g.share_code,
      'host', private.host_name(g),
      'server_now', now()
    );
  end if;

  if pl.role = 'creator' then
    other := private.current_guest(g);
  else
    select * into other from public.players where id = g.creator_player_id;
  end if;

  v_counts := private.round_counts(g.id, g.round, g.creator_player_id);

  select coalesce(json_agg(json_build_object(
           'seq', m.seq,
           'mine', m.player_id is not distinct from pl.id,
           'kind', m.kind,
           'category', m.category,
           'content', m.content,
           'at', m.created_at
         ) order by m.seq), '[]'::json)
    into v_messages
    from public.messages m
   where m.game_id = g.id and m.round = g.round and m.seq > coalesce(p_after, 0);

  select * into v_rules from private.hint_rules(g.difficulty);
  select max(created_at) into v_last_request
    from public.messages where game_id = g.id and round = g.round and kind = 'hint_request';
  v_unlock := g.round_started_at + v_rules.unlock_after;
  v_hint := json_build_object(
    'next_at', greatest(v_unlock, v_last_request + v_rules.cooldown),
    'remaining', greatest(0, v_rules.max_hints - (v_counts ->> 'hints_requested')::int),
    'max', v_rules.max_hints
  );

  if g.status = 'completed' and st = 'completed' then
    select json_build_object(
             'guess', gu.guess,
             'correct', gu.correct,
             'name', ps.sealed_name,
             'score', g.score,
             'winner', g.winner,
             'duration', greatest(0, extract(epoch from (g.completed_at - g.round_started_at))::int),
             'questions', (v_counts ->> 'questions')::int,
             'hints', (v_counts ->> 'hints_requested')::int,
             'guesses', 1
           )
      into v_result
      from public.guesses gu
      join public.players gp on gp.game_id = g.id and gp.role = 'guest' and gp.round = g.round
      join public.player_secrets ps on ps.player_id = gp.id
     where gu.game_id = g.id
     order by gp.joined_at desc
     limit 1;
  end if;

  return json_build_object(
    'role', pl.role,
    'removed', false,
    'me', pl.anonymous_name,
    'status', st,
    'code', g.share_code,
    'host', private.host_name(g),
    'difficulty', g.difficulty,
    'round', g.round,
    'channel', case when st in ('waiting', 'active', 'guessing') then 'anx:' || g.channel_key end,
    'created_at', g.created_at,
    'expires_at', g.expires_at,
    'round_started_at', g.round_started_at,
    'completed_at', g.completed_at,
    'guest_present', case when pl.role = 'creator' then other.id is not null else true end,
    'other_online', coalesce(other.is_active and other.last_seen_at > now() - interval '25 seconds', false),
    'muted_until', case when pl.muted_until > now() then pl.muted_until end,
    'messages', v_messages,
    'counts', v_counts,
    'hint', v_hint,
    'result', v_result,
    'server_now', now()
  );
end $$;

create function public.send_message(
  p_code text,
  p_token text,
  p_content text,
  p_kind text default 'text',
  p_category text default null
)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  v_kind text := coalesce(p_kind, 'text');
  v_content text := private.clean_text(p_content, 501);
  v_category text;
  v_recent int;
  v_last timestamptz;
  v_total int;
  v_seq int;
  v_message bigint;
  v_hint uuid;
begin
  select * into g from public.games where id = pl.game_id for update;
  if private.effective_status(g) not in ('active', 'guessing')
     or not pl.is_active
     or (pl.role = 'guest' and pl.round <> g.round) then
    raise exception 'not_active';
  end if;

  if (pl.role = 'creator' and v_kind <> 'text')
     or (pl.role = 'guest' and v_kind not in ('text', 'hint', 'mysterious')) then
    raise exception 'invalid_kind';
  end if;

  if v_kind = 'mysterious' then
    v_content := '';
  elsif v_content = '' then
    raise exception 'empty';
  elsif char_length(v_content) > 500 then
    raise exception 'too_long';
  end if;

  if v_kind = 'hint' and p_category in (
    'age', 'city', 'school', 'work', 'mutual_friend', 'hobby', 'personality', 'shared_memory', 'random_fact'
  ) then
    v_category := p_category;
  end if;

  -- Rate limiting: a short cooldown is applied after a burst.
  if pl.muted_until is not null and pl.muted_until > now() then
    return json_build_object('ok', false, 'error', 'rate_limited',
      'retry_after', ceil(extract(epoch from pl.muted_until - now()))::int);
  end if;

  select count(*), max(created_at) into v_recent, v_last
    from public.messages where player_id = pl.id and created_at > now() - interval '30 seconds';

  if v_last > now() - interval '350 milliseconds' then
    return json_build_object('ok', false, 'error', 'too_fast', 'retry_after', 1);
  end if;
  if v_recent >= 15 then
    update public.players set muted_until = now() + interval '20 seconds' where id = pl.id;
    return json_build_object('ok', false, 'error', 'rate_limited', 'retry_after', 20);
  end if;

  select count(*) into v_total from public.messages where game_id = g.id and round = g.round;
  if v_total >= 300 then
    return json_build_object('ok', false, 'error', 'message_cap');
  end if;

  v_seq := g.message_seq + 1;
  update public.games set message_seq = v_seq where id = g.id;

  insert into public.messages (game_id, player_id, round, seq, kind, category, content)
  values (g.id, pl.id, g.round, v_seq, v_kind, v_category, v_content)
  returning id into v_message;

  if v_kind = 'hint' then
    select id into v_hint from public.hints
     where game_id = g.id and round = g.round and requested_by is not null and answered_at is null
     order by created_at
     limit 1;
    if v_hint is not null then
      update public.hints
         set content = v_content, category = v_category, message_id = v_message, answered_at = now()
       where id = v_hint;
    else
      insert into public.hints (game_id, round, requested_by, content, category, message_id, answered_at)
      values (g.id, g.round, null, v_content, v_category, v_message, now());
    end if;
  end if;

  update public.players set last_seen_at = now() where id = pl.id;
  perform private.log('message_sent', g.id, pl.device_hash, jsonb_build_object('role', pl.role, 'kind', v_kind));
  perform private.notify(g.channel_key);

  return json_build_object('ok', true, 'seq', v_seq);
end $$;

create function public.request_hint(p_code text, p_token text)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  v_rules record;
  v_count int;
  v_last timestamptz;
  v_next timestamptz;
  v_seq int;
begin
  if pl.role <> 'creator' then
    raise exception 'forbidden';
  end if;
  select * into g from public.games where id = pl.game_id for update;
  if private.effective_status(g) not in ('active', 'guessing') then
    raise exception 'not_active';
  end if;

  select * into v_rules from private.hint_rules(g.difficulty);
  select count(*), max(created_at) into v_count, v_last
    from public.hints where game_id = g.id and round = g.round and requested_by is not null;

  if v_count >= v_rules.max_hints then
    return json_build_object('ok', false, 'error', 'no_hints_left');
  end if;

  v_next := greatest(g.round_started_at + v_rules.unlock_after, v_last + v_rules.cooldown);
  if v_next > now() then
    return json_build_object('ok', false, 'error', 'hint_cooldown',
      'retry_after', ceil(extract(epoch from v_next - now()))::int);
  end if;

  v_seq := g.message_seq + 1;
  update public.games set message_seq = v_seq where id = g.id;
  insert into public.messages (game_id, player_id, round, seq, kind)
  values (g.id, pl.id, g.round, v_seq, 'hint_request');
  insert into public.hints (game_id, round, requested_by) values (g.id, g.round, pl.id);

  perform private.log('hint_requested', g.id, pl.device_hash, jsonb_build_object('n', v_count + 1));
  perform private.notify(g.channel_key);
  return json_build_object('ok', true);
end $$;

-- The creator opened (or closed) the guess dialog. The guest sees it live.
create function public.set_guessing(p_code text, p_token text, p_on boolean)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
begin
  if pl.role <> 'creator' then
    raise exception 'forbidden';
  end if;
  select * into g from public.games where id = pl.game_id for update;

  if p_on and private.effective_status(g) = 'active' and (private.current_guest(g)).id is not null then
    update public.games set status = 'guessing' where id = g.id;
    perform private.log('guess_started', g.id, pl.device_hash);
    perform private.notify(g.channel_key);
  elsif not p_on and private.effective_status(g) = 'guessing' then
    update public.games set status = 'active' where id = g.id;
    perform private.notify(g.channel_key);
  end if;
  return json_build_object('ok', true);
end $$;

create function public.submit_guess(p_code text, p_token text, p_guess text)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  guest public.players;
  v_guess text := private.clean_name(p_guess);
  v_secret public.player_secrets;
  v_correct boolean;
  v_counts jsonb;
  v_seconds int;
  v_score int;
begin
  if pl.role <> 'creator' then
    raise exception 'forbidden';
  end if;
  if v_guess = '' then
    raise exception 'invalid_guess';
  end if;

  select * into g from public.games where id = pl.game_id for update;
  if private.effective_status(g) not in ('active', 'guessing') then
    raise exception 'not_active';
  end if;
  guest := private.current_guest(g);
  if guest.id is null then
    raise exception 'not_active';
  end if;
  if exists (select 1 from public.guesses where game_id = g.id) then
    raise exception 'already_guessed';
  end if;

  select * into v_secret from public.player_secrets where player_id = guest.id;
  v_correct := private.is_match(v_guess, v_secret.sealed_name, v_secret.aliases);

  insert into public.guesses (game_id, player_id, guess, correct) values (g.id, pl.id, v_guess, v_correct);

  v_counts := private.round_counts(g.id, g.round, pl.id);
  v_seconds := greatest(0, extract(epoch from now() - g.round_started_at)::int);
  v_score := private.score(v_correct, (v_counts ->> 'questions')::int, (v_counts ->> 'hints_requested')::int, v_seconds);

  update public.games
     set status = 'completed',
         completed_at = now(),
         winner = case when v_correct then 'creator' else 'guest' end,
         score = v_score
   where id = g.id;

  perform private.log('guess_submitted', g.id, pl.device_hash);
  perform private.log(case when v_correct then 'guess_correct' else 'guess_wrong' end, g.id, pl.device_hash);
  perform private.log('game_completed', g.id, pl.device_hash, v_counts || jsonb_build_object(
    'correct', v_correct, 'duration', v_seconds, 'score', v_score, 'difficulty', g.difficulty));
  perform private.notify(g.channel_key);

  return json_build_object('ok', true, 'correct', v_correct);
end $$;

create function public.leave_game(p_code text, p_token text)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  st text;
begin
  select * into g from public.games where id = pl.game_id for update;
  st := private.effective_status(g);

  if pl.role = 'creator' then
    if st in ('waiting', 'active', 'guessing') then
      update public.games set status = 'cancelled', completed_at = now() where id = g.id;
      perform private.log('game_abandoned', g.id, pl.device_hash, jsonb_build_object('by', 'creator', 'from', st));
      perform private.notify(g.channel_key);
    end if;
  elsif pl.is_active and pl.round = g.round and st in ('active', 'guessing') then
    update public.players set is_active = false, left_reason = 'left' where id = pl.id;
    perform private.log('game_abandoned', g.id, pl.device_hash, jsonb_build_object('by', 'guest', 'from', st));
    perform private.reopen_seat(g);
  end if;

  return json_build_object('ok', true);
end $$;

-- The creator removes the current guest; that device can't come back.
create function public.block_guest(p_code text, p_token text)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  guest public.players;
begin
  if pl.role <> 'creator' then
    raise exception 'forbidden';
  end if;
  select * into g from public.games where id = pl.game_id for update;
  guest := private.current_guest(g);
  if guest.id is null then
    return json_build_object('ok', true);
  end if;

  update public.players set is_active = false, is_banned = true, left_reason = 'blocked' where id = guest.id;
  perform private.log('guest_blocked', g.id, pl.device_hash);

  if private.effective_status(g) in ('active', 'guessing') then
    perform private.reopen_seat(g);
  else
    perform private.notify(g.channel_key);
  end if;
  return json_build_object('ok', true);
end $$;

create function public.report_game(p_code text, p_token text, p_category text, p_description text default null)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  pl public.players := private.auth(p_code, p_token);
  g public.games;
  v_round int;
  v_snapshot jsonb;
begin
  if p_category not in ('harassment', 'threats', 'sexual', 'spam', 'hate', 'other') then
    raise exception 'invalid_category';
  end if;
  select * into g from public.games where id = pl.game_id;

  if (select count(*) from public.reports where reporter_player_id = pl.id) >= 3 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- Guests report their own round. Creators report the most recent round
  -- with messages, so blocking first and reporting second still works.
  if pl.role = 'guest' then
    v_round := pl.round;
  else
    select coalesce(max(round), g.round) into v_round from public.messages where game_id = g.id;
  end if;

  select coalesce(jsonb_agg(x order by x.seq), '[]'::jsonb) into v_snapshot
    from (
      select m.seq, m.kind, m.category, m.content, m.created_at,
             case when m.player_id = g.creator_player_id then 'creator' else 'guest' end as sender
        from public.messages m
       where m.game_id = g.id and m.round = v_round
       order by m.seq desc
       limit 100
    ) x;

  insert into public.reports (game_id, share_code, reporter_player_id, reporter_role, category, description, snapshot)
  values (g.id, g.share_code, pl.id, pl.role, p_category, nullif(private.clean_text(p_description, 1000), ''), v_snapshot);

  perform private.log('report_submitted', g.id, pl.device_hash, jsonb_build_object('category', p_category, 'source', 'in_game'));
  return json_build_object('ok', true);
end $$;

-- Reports from the public Report page (no seat needed).
create function public.report_link(p_link text, p_category text, p_description text default null, p_device text default null)
returns json language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := substring(upper(coalesce(p_link, '')) from '([2-9A-HJKMNP-Z]{7})/?\s*$');
  v_game uuid;
begin
  if p_category not in ('harassment', 'threats', 'sexual', 'spam', 'hate', 'other') then
    raise exception 'invalid_category';
  end if;
  if not private.throttle('report_ip', private.client_ip(), 30, interval '1 hour')
     or not private.throttle('report_device', p_device, 10, interval '1 hour') then
    raise exception 'rate_limited' using hint = '3600';
  end if;

  select id into v_game from public.games where share_code = v_code;

  insert into public.reports (game_id, share_code, category, description, source)
  values (v_game, v_code, p_category, nullif(private.clean_text(p_description, 1000), ''), 'public');

  perform private.log('report_submitted', v_game, private.salted(p_device), jsonb_build_object('category', p_category, 'source', 'public'));
  return json_build_object('ok', true);
end $$;

-- Client-side product events. Everything game-related is logged server-side.
create function public.track_event(p_name text, p_device text default null, p_code text default null, p_props jsonb default '{}')
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_game uuid;
begin
  if p_name not in ('landing_view', 'create_viewed', 'join_viewed', 'link_copied', 'share_clicked',
                    'result_shared', 'replay_clicked') then
    return;
  end if;
  if not private.throttle('track_device', p_device, 300, interval '1 hour')
     or not private.throttle('track_ip', private.client_ip(), 1000, interval '1 hour') then
    return;
  end if;
  if p_code is not null then
    select id into v_game from public.games where share_code = private.normalize_code(p_code);
  end if;
  perform private.log(p_name, v_game, private.salted(p_device),
    case when p_props is not null and jsonb_typeof(p_props) = 'object' and char_length(p_props::text) <= 500
         then p_props else '{}'::jsonb end);
end $$;

-- -----------------------------------------------------------------------------
-- Function privileges: only the public API is executable by the browser.
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.create_game(text, text, text, text),
  public.peek_game(text, text),
  public.join_game(text, text, text, text),
  public.get_state(text, text, int),
  public.send_message(text, text, text, text, text),
  public.request_hint(text, text),
  public.set_guessing(text, text, boolean),
  public.submit_guess(text, text, text),
  public.leave_game(text, text),
  public.block_guest(text, text),
  public.report_game(text, text, text, text),
  public.report_link(text, text, text, text),
  public.track_event(text, text, text, jsonb)
to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Scheduled cleanup (pg_cron is available on Supabase's free tier). If it is
-- not available the opportunistic purge in create_game() still runs.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('anonymass-purge', '*/30 * * * *', 'select public.purge_old_games()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled (%). Old games are purged opportunistically instead.', sqlerrm;
end $$;
