-- Livo waitlist table.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

alter table public.waitlist enable row level security;

-- Anonymous visitors may only INSERT (join the waitlist).
-- Nobody with the anon key can read, update, or delete rows.
create policy "anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- View signups in the dashboard (Table Editor) or with your service-role key.
