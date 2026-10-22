-- GIPSE — security: admin check, Row Level Security, grants, audit trail, storage.
--
-- Model:
--   anon           → may read published catalog data and shop settings. Nothing else.
--   authenticated  → same as anon, plus full catalog/order management IF listed in admin_profiles.
--   service_role   → used only by server code (checkout RPC, Telegram bookkeeping,
--                    payment callbacks, rate limiting). Bypasses RLS.

-- ---------------------------------------------------------------------------
-- is_admin()
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Start from zero privileges, then grant exactly what each role needs.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Public catalog
grant select on public.categories, public.products, public.product_images, public.shop_settings
  to anon, authenticated;

-- Admin catalog management (RLS below restricts to admins)
grant insert, update, delete on public.categories, public.products, public.product_images
  to authenticated;
grant update (
  delivery_fee_amd, free_delivery_threshold_amd, contact_phone, contact_email,
  instagram_url, facebook_url, pickup_location_hy, pickup_location_ru, pickup_location_en
) on public.shop_settings to authenticated;

-- Admin order access. Column-level UPDATE grant: an admin session can change only
-- workflow fields, never totals, items, or customer data (mass-assignment guard).
grant select on public.orders, public.order_items, public.order_events, public.payments
  to authenticated;
grant update (order_status, payment_status, admin_note) on public.orders to authenticated;

grant select on public.admin_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.admin_profiles enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.shop_settings  enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_events   enable row level security;
alter table public.payments       enable row level security;
alter table public.rate_limits    enable row level security;  -- no policies: service_role only

-- admin_profiles: a signed-in user may see only their own row. No writes via the API.
create policy "admin_profiles: read own row"
  on public.admin_profiles for select to authenticated
  using (user_id = (select auth.uid()));

-- categories
create policy "categories: public read"
  on public.categories for select to anon, authenticated
  using (true);
create policy "categories: admin insert"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "categories: admin update"
  on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin delete"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

-- products
create policy "products: public read published"
  on public.products for select to anon, authenticated
  using (is_published or (select public.is_admin()));
create policy "products: admin insert"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy "products: admin update"
  on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin delete"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

-- product_images
create policy "product_images: public read for published products"
  on public.product_images for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.is_published
    )
  );
create policy "product_images: admin insert"
  on public.product_images for insert to authenticated
  with check ((select public.is_admin()));
create policy "product_images: admin update"
  on public.product_images for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_images: admin delete"
  on public.product_images for delete to authenticated
  using ((select public.is_admin()));

-- shop_settings
create policy "shop_settings: public read"
  on public.shop_settings for select to anon, authenticated
  using (true);
create policy "shop_settings: admin update"
  on public.shop_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders & related: admins only. Customers never read orders through the API;
-- the confirmation page is rendered server-side by public_token.
create policy "orders: admin read"
  on public.orders for select to authenticated
  using ((select public.is_admin()));
create policy "orders: admin update"
  on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "order_items: admin read"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

create policy "order_events: admin read"
  on public.order_events for select to authenticated
  using ((select public.is_admin()));

create policy "payments: admin read"
  on public.payments for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Audit trail: every workflow change on an order is recorded automatically,
-- whoever makes it (admin session, payment callback, Telegram worker).
-- ---------------------------------------------------------------------------

create or replace function public.log_order_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if new.order_status is distinct from old.order_status then
    insert into public.order_events (order_id, event_type, from_value, to_value, actor_id)
    values (new.id, 'order_status', old.order_status, new.order_status, actor);
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, event_type, from_value, to_value, actor_id)
    values (new.id, 'payment_status', old.payment_status, new.payment_status, actor);
  end if;
  if new.admin_note is distinct from old.admin_note then
    insert into public.order_events (order_id, event_type, actor_id)
    values (new.id, 'admin_note', actor);
  end if;
  if new.telegram_sent_at is not null and old.telegram_sent_at is null then
    insert into public.order_events (order_id, event_type, to_value)
    values (new.id, 'telegram', 'sent');
  end if;
  return new;
end;
$$;

revoke all on function public.log_order_changes() from public, anon, authenticated;

create trigger orders_log_changes
  after update on public.orders
  for each row execute function public.log_order_changes();

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket for product photos, admin-only writes.
-- Size and MIME limits are enforced by Storage itself, not only by the UI.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product-images: admin list"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'products'
    and (select public.is_admin())
  );

create policy "product-images: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
