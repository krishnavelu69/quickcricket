-- QuickCricket v13. Run ONCE after 001, 002 and 003.
-- Requests are not payments. Stock is deducted only on merchant acceptance.
begin;
create table public.qc_order_requests (
 id uuid primary key,
 buyer_id uuid not null references auth.users(id),
 merchant_id uuid not null references public.qc_merchant_profiles(id) on delete restrict,
 product_id uuid not null references public.qc_merchant_products(id) on delete restrict,
 product_name text not null,
 shop_name text not null,
 quantity integer not null check (quantity between 1 and 1000),
 unit_price numeric(12,2) not null check (unit_price>0),
 total numeric(15,2) generated always as (unit_price*quantity) stored,
 customer_name text not null check (length(trim(customer_name)) between 1 and 200),
 contact text not null check (length(trim(contact)) between 1 and 200),
 note text not null default '' check (length(note)<=1000),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index qc_orders_buyer_idx on public.qc_order_requests(buyer_id,created_at desc);
create index qc_orders_merchant_idx on public.qc_order_requests(merchant_id,created_at desc);
alter table public.qc_order_requests enable row level security;
revoke all on public.qc_order_requests from public,anon,authenticated;
grant select on public.qc_order_requests to authenticated;
create policy qc_orders_read_participant on public.qc_order_requests for select to authenticated
using (buyer_id=(select auth.uid()) or exists(select 1 from public.qc_merchant_profiles m where m.id=merchant_id and m.owner_id=(select auth.uid())));

create function public.qc_create_order_request(
 p_request_id uuid,p_product_id uuid,p_quantity integer,p_expected_price numeric,
 p_customer_name text,p_contact text,p_note text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_product public.qc_merchant_products%rowtype;
 v_merchant public.qc_merchant_profiles%rowtype; v_existing public.qc_order_requests%rowtype;
begin
 if v_user is null then raise exception 'Sign in to request a product.'; end if;
 if p_request_id is null or p_product_id is null or p_quantity is null or p_quantity<1 or p_quantity>1000 then raise exception 'Choose a quantity from 1 to 1000.'; end if;
 if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 200 or p_contact is null or length(trim(p_contact)) not between 1 and 200 or length(coalesce(p_note,''))>1000 then raise exception 'Enter your name and contact; keep notes under 1000 characters.'; end if;
 -- A retry of the same request returns the existing ID without another order.
 select * into v_existing from public.qc_order_requests where id=p_request_id;
 if found then
  if v_existing.buyer_id<>v_user or v_existing.product_id<>p_product_id or v_existing.quantity<>p_quantity then raise exception 'Request reference already used. Start a new request.'; end if;
  return v_existing.id;
 end if;
 select * into v_product from public.qc_merchant_products where id=p_product_id for update;
 if not found or not v_product.active or not v_product.published then raise exception 'This product is no longer available.'; end if;
 select * into v_merchant from public.qc_merchant_profiles where id=v_product.merchant_id;
 if not found or v_merchant.type<>'shop' then raise exception 'This shop is unavailable.'; end if;
 if v_merchant.owner_id=v_user then raise exception 'Use a customer account to request from your shop.'; end if;
 if p_expected_price is null or v_product.price<>p_expected_price then raise exception 'Price changed. Refresh Sports Shop and review the new price.'; end if;
 if v_product.stock<p_quantity then raise exception 'Insufficient stock for that quantity. Refresh Sports Shop.'; end if;
 insert into public.qc_order_requests(id,buyer_id,merchant_id,product_id,product_name,shop_name,quantity,unit_price,customer_name,contact,note)
 values(p_request_id,v_user,v_product.merchant_id,v_product.id,v_product.name,v_merchant.name,p_quantity,v_product.price,trim(p_customer_name),trim(p_contact),trim(coalesce(p_note,'')))
 on conflict(id) do nothing;
 select * into v_existing from public.qc_order_requests where id=p_request_id;
 if v_existing.buyer_id<>v_user or v_existing.product_id<>p_product_id or v_existing.quantity<>p_quantity then raise exception 'Request reference already used. Start a new request.'; end if;
 return v_existing.id;
end; $$;

create function public.qc_decide_order_request(p_order_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_order public.qc_order_requests%rowtype;v_owner uuid;v_product public.qc_merchant_products%rowtype;
begin
 if v_user is null then raise exception 'Sign in first.'; end if;
 if p_action is null or p_action not in ('accepted','rejected','cancelled') then raise exception 'Invalid request action.'; end if;
 -- Serialize changes to one order, including retries and buyer cancellations.
 select * into v_order from public.qc_order_requests where id=p_order_id for update;
 if not found then raise exception 'Request unavailable.'; end if;
 select owner_id into v_owner from public.qc_merchant_profiles where id=v_order.merchant_id;
 if (p_action='cancelled' and v_order.buyer_id<>v_user) or (p_action in ('accepted','rejected') and v_owner is distinct from v_user) then raise exception 'You cannot change this request.'; end if;
 if v_order.status=p_action then return v_order.status; end if;
 if v_order.status<>'pending' then raise exception 'This request has already been decided. Refresh the list.'; end if;
 if p_action='accepted' then
  -- Concurrent acceptances cannot consume the same units twice.
  select * into v_product from public.qc_merchant_products where id=v_order.product_id for update;
  if not found or not v_product.active or v_product.merchant_id<>v_order.merchant_id then raise exception 'Product is archived, moved to another shop, or unavailable.'; end if;
  if v_product.stock<v_order.quantity then raise exception 'Not enough stock to accept this request.'; end if;
  update public.qc_merchant_products set stock=stock-v_order.quantity where id=v_order.product_id;
 end if;
 update public.qc_order_requests set status=p_action,updated_at=now() where id=p_order_id;
 return p_action;
end; $$;
revoke all on function public.qc_create_order_request(uuid,uuid,integer,numeric,text,text,text) from public,anon;
revoke all on function public.qc_decide_order_request(uuid,text) from public,anon;
grant execute on function public.qc_create_order_request(uuid,uuid,integer,numeric,text,text,text) to authenticated;
grant execute on function public.qc_decide_order_request(uuid,text) to authenticated;
commit;
