-- Removes demo products and categories (slugs starting with "demo-").
-- Safe to run on production: real products are untouched, and past orders keep
-- their item snapshots (order_items.product_id becomes NULL on delete).
-- Run in Supabase Dashboard → SQL Editor.

begin;
delete from public.products   where slug like 'demo-%';
delete from public.categories where slug like 'demo-%';
commit;
