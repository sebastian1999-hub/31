-- Esquema nuevo para el juego 31.
-- No modifica tablas existentes.

create extension if not exists pgcrypto;

create table if not exists public.game31_matches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  winner_player_id uuid,
  max_penalty integer not null default 10,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.game31_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.game31_matches(id) on delete cascade,
  auth_user_id uuid,
  display_name text not null,
  seat_index integer not null,
  penalty_points integer not null default 0,
  eliminated boolean not null default false,
  created_at timestamptz not null default now(),
  unique(match_id, seat_index)
);

create table if not exists public.game31_rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.game31_matches(id) on delete cascade,
  round_number integer not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  closed_by_player_id uuid,
  end_reason text check (end_reason in ('closure', 'exact31', 'manual')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  unique(match_id, round_number)
);

create table if not exists public.game31_round_hands (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game31_rounds(id) on delete cascade,
  player_id uuid not null references public.game31_players(id) on delete cascade,
  cards jsonb not null,
  score integer,
  scoring_suit text check (scoring_suit in ('oros', 'copas', 'espadas', 'bastos')),
  unique(round_id, player_id)
);

create table if not exists public.game31_turns (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game31_rounds(id) on delete cascade,
  turn_number integer not null,
  player_id uuid not null references public.game31_players(id) on delete cascade,
  draw_source text check (draw_source in ('deck', 'discard')),
  drawn_card jsonb,
  discarded_card jsonb,
  hand_after jsonb,
  created_at timestamptz not null default now(),
  unique(round_id, turn_number)
);

create table if not exists public.game31_penalties (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game31_rounds(id) on delete cascade,
  player_id uuid not null references public.game31_players(id) on delete cascade,
  reason text not null check (reason in ('lowest_score', 'tie_lowest', 'failed_closure', 'opponent_exact31')),
  points integer not null check (points > 0),
  created_at timestamptz not null default now()
);

create index if not exists game31_matches_owner_idx on public.game31_matches(owner_user_id);
create index if not exists game31_players_match_idx on public.game31_players(match_id);
create index if not exists game31_rounds_match_idx on public.game31_rounds(match_id);
create index if not exists game31_turns_round_idx on public.game31_turns(round_id);
create index if not exists game31_penalties_round_idx on public.game31_penalties(round_id);

alter table public.game31_matches enable row level security;
alter table public.game31_players enable row level security;
alter table public.game31_rounds enable row level security;
alter table public.game31_round_hands enable row level security;
alter table public.game31_turns enable row level security;
alter table public.game31_penalties enable row level security;

drop policy if exists "game31 matches read own" on public.game31_matches;
create policy "game31 matches read own"
on public.game31_matches
for select
using (owner_user_id = auth.uid());

drop policy if exists "game31 matches insert own" on public.game31_matches;
create policy "game31 matches insert own"
on public.game31_matches
for insert
with check (owner_user_id = auth.uid());

drop policy if exists "game31 matches update own" on public.game31_matches;
create policy "game31 matches update own"
on public.game31_matches
for update
using (owner_user_id = auth.uid());

drop policy if exists "game31 players read by owner" on public.game31_players;
create policy "game31 players read by owner"
on public.game31_players
for select
using (
  exists (
    select 1
    from public.game31_matches m
    where m.id = game31_players.match_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists "game31 players write by owner" on public.game31_players;
create policy "game31 players write by owner"
on public.game31_players
for all
using (
  exists (
    select 1
    from public.game31_matches m
    where m.id = game31_players.match_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.game31_matches m
    where m.id = game31_players.match_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists "game31 rounds read by owner" on public.game31_rounds;
create policy "game31 rounds read by owner"
on public.game31_rounds
for select
using (
  exists (
    select 1
    from public.game31_matches m
    where m.id = game31_rounds.match_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists "game31 rounds write by owner" on public.game31_rounds;
create policy "game31 rounds write by owner"
on public.game31_rounds
for all
using (
  exists (
    select 1
    from public.game31_matches m
    where m.id = game31_rounds.match_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.game31_matches m
    where m.id = game31_rounds.match_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists "game31 round_hands owner access" on public.game31_round_hands;
create policy "game31 round_hands owner access"
on public.game31_round_hands
for all
using (
  exists (
    select 1
    from public.game31_rounds r
    join public.game31_matches m on m.id = r.match_id
    where r.id = game31_round_hands.round_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.game31_rounds r
    join public.game31_matches m on m.id = r.match_id
    where r.id = game31_round_hands.round_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists "game31 turns owner access" on public.game31_turns;
create policy "game31 turns owner access"
on public.game31_turns
for all
using (
  exists (
    select 1
    from public.game31_rounds r
    join public.game31_matches m on m.id = r.match_id
    where r.id = game31_turns.round_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.game31_rounds r
    join public.game31_matches m on m.id = r.match_id
    where r.id = game31_turns.round_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists "game31 penalties owner access" on public.game31_penalties;
create policy "game31 penalties owner access"
on public.game31_penalties
for all
using (
  exists (
    select 1
    from public.game31_rounds r
    join public.game31_matches m on m.id = r.match_id
    where r.id = game31_penalties.round_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.game31_rounds r
    join public.game31_matches m on m.id = r.match_id
    where r.id = game31_penalties.round_id
      and m.owner_user_id = auth.uid()
  )
);
