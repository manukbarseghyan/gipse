-- GIPSE — initial schema
-- Tables, constraints, indexes, timestamps. Security (RLS, grants) lives in the
-- next migration; the order RPC lives in the one after that.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------------

create table public.admin_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

comment on table public.admin_profiles is
  'Maps Supabase Auth users to the admin role. Rows are inserted manually (see DEPLOYMENT.md); there is no public sign-up.';

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique
             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name_hy    text not null check (char_length(btrim(name_hy)) between 1 and 120),
  name_ru    text check (name_ru is null or char_length(name_ru) <= 120),
  name_en    text check (name_en is null or char_length(name_en) <= 120),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name_hy        text not null check (char_length(btrim(name_hy)) between 1 and 160),
  name_ru        text check (name_ru is null or char_length(name_ru) <= 160),
  name_en        text check (name_en is null or char_length(name_en) <= 160),
  description_hy text check (description_hy is null or char_length(description_hy) <= 5000),
  description_ru text check (description_ru is null or char_length(description_ru) <= 5000),
  description_en text check (description_en is null or char_length(description_en) <= 5000),
  -- Whole AMD; the dram has no circulating minor unit.
  price_amd      integer not null check (price_amd > 0 and price_amd <= 100000000),
  category_id    uuid references public.categories (id) on delete set null,
  is_available   boolean not null default true,
  -- Units in stock. NULL = made to order (no stock limit). When set, checkout
  -- caps quantities at this number and decrements it atomically.
  stock_quantity integer check (stock_quantity is null or stock_quantity between 0 and 100000),
  is_featured    boolean not null default false,
  -- Unpublished products are drafts: hidden from the storefront entirely.
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_created_at_idx on public.products (created_at desc);
create index products_published_featured_idx on public.products (is_published, is_featured);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  -- Object path inside the "product-images" bucket, e.g. products/<uuid>.webp
  storage_path text not null
               check (storage_path ~ '^products/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|avif)$'),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (product_id, storage_path)
);

create index product_images_product_idx on public.product_images (product_id, sort_order);
create index product_images_path_idx on public.product_images (storage_path);

-- ---------------------------------------------------------------------------
-- Shop settings (single row)
-- ---------------------------------------------------------------------------

create table public.shop_settings (
  id                          smallint primary key default 1 check (id = 1),
  delivery_fee_amd            integer not null default 0 check (delivery_fee_amd >= 0),
  -- Orders whose subtotal reaches this amount ship free. NULL = never free.
  free_delivery_threshold_amd integer check (free_delivery_threshold_amd is null or free_delivery_threshold_amd > 0),
  contact_phone               text check (contact_phone is null or char_length(contact_phone) <= 40),
  contact_email               text check (contact_email is null or char_length(contact_email) <= 120),
  instagram_url               text check (instagram_url is null or instagram_url ~ '^https://'),
  facebook_url                text check (facebook_url is null or facebook_url ~ '^https://'),
  pickup_location_hy          text check (pickup_location_hy is null or char_length(pickup_location_hy) <= 300),
  pickup_location_ru          text check (pickup_location_ru is null or char_length(pickup_location_ru) <= 300),
  pickup_location_en          text check (pickup_location_en is null or char_length(pickup_location_en) <= 300),
  updated_at                  timestamptz not null default now()
);

create trigger shop_settings_set_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

insert into public.shop_settings (id, instagram_url, pickup_location_hy, pickup_location_ru, pickup_location_en)
values (
  1,
  'https://www.instagram.com/gipse___/',
  'Ապարան, Հայաստան',
  'Апаран, Армения',
  'Aparan, Armenia'
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create sequence public.order_number_seq start with 1001;

create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text not null unique,
  -- Unguessable token for the customer's confirmation page; never contains PII.
  public_token           uuid not null unique default gen_random_uuid(),
  -- Client-generated key that makes checkout submissions idempotent.
  idempotency_key        uuid not null unique,
  locale                 text not null default 'hy' check (locale in ('hy', 'ru', 'en')),
  customer_name          text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone         text not null check (customer_phone ~ '^\+?[0-9]{8,15}$'),
  delivery_address       text not null check (char_length(btrim(delivery_address)) between 5 and 500),
  delivery_notes         text check (delivery_notes is null or char_length(delivery_notes) <= 500),
  customer_note          text check (customer_note is null or char_length(customer_note) <= 1000),
  payment_method         text not null check (payment_method in ('cash_on_delivery', 'card')),
  payment_status         text not null default 'pending'
                         check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  order_status           text not null default 'new'
                         check (order_status in ('new', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled')),
  subtotal_amd           integer not null check (subtotal_amd > 0),
  delivery_fee_amd       integer not null default 0 check (delivery_fee_amd >= 0),
  total_amd              integer not null,
  admin_note             text check (admin_note is null or char_length(admin_note) <= 4000),
  -- Telegram delivery bookkeeping (see lib/telegram).
  telegram_sent_at       timestamptz,
  telegram_claimed_at    timestamptz,
  telegram_attempts      integer not null default 0,
  telegram_last_error    text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint orders_total_consistent check (total_amd = subtotal_amd + delivery_fee_amd)
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (order_status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_phone_idx on public.orders (customer_phone);
create index orders_telegram_pending_idx on public.orders (created_at) where telegram_sent_at is null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  -- Kept nullable so deleting a product never deletes order history.
  product_id            uuid references public.products (id) on delete set null,
  product_slug_snapshot text not null,
  -- Armenian name (the shop's working language), used by admin and Telegram.
  product_name_snapshot text not null,
  -- {"hy": "...", "ru": "...", "en": "..."} as it was at order time.
  product_name_i18n     jsonb not null default '{}'::jsonb,
  unit_price_amd        integer not null check (unit_price_amd > 0),
  quantity              integer not null check (quantity between 1 and 99),
  line_total_amd        integer not null,
  constraint order_items_line_total_consistent check (line_total_amd = unit_price_amd * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'order_status', 'payment_status', 'admin_note', 'telegram', 'payment')),
  from_value text,
  to_value   text,
  actor_id   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Online payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  provider          text not null check (provider in ('arca')),
  -- Gateway-side identifier (ArCa "orderId"/"mdOrder").
  provider_order_id text unique,
  -- Our attempt number, sent to the gateway as orderNumber (must be unique per attempt).
  attempt_reference text not null unique,
  amount_amd        integer not null check (amount_amd > 0),
  status            text not null default 'created'
                    check (status in ('created', 'pending', 'paid', 'failed', 'refunded')),
  last_gateway_status text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, used by checkout and login)
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);
