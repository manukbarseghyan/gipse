-- Admin product RPCs: atomic save with images, orphaned-path reporting, authorization.
\set QUIET on
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_sub)::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  execute format('set local role %I', p_role);
end $$;

begin;
select pg_temp.act_as('authenticated', '00000000-0000-0000-0000-00000000a001') \gset
do $$
declare
  r jsonb;
  v_id uuid;
  v_other uuid;
begin
  -- create with two images
  r := public.admin_save_product(null,
    '{"slug":"vase","name_hy":"Ծաղկաման","name_en":"Vase","price_amd":7000,"is_available":true,"is_featured":true,"is_published":true,"category_id":null,"stock_quantity":null,"evil_column":"ignored"}',
    array['products/a1.webp', 'products/b2.jpg']);
  v_id := (r->>'id')::uuid;
  if (select count(*) from public.product_images where product_id = v_id) <> 2 then raise exception 'images not saved'; end if;
  if (select storage_path from public.product_images where product_id = v_id and sort_order = 0) <> 'products/a1.webp' then
    raise exception 'image order wrong';
  end if;

  -- another product shares b2.jpg
  r := public.admin_save_product(null, '{"slug":"vase-2","name_hy":"Ծաղկաման 2","price_amd":8000}', array['products/b2.jpg']);
  v_other := (r->>'id')::uuid;

  -- update: drop both images from the first product, add c3; b2 is still used by vase-2
  r := public.admin_save_product(v_id,
    '{"slug":"vase","name_hy":"Ծաղկաման","price_amd":7500,"is_available":false,"is_featured":false,"is_published":true}',
    array['products/c3.png']);
  if r->'orphaned_paths' <> '["products/a1.webp"]'::jsonb then raise exception 'wrong orphaned paths: %', r; end if;
  if (select price_amd from public.products where id = v_id) <> 7500 then raise exception 'update not applied'; end if;
  if (select is_available from public.products where id = v_id) then raise exception 'availability not updated'; end if;

  -- slug conflict surfaces as unique_violation
  begin
    perform public.admin_save_product(null, '{"slug":"vase","name_hy":"x","price_amd":1}', '{}');
    raise exception 'duplicate slug accepted';
  exception when unique_violation then null;
  end;

  -- unreferenced path check
  if public.admin_unreferenced_paths(array['products/b2.jpg', 'products/zz.webp']) <> array['products/zz.webp'] then
    raise exception 'admin_unreferenced_paths wrong';
  end if;

  -- delete: c3 becomes orphaned; b2 stays referenced by vase-2
  r := public.admin_delete_product(v_id);
  if r->'orphaned_paths' <> '["products/c3.png"]'::jsonb then raise exception 'wrong delete orphans: %', r; end if;
  r := public.admin_delete_product(v_other);
  if r->'orphaned_paths' <> '["products/b2.jpg"]'::jsonb then raise exception 'shared image not released: %', r; end if;

  raise notice 'ok: admin product RPCs save atomically and report orphaned images correctly';
end $$;
rollback;

begin;
select pg_temp.act_as('authenticated', '00000000-0000-0000-0000-00000000b002') \gset
do $$
begin
  begin
    perform public.admin_save_product(null, '{"slug":"hack","name_hy":"x","price_amd":1}', '{}');
    raise exception 'non-admin saved a product';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_delete_product('20000000-0000-0000-0000-000000000001');
    raise exception 'non-admin deleted a product';
  exception when insufficient_privilege then null;
  end;
  if array_length(public.admin_unreferenced_paths(array['products/x.webp']), 1) is not null then
    raise exception 'non-admin got path info';
  end if;
  raise notice 'ok: non-admins cannot use admin product RPCs';
end $$;
rollback;

begin;
select pg_temp.act_as('anon', null) \gset
do $$
begin
  begin
    perform public.admin_save_product(null, '{"slug":"hack","name_hy":"x","price_amd":1}', '{}');
    raise exception 'anon saved a product';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: anon cannot call admin product RPCs';
end $$;
rollback;

\echo 'ADMIN PRODUCT TESTS PASSED'
