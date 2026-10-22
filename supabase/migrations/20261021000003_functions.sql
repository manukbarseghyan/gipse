-- GIPSE — server-side business functions.
-- All functions here are SECURITY DEFINER with a pinned search_path and are
-- executable only by the roles that need them.

-- ---------------------------------------------------------------------------
-- create_order: atomic, idempotent checkout.
--
-- Prices, availability and delivery fee come from the database, never from the
-- caller. p_expected_total_amd is what the customer saw; if it no longer
-- matches, nothing is written and the fresh totals are returned so the UI can
-- ask the customer to confirm.
-- ---------------------------------------------------------------------------

create or replace function public.create_order(
  p_idempotency_key    uuid,
  p_locale             text,
  p_customer_name      text,
  p_customer_phone     text,
  p_delivery_address   text,
  p_delivery_notes     text,
  p_customer_note      text,
  p_payment_method     text,
  p_items              jsonb,
  p_expected_total_amd integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing     public.orders%rowtype;
  v_settings     public.shop_settings%rowtype;
  v_order_id     uuid;
  v_order_number text;
  v_token        uuid;
  v_subtotal     bigint := 0;
  v_delivery_fee integer := 0;
  v_total        bigint;
  v_unavailable  uuid[];
  v_item_count   integer;
  v_req          jsonb;
begin
  -- Idempotent replay: the same checkout submitted twice returns the same order.
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'ok', true, 'existing', true,
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'public_token', v_existing.public_token, 'total_amd', v_existing.total_amd
    );
  end if;

  if p_locale not in ('hy', 'ru', 'en') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if p_payment_method not in ('cash_on_delivery', 'card') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  -- Normalise the requested lines: merge duplicates, validate quantities.
  begin
    select coalesce(jsonb_agg(jsonb_build_object('product_id', x.product_id, 'quantity', x.quantity)), '[]'::jsonb)
      into v_req
    from (
      select (e ->> 'product_id')::uuid as product_id,
             sum((e ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as e
      group by 1
    ) x;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end;

  v_item_count := jsonb_array_length(v_req);
  if v_item_count = 0 or v_item_count > 50
     or exists (
       select 1 from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
       where r.product_id is null or r.quantity is null or r.quantity < 1 or r.quantity > 99
     ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  -- Lock the referenced products so price/availability cannot change mid-checkout.
  perform 1
  from public.products p
  join jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer) on r.product_id = p.id
  for update of p;

  select array_agg(r.product_id) into v_unavailable
  from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
  left join public.products p on p.id = r.product_id
  where p.id is null or not p.is_published or not p.is_available
     or (p.stock_quantity is not null and p.stock_quantity < 1);

  if v_unavailable is not null then
    return jsonb_build_object('ok', false, 'error', 'product_unavailable', 'product_ids', to_jsonb(v_unavailable));
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
    join public.products p on p.id = r.product_id
    where p.stock_quantity is not null and r.quantity > p.stock_quantity
  ) then
    return jsonb_build_object(
      'ok', false, 'error', 'insufficient_stock',
      'items', (
        select jsonb_agg(jsonb_build_object('product_id', p.id, 'available', p.stock_quantity))
        from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
        join public.products p on p.id = r.product_id
        where p.stock_quantity is not null and r.quantity > p.stock_quantity
      )
    );
  end if;

  select coalesce(sum(p.price_amd::bigint * r.quantity), 0) into v_subtotal
  from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
  join public.products p on p.id = r.product_id;

  select * into v_settings from public.shop_settings where id = 1;
  if found then
    v_delivery_fee := case
      when v_settings.free_delivery_threshold_amd is not null
           and v_subtotal >= v_settings.free_delivery_threshold_amd then 0
      else v_settings.delivery_fee_amd
    end;
  end if;

  v_total := v_subtotal + v_delivery_fee;
  if v_total > 2000000000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  if p_expected_total_amd is distinct from v_total then
    return jsonb_build_object(
      'ok', false, 'error', 'price_changed',
      'subtotal_amd', v_subtotal, 'delivery_fee_amd', v_delivery_fee, 'total_amd', v_total
    );
  end if;

  v_order_number := 'GP-' || nextval('public.order_number_seq')::text;

  insert into public.orders (
    order_number, idempotency_key, locale,
    customer_name, customer_phone, delivery_address, delivery_notes, customer_note,
    payment_method, payment_status, order_status,
    subtotal_amd, delivery_fee_amd, total_amd
  ) values (
    v_order_number, p_idempotency_key, p_locale,
    btrim(p_customer_name), p_customer_phone, btrim(p_delivery_address),
    nullif(btrim(coalesce(p_delivery_notes, '')), ''), nullif(btrim(coalesce(p_customer_note, '')), ''),
    p_payment_method, 'pending', 'new',
    v_subtotal, v_delivery_fee, v_total
  )
  on conflict (idempotency_key) do nothing
  returning id, public_token into v_order_id, v_token;

  if v_order_id is null then
    -- A concurrent request with the same key won the race.
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    return jsonb_build_object(
      'ok', true, 'existing', true,
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'public_token', v_existing.public_token, 'total_amd', v_existing.total_amd
    );
  end if;

  insert into public.order_items (
    order_id, product_id, product_slug_snapshot, product_name_snapshot, product_name_i18n,
    unit_price_amd, quantity, line_total_amd
  )
  select v_order_id, p.id, p.slug, p.name_hy,
         jsonb_strip_nulls(jsonb_build_object('hy', p.name_hy, 'ru', p.name_ru, 'en', p.name_en)),
         p.price_amd, r.quantity, p.price_amd * r.quantity
  from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
  join public.products p on p.id = r.product_id
  order by p.name_hy;

  -- Decrement tracked stock; a product that reaches zero becomes unavailable.
  update public.products p
     set stock_quantity = p.stock_quantity - r.quantity,
         is_available = (p.stock_quantity - r.quantity) > 0
    from jsonb_to_recordset(v_req) as r(product_id uuid, quantity integer)
   where p.id = r.product_id and p.stock_quantity is not null;

  insert into public.order_events (order_id, event_type, to_value)
  values (v_order_id, 'created', 'new');

  return jsonb_build_object(
    'ok', true, 'existing', false,
    'order_id', v_order_id, 'order_number', v_order_number,
    'public_token', v_token, 'total_amd', v_total
  );
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, jsonb, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- check_rate_limit: fixed-window counter. Returns true while under the limit.
-- ---------------------------------------------------------------------------

create or replace function public.check_rate_limit(
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup of old windows (~1% of calls).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Telegram delivery: claim / complete / fail.
-- A claim is held for 2 minutes so concurrent retries cannot double-send.
-- ---------------------------------------------------------------------------

create or replace function public.claim_telegram_notification(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set telegram_claimed_at = now(),
         telegram_attempts = telegram_attempts + 1
   where id = p_order_id
     and telegram_sent_at is null
     and (telegram_claimed_at is null or telegram_claimed_at < now() - interval '2 minutes');
  return found;
end;
$$;

create or replace function public.complete_telegram_notification(p_order_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_error is null then
    update public.orders
       set telegram_sent_at = now(), telegram_last_error = null, telegram_claimed_at = null
     where id = p_order_id and telegram_sent_at is null;
  else
    update public.orders
       set telegram_last_error = left(p_error, 500), telegram_claimed_at = null
     where id = p_order_id and telegram_sent_at is null;
  end if;
end;
$$;

revoke all on function public.claim_telegram_notification(uuid) from public, anon, authenticated;
revoke all on function public.complete_telegram_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_telegram_notification(uuid) to service_role;
grant execute on function public.complete_telegram_notification(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Payments: idempotent result recording.
-- Only forward transitions are applied; a repeated callback is a no-op.
-- ---------------------------------------------------------------------------

create or replace function public.record_payment_result(
  p_payment_id     uuid,
  p_status         text,
  p_gateway_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if p_status not in ('pending', 'paid', 'failed') then
    raise exception 'invalid payment status';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    return false;
  end if;

  -- Terminal states never move backwards.
  if v_payment.status in ('paid', 'refunded') then
    return false;
  end if;
  if v_payment.status = p_status then
    return false;
  end if;

  update public.payments
     set status = p_status, last_gateway_status = left(p_gateway_status, 100)
   where id = p_payment_id;

  if p_status = 'paid' then
    update public.orders set payment_status = 'paid'
     where id = v_payment.order_id and payment_status in ('pending', 'failed');
  elsif p_status = 'failed' then
    update public.orders set payment_status = 'failed'
     where id = v_payment.order_id and payment_status = 'pending';
  end if;

  insert into public.order_events (order_id, event_type, to_value)
  values (v_payment.order_id, 'payment', p_status);

  return true;
end;
$$;

revoke all on function public.record_payment_result(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_payment_result(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- admin_dashboard_stats: real aggregates for the dashboard.
-- Revenue = orders that are paid, or completed (cash collected on delivery),
-- excluding cancelled and refunded ones.
-- ---------------------------------------------------------------------------

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total_products',     (select count(*) from public.products),
    'available_products', (select count(*) from public.products where is_available and is_published),
    'total_orders',       (select count(*) from public.orders),
    'new_orders',         (select count(*) from public.orders where order_status = 'new'),
    'active_orders',      (select count(*) from public.orders where order_status in ('new', 'confirmed', 'preparing', 'out_for_delivery')),
    'telegram_failed',    (select count(*) from public.orders where telegram_sent_at is null and telegram_attempts > 0),
    'revenue_amd',        (select coalesce(sum(total_amd), 0) from public.orders
                            where order_status <> 'cancelled'
                              and payment_status <> 'refunded'
                              and (payment_status = 'paid' or order_status = 'completed'))
  );
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated, service_role;
