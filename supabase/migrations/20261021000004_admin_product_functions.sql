-- GIPSE — atomic product save/delete for the admin panel.
--
-- SECURITY INVOKER: these run with the caller's privileges, so Row Level
-- Security applies and only admins (per policies in 0002) can change data.
-- Each returns the storage paths that are no longer referenced by any product,
-- so the server can delete those objects from Storage afterwards.

create or replace function public.admin_save_product(
  p_id     uuid,
  p_data   jsonb,
  p_images text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id      uuid;
  v_removed text[];
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(array_length(p_images, 1), 0) > 10 then
    raise exception 'too many images' using errcode = '22023';
  end if;

  -- Only these columns can be written; any other keys in p_data are ignored.
  if p_id is null then
    insert into public.products (
      slug, name_hy, name_ru, name_en, description_hy, description_ru, description_en,
      price_amd, category_id, stock_quantity, is_available, is_featured, is_published
    ) values (
      p_data ->> 'slug', p_data ->> 'name_hy', p_data ->> 'name_ru', p_data ->> 'name_en',
      p_data ->> 'description_hy', p_data ->> 'description_ru', p_data ->> 'description_en',
      (p_data ->> 'price_amd')::integer, (p_data ->> 'category_id')::uuid, (p_data ->> 'stock_quantity')::integer,
      coalesce((p_data ->> 'is_available')::boolean, true),
      coalesce((p_data ->> 'is_featured')::boolean, false),
      coalesce((p_data ->> 'is_published')::boolean, true)
    )
    returning id into v_id;
  else
    update public.products set
      slug           = p_data ->> 'slug',
      name_hy        = p_data ->> 'name_hy',
      name_ru        = p_data ->> 'name_ru',
      name_en        = p_data ->> 'name_en',
      description_hy = p_data ->> 'description_hy',
      description_ru = p_data ->> 'description_ru',
      description_en = p_data ->> 'description_en',
      price_amd      = (p_data ->> 'price_amd')::integer,
      category_id    = (p_data ->> 'category_id')::uuid,
      stock_quantity = (p_data ->> 'stock_quantity')::integer,
      is_available   = coalesce((p_data ->> 'is_available')::boolean, true),
      is_featured    = coalesce((p_data ->> 'is_featured')::boolean, false),
      is_published   = coalesce((p_data ->> 'is_published')::boolean, true)
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  end if;

  -- Images: remove dropped ones, then (re)insert the list in order.
  select coalesce(array_agg(storage_path), '{}') into v_removed
  from public.product_images
  where product_id = v_id and not (storage_path = any (coalesce(p_images, '{}')));

  delete from public.product_images where product_id = v_id;

  insert into public.product_images (product_id, storage_path, sort_order)
  select v_id, path, ord - 1
  from unnest(coalesce(p_images, '{}')) with ordinality as t(path, ord);

  -- Report only paths that no product references any more.
  select coalesce(array_agg(path), '{}') into v_removed
  from unnest(v_removed) as path
  where not exists (select 1 from public.product_images pi where pi.storage_path = path);

  return jsonb_build_object('id', v_id, 'orphaned_paths', to_jsonb(v_removed));
end;
$$;

create or replace function public.admin_delete_product(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_paths   text[];
  v_deleted uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(array_agg(storage_path), '{}') into v_paths
  from public.product_images where product_id = p_id;

  -- product_images cascade; order_items keep their snapshots (product_id → NULL).
  delete from public.products where id = p_id returning id into v_deleted;
  if v_deleted is null then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(path), '{}') into v_paths
  from unnest(v_paths) as path
  where not exists (select 1 from public.product_images pi where pi.storage_path = path);

  return jsonb_build_object('orphaned_paths', to_jsonb(v_paths));
end;
$$;

-- Returns which of the given paths are not referenced by any product
-- (used to clean up uploads that were discarded before saving).
create or replace function public.admin_unreferenced_paths(p_paths text[])
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(path), '{}')
  from unnest(p_paths) as path
  where public.is_admin()
    and not exists (select 1 from public.product_images pi where pi.storage_path = path);
$$;

revoke all on function public.admin_save_product(uuid, jsonb, text[]) from public, anon;
revoke all on function public.admin_delete_product(uuid) from public, anon;
revoke all on function public.admin_unreferenced_paths(text[]) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb, text[]) to authenticated;
grant execute on function public.admin_delete_product(uuid) to authenticated;
grant execute on function public.admin_unreferenced_paths(text[]) to authenticated;
