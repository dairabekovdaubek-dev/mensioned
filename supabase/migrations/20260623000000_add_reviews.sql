create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text not null default 'Гость' check (char_length(author_name) between 1 and 40),
  text text not null check (char_length(text) between 2 and 600),
  rating integer not null default 5 check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "read public reviews" on public.reviews;
drop policy if exists "insert reviews" on public.reviews;
drop policy if exists "delete own reviews" on public.reviews;

create policy "read public reviews"
  on public.reviews for select
  using (true);

create policy "insert reviews"
  on public.reviews for insert
  with check (true);

create policy "delete own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);
