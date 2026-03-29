create table if not exists public.shared_sessions (
  id text primary key,
  locale text not null default 'ko',
  goal_name text not null default '제주 여행 적금',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.session_participants (
  session_id text not null references public.shared_sessions(id) on delete cascade,
  participant_name text not null,
  joined_at timestamptz not null default timezone('utc'::text, now()),
  primary key (session_id, participant_name)
);

create table if not exists public.weekly_states (
  session_id text primary key references public.shared_sessions(id) on delete cascade,
  week_start date not null default current_date,
  revision integer not null default 0,
  current_view text not null default 'home',
  checkin_step integer not null default 0,
  weekly_buffer integer not null default 180000,
  buffer_updated_by text not null default '지훈',
  ambiguous_spend jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.rule_memories (
  session_id text primary key references public.shared_sessions(id) on delete cascade,
  rule_text text not null,
  source_spend_label text not null,
  created_week_start date not null default current_date,
  resurfaced_week_start date,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.shared_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.weekly_states enable row level security;
alter table public.rule_memories enable row level security;

create policy "public can read shared sessions"
on public.shared_sessions
for select
to anon
using (true);

create policy "public can insert shared sessions"
on public.shared_sessions
for insert
to anon
with check (true);

create policy "public can update shared sessions"
on public.shared_sessions
for update
to anon
using (true)
with check (true);

create policy "public can read session participants"
on public.session_participants
for select
to anon
using (true);

create policy "public can insert session participants"
on public.session_participants
for insert
to anon
with check (true);

create policy "public can update session participants"
on public.session_participants
for update
to anon
using (true)
with check (true);

create policy "public can read weekly states"
on public.weekly_states
for select
to anon
using (true);

create policy "public can insert weekly states"
on public.weekly_states
for insert
to anon
with check (true);

create policy "public can update weekly states"
on public.weekly_states
for update
to anon
using (true)
with check (true);

create policy "public can read rule memories"
on public.rule_memories
for select
to anon
using (true);

create policy "public can insert rule memories"
on public.rule_memories
for insert
to anon
with check (true);

create policy "public can update rule memories"
on public.rule_memories
for update
to anon
using (true)
with check (true);
