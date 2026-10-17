-- Run once AFTER 001-merchant-profiles.sql succeeded.
-- Creates private merchant inventory. No public checkout or sales.
begin;
create table public.qc_merchant_products (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.qc_merchant_profiles(id) on delete restrict,
 name text not null check(length(trim(name)) between 1 and 200),
 description text not null default '' check(length(description)<=2000),
 price numeric(12,2) not null check(price>0 and price<=100000000),
 stock integer not null check(stock between 0 and 1000000),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create index qc_merchant_products_merchant_idx on public.qc_merchant_products(merchant_id);
alter table public.qc_merchant_products enable row level security;
revoke all on public.qc_merchant_products from public, anon, authenticated;
grant select,insert,update,delete on public.qc_merchant_products to authenticated;
create policy qc_products_owner_access on public.qc_merchant_products
for all to authenticated
using (exists (select 1 from public.qc_merchant_profiles m where m.id=merchant_id and m.owner_id=(select auth.uid()) and m.type='shop'))
with check (exists (select 1 from public.qc_merchant_profiles m where m.id=merchant_id and m.owner_id=(select auth.uid()) and m.type='shop'));
commit;
