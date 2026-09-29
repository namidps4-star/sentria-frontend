-- S-3 step 1: one account per user.
-- Run once in the Supabase SQL editor.
--
-- profile holds the account's settings (company, sector, activity...).
-- company_id is what the company's data will be keyed on (step 2): it is
-- set here by the database and a user can never choose or change it, so
-- nobody can attach themselves to another company's data.

create table if not exists public.accounts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null default gen_random_uuid(),
  profile    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_company_idx on public.accounts (company_id);

alter table public.accounts enable row level security;

drop policy if exists "accounts: read own" on public.accounts;
create policy "accounts: read own" on public.accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "accounts: create own" on public.accounts;
create policy "accounts: create own" on public.accounts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "accounts: update own" on public.accounts;
create policy "accounts: update own" on public.accounts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Column grants: the browser may write its profile, never company_id.
revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to authenticated;
grant insert (user_id, profile) on public.accounts to authenticated;
grant update (profile, updated_at) on public.accounts to authenticated;
