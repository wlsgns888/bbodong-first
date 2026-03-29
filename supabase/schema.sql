create table if not exists public.app_state (
  id text primary key,
  active_tab text not null default 'home',
  active_filter text not null default 'all',
  checkin_index integer not null default 0,
  checkin_answers jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  focus_locked boolean not null default false,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.app_state enable row level security;

create policy "public can read app state"
on public.app_state
for select
to anon
using (true);

create policy "public can upsert app state"
on public.app_state
for insert
to anon
with check (true);

create policy "public can update app state"
on public.app_state
for update
to anon
using (true)
with check (true);
