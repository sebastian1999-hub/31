-- Tablas online para salas por codigo (crear/unirse)
-- Ejecuta este script en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.game31_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_user_id uuid not null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  game_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game31_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game31_rooms(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

create index if not exists game31_rooms_code_idx on public.game31_rooms(code);
create index if not exists game31_room_members_room_idx on public.game31_room_members(room_id);
create index if not exists game31_room_members_user_idx on public.game31_room_members(user_id);

alter table public.game31_rooms enable row level security;
alter table public.game31_room_members enable row level security;

drop policy if exists "rooms select members" on public.game31_rooms;
create policy "rooms select members"
on public.game31_rooms
for select
using (auth.uid() is not null);

drop policy if exists "rooms insert owner" on public.game31_rooms;
create policy "rooms insert owner"
on public.game31_rooms
for insert
with check (owner_user_id = auth.uid());

drop policy if exists "rooms update members" on public.game31_rooms;
create policy "rooms update members"
on public.game31_rooms
for update
using (
  exists (
    select 1
    from public.game31_room_members rm
    where rm.room_id = game31_rooms.id
      and rm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.game31_room_members rm
    where rm.room_id = game31_rooms.id
      and rm.user_id = auth.uid()
  )
);

drop policy if exists "rooms delete owner" on public.game31_rooms;
create policy "rooms delete owner"
on public.game31_rooms
for delete
using (owner_user_id = auth.uid());

drop policy if exists "members select room members" on public.game31_room_members;
create policy "members select room members"
on public.game31_room_members
for select
using (auth.uid() is not null);

drop policy if exists "members insert self" on public.game31_room_members;
create policy "members insert self"
on public.game31_room_members
for insert
with check (user_id = auth.uid());

drop policy if exists "members update self" on public.game31_room_members;
create policy "members update self"
on public.game31_room_members
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members delete self" on public.game31_room_members;
create policy "members delete self"
on public.game31_room_members
for delete
using (user_id = auth.uid());
