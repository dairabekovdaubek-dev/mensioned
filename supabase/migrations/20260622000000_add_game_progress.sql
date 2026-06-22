create table if not exists public.game_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gold integer not null default 0 check (gold >= 0),
  diamonds integer not null default 0 check (diamonds >= 0),
  unlocked_skins text[] not null default array['bowie_oxide']::text[],
  selected_knife_skin_id text not null default 'bowie_oxide',
  difficulty text not null default 'survival',
  game_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_progress enable row level security;

drop policy if exists "read own game progress" on public.game_progress;
drop policy if exists "insert own game progress" on public.game_progress;
drop policy if exists "update own game progress" on public.game_progress;

create policy "read own game progress"
  on public.game_progress for select
  using (auth.uid() = user_id);

create policy "insert own game progress"
  on public.game_progress for insert
  with check (auth.uid() = user_id);

create policy "update own game progress"
  on public.game_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
