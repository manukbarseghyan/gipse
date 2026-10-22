-- Database integration tests. Run with: npm run test:db  (requires Docker)
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set QUIET on
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'stranger@example.test');
insert into public.admin_profiles (user_id) values ('00000000-0000-0000-0000-00000000a001');

insert into public.categories (id, slug, name_hy, name_en) values
  ('10000000-0000-0000-0000-000000000001', 'figurines', 'Արձանիկներ', 'Figurines');

insert into public.products (id, slug, name_hy, name_ru, name_en, price_amd, category_id, is_available, is_published, stock_quantity) values
  ('20000000-0000-0000-0000-000000000001', 'angel', 'Հրեշտակ', 'Ангел', 'Angel', 5000, '10000000-0000-0000-0000-000000000001', true, true, null),
  ('20000000-0000-0000-0000-000000000002', 'cat', 'Կատու', null, 'Cat', 3500, null, true, true, 2),
  ('20000000-0000-0000-0000-000000000003', 'sold-out', 'Վաճառված', null, null, 4000, null, false, true, null),
  ('20000000-0000-0000-0000-000000000004', 'draft', 'Սևագիր', null, null, 9000, null, true, false, null);

update public.shop_settings set delivery_fee_amd = 1000, free_delivery_threshold_amd = 20000 where id = 1;

create or replace function pg_temp.act_as(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_sub is null then json_build_object('role', p_role)::text
         else json_build_object('role', p_role, 'sub', p_sub)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  execute format('set local role %I', p_role);
end $$;

-- ---------------------------------------------------------------------------
-- anon: public catalog only
-- ---------------------------------------------------------------------------
begin;
select pg_temp.act_as('anon', null) \gset
do $$
declare n int;
begin
  select count(*) into n from public.products;
  if n <> 3 then raise exception 'anon should see 3 published products, saw %', n; end if;
  if exists (select 1 from public.products where slug = 'draft') then raise exception 'anon can see a draft'; end if;
  select count(*) into n from public.shop_settings;
  if n <> 1 then raise exception 'anon should read shop settings'; end if;

  begin
    perform 1 from public.orders;
    raise exception 'anon could read orders';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.products (slug, name_hy, price_amd) values ('hack', 'x', 1);
    raise exception 'anon could insert a product';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
      'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]', 6000);
    raise exception 'anon could call create_order directly';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.check_rate_limit('x', 1, 60);
    raise exception 'anon could call check_rate_limit';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: anon is limited to the public catalog';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- authenticated non-admin: no extra rights
-- ---------------------------------------------------------------------------
begin;
select pg_temp.act_as('authenticated', '00000000-0000-0000-0000-00000000b002') \gset
do $$
declare n int;
begin
  if public.is_admin() then raise exception 'stranger is admin'; end if;
  select count(*) into n from public.orders;
  if n <> 0 then raise exception 'stranger can read orders'; end if;
  update public.products set price_amd = 1 where slug = 'angel';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'stranger updated a product'; end if;
  select count(*) into n from public.products where slug = 'draft';
  if n <> 0 then raise exception 'stranger can see drafts'; end if;
  begin
    perform public.admin_dashboard_stats();
    raise exception 'stranger read dashboard stats';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.admin_profiles (user_id) values ('00000000-0000-0000-0000-00000000b002');
    raise exception 'stranger self-promoted to admin';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: non-admin users have no privileged access';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- create_order (service_role)
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
do $$
declare
  r jsonb;
  r2 jsonb;
  v_order public.orders%rowtype;
  v_key uuid := gen_random_uuid();
  n int;
begin
  -- 2 × angel (5000) + 1 × cat (3500) = 13500, below free threshold → +1000 delivery
  r := public.create_order(v_key, 'en', '  Anna Petrosyan ', '+37477123456', 'Yerevan, Abovyan 1', 'Ring twice', null,
         'cash_on_delivery',
         '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1},
           {"product_id":"20000000-0000-0000-0000-000000000001","quantity":1},
           {"product_id":"20000000-0000-0000-0000-000000000002","quantity":1}]', 14500);
  if not (r->>'ok')::boolean then raise exception 'create_order failed: %', r; end if;

  select * into v_order from public.orders where id = (r->>'order_id')::uuid;
  if v_order.subtotal_amd <> 13500 or v_order.delivery_fee_amd <> 1000 or v_order.total_amd <> 14500 then
    raise exception 'wrong totals: % % %', v_order.subtotal_amd, v_order.delivery_fee_amd, v_order.total_amd;
  end if;
  if v_order.customer_name <> 'Anna Petrosyan' then raise exception 'name not trimmed'; end if;
  if v_order.payment_status <> 'pending' or v_order.order_status <> 'new' then raise exception 'wrong initial statuses'; end if;
  if v_order.order_number !~ '^GP-\d+$' then raise exception 'bad order number %', v_order.order_number; end if;

  select count(*) into n from public.order_items where order_id = v_order.id;
  if n <> 2 then raise exception 'duplicate lines were not merged (% lines)', n; end if;
  if not exists (select 1 from public.order_items where order_id = v_order.id and product_name_snapshot = 'Հրեշտակ'
                 and quantity = 2 and unit_price_amd = 5000 and line_total_amd = 10000
                 and product_name_i18n = '{"hy":"Հրեշտակ","ru":"Ангел","en":"Angel"}'::jsonb) then
    raise exception 'item snapshot incorrect';
  end if;

  -- stock decremented: cat 2 → 1
  if (select stock_quantity from public.products where slug = 'cat') <> 1 then raise exception 'stock not decremented'; end if;

  -- idempotent replay
  r2 := public.create_order(v_key, 'en', 'Someone Else', '+37477000000', 'Elsewhere 1', null, null, 'cash_on_delivery',
          '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":5}]', 26000);
  if r2->>'order_id' <> r->>'order_id' or not (r2->>'existing')::boolean then raise exception 'replay created a new order'; end if;
  select count(*) into n from public.orders;
  if n <> 1 then raise exception 'expected 1 order, found %', n; end if;

  -- price changed / tampered total: nothing written, fresh totals returned
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]', 1);
  if r->>'error' <> 'price_changed' or (r->>'total_amd')::int <> 6000 then raise exception 'tampered total not rejected: %', r; end if;

  -- free delivery threshold: 4 × 5000 = 20000 → fee 0
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'card', '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":4}]', 20000);
  if not (r->>'ok')::boolean then raise exception 'free-delivery order failed: %', r; end if;

  -- unavailable / unpublished / unknown products
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000003","quantity":1}]', 5000);
  if r->>'error' <> 'product_unavailable' then raise exception 'unavailable product accepted: %', r; end if;
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000004","quantity":1}]', 10000);
  if r->>'error' <> 'product_unavailable' then raise exception 'draft product accepted: %', r; end if;
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"29999999-0000-0000-0000-000000000000","quantity":1}]', 1000);
  if r->>'error' <> 'product_unavailable' then raise exception 'unknown product accepted: %', r; end if;

  -- insufficient stock: cat has 1 left
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":2}]', 8000);
  if r->>'error' <> 'insufficient_stock' or (r->'items'->0->>'available')::int <> 1 then raise exception 'stock limit not enforced: %', r; end if;

  -- buying the last unit makes the product unavailable
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":1}]', 4500);
  if not (r->>'ok')::boolean then raise exception 'last unit order failed: %', r; end if;
  if (select is_available from public.products where slug = 'cat') then raise exception 'sold-out product still available'; end if;

  -- invalid input
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"not-a-uuid","quantity":1}]', 1000);
  if r->>'error' <> 'invalid_input' then raise exception 'bad uuid accepted: %', r; end if;
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":0}]', 1000);
  if r->>'error' <> 'invalid_input' then raise exception 'zero quantity accepted: %', r; end if;
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'cash_on_delivery', '[]', 1000);
  if r->>'error' <> 'invalid_input' then raise exception 'empty cart accepted: %', r; end if;
  r := public.create_order(gen_random_uuid(), 'hy', 'Test User', '+37477123456', 'Yerevan, Abovyan 1', null, null,
         'bitcoin', '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]', 6000);
  if r->>'error' <> 'invalid_input' then raise exception 'unknown payment method accepted: %', r; end if;

  raise notice 'ok: create_order computes prices server-side, snapshots items, is idempotent and enforces availability/stock';
end $$;

-- Telegram claim is exclusive
do $$
declare v_id uuid := (select id from public.orders order by created_at limit 1);
begin
  if not public.claim_telegram_notification(v_id) then raise exception 'first claim failed'; end if;
  if public.claim_telegram_notification(v_id) then raise exception 'second concurrent claim succeeded'; end if;
  perform public.complete_telegram_notification(v_id, 'HTTP 502');
  if (select telegram_last_error from public.orders where id = v_id) <> 'HTTP 502' then raise exception 'error not recorded'; end if;
  if not public.claim_telegram_notification(v_id) then raise exception 'retry after failure could not claim'; end if;
  perform public.complete_telegram_notification(v_id, null);
  if (select telegram_sent_at from public.orders where id = v_id) is null then raise exception 'sent_at not set'; end if;
  if public.claim_telegram_notification(v_id) then raise exception 'claimed an already-sent notification'; end if;
  raise notice 'ok: telegram notifications are claimed exclusively and sent once';
end $$;

-- Payments are recorded idempotently
do $$
declare
  v_order uuid := (select id from public.orders where payment_method = 'card' limit 1);
  v_payment uuid;
begin
  insert into public.payments (order_id, provider, attempt_reference, amount_amd, provider_order_id)
  values (v_order, 'arca', 'GP-TEST-1', 20000, 'gw-1') returning id into v_payment;
  if not public.record_payment_result(v_payment, 'paid', 'orderStatus=2') then raise exception 'paid not recorded'; end if;
  if public.record_payment_result(v_payment, 'paid', 'orderStatus=2') then raise exception 'duplicate paid applied twice'; end if;
  if public.record_payment_result(v_payment, 'failed', 'orderStatus=6') then raise exception 'paid moved back to failed'; end if;
  if (select payment_status from public.orders where id = v_order) <> 'paid' then raise exception 'order not marked paid'; end if;
  if (select count(*) from public.order_events where order_id = v_order and event_type = 'payment') <> 1 then
    raise exception 'payment event count wrong';
  end if;
  raise notice 'ok: payment results are idempotent and never move backwards';
end $$;

-- Rate limiting
do $$
begin
  if not public.check_rate_limit('test', 2, 60) then raise exception 'hit 1 limited'; end if;
  if not public.check_rate_limit('test', 2, 60) then raise exception 'hit 2 limited'; end if;
  if public.check_rate_limit('test', 2, 60) then raise exception 'hit 3 not limited'; end if;
  raise notice 'ok: rate limiter blocks after the limit';
end $$;
commit;

-- ---------------------------------------------------------------------------
-- admin: manage orders, but only workflow columns
-- ---------------------------------------------------------------------------
begin;
select pg_temp.act_as('authenticated', '00000000-0000-0000-0000-00000000a001') \gset
do $$
declare
  v_id uuid;
  n int;
  stats jsonb;
begin
  if not public.is_admin() then raise exception 'owner is not admin'; end if;
  select count(*) into n from public.orders;
  if n < 3 then raise exception 'admin cannot read orders'; end if;
  select count(*) into n from public.products where slug = 'draft';
  if n <> 1 then raise exception 'admin cannot see drafts'; end if;

  select id into v_id from public.orders where payment_method = 'cash_on_delivery' order by created_at limit 1;
  update public.orders set order_status = 'confirmed', admin_note = 'Called the customer' where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin could not update order'; end if;
  if not exists (select 1 from public.order_events where order_id = v_id and event_type = 'order_status'
                 and from_value = 'new' and to_value = 'confirmed'
                 and actor_id = '00000000-0000-0000-0000-00000000a001') then
    raise exception 'status change not audited';
  end if;

  begin
    update public.orders set total_amd = 1, subtotal_amd = 1, delivery_fee_amd = 0 where id = v_id;
    raise exception 'admin could change order totals';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.orders set customer_phone = '+37400000000' where id = v_id;
    raise exception 'admin could change customer data';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.orders set order_status = 'teleported' where id = v_id;
    raise exception 'invalid status accepted';
  exception when check_violation then null;
  end;

  insert into public.products (slug, name_hy, price_amd) values ('admin-made', 'Նոր', 2500);
  update public.products set price_amd = 2600 where slug = 'admin-made';
  begin
    insert into public.products (slug, name_hy, price_amd) values ('Bad Slug!', 'x', 100);
    raise exception 'invalid slug accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.products (slug, name_hy, price_amd) values ('free-thing', 'x', 0);
    raise exception 'zero price accepted';
  exception when check_violation then null;
  end;

  stats := public.admin_dashboard_stats();
  if (stats->>'total_orders')::int < 3 then raise exception 'bad stats %', stats; end if;
  -- Revenue counts the paid card order (20000) only; the confirmed COD order is not completed yet.
  if (stats->>'revenue_amd')::int <> 20000 then raise exception 'unexpected revenue %', stats; end if;

  raise notice 'ok: admin manages catalog and order workflow but cannot alter totals or customer data';
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Deleting a product keeps order history intact
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
do $$
declare n int;
begin
  delete from public.products where slug = 'angel';
  select count(*) into n from public.order_items where product_slug_snapshot = 'angel' and product_id is null;
  if n < 1 then raise exception 'order items lost or still linked after product delete'; end if;
  raise notice 'ok: deleting a product preserves order item snapshots';
end $$;
rollback;

\echo 'ALL DATABASE TESTS PASSED'
