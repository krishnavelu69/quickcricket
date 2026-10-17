-- Run ONCE after migrations 001 and 002. Existing items remain unpublished.
begin;
alter table public.qc_merchant_products add column published boolean not null default false;
-- Intentionally privileged read-only projection: private base tables stay owner-only.
-- Only these explicitly selected customer-facing fields may leave the function.
create function public.qc_public_catalog()
returns table (id uuid, name text, description text, price numeric, in_stock boolean, shop_name text, area text)
language sql stable security definer
set search_path = ''
as $$
 select p.id,p.name,p.description,p.price,(p.stock>0),m.name,m.area
 from public.qc_merchant_products p
 join public.qc_merchant_profiles m on m.id=p.merchant_id
 where p.published=true and p.active=true and m.type='shop'
 order by p.created_at desc,p.id
 limit 200;
$$;
revoke all on function public.qc_public_catalog() from public;
grant execute on function public.qc_public_catalog() to anon,authenticated;
commit;
