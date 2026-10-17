-- QuickCricket v10: run once in your existing Supabase project's SQL Editor.
-- A transaction ensures a failure rolls back the complete migration.
-- This does not alter the existing matches table.
begin;
create table public.qc_merchant_profiles (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 200),
 type text not null check (type in ('shop','venue')),
 area text not null check (length(trim(area)) between 1 and 200),
 contact text not null check (length(trim(contact)) between 1 and 200),
 created_at timestamptz not null default now()
);
create index qc_merchant_profiles_owner_idx on public.qc_merchant_profiles(owner_id);
alter table public.qc_merchant_profiles enable row level security;
revoke all on public.qc_merchant_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.qc_merchant_profiles to authenticated;
create policy qc_merchant_read_own on public.qc_merchant_profiles for select to authenticated using ((select auth.uid()) = owner_id);
create policy qc_merchant_create_own on public.qc_merchant_profiles for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy qc_merchant_update_own on public.qc_merchant_profiles for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy qc_merchant_delete_own on public.qc_merchant_profiles for delete to authenticated using ((select auth.uid()) = owner_id);
commit;
