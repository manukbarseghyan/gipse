-- =============================================================================
-- DEMO DATA — for local development only.
--
-- `supabase start` / `supabase db reset` load this file automatically into the
-- LOCAL database. It is never applied to a hosted project by `supabase db push`.
-- Every demo row uses a slug starting with "demo-" so it can be removed safely
-- with supabase/demo/remove_demo_data.sql.
-- =============================================================================

insert into public.categories (slug, name_hy, name_ru, name_en, sort_order) values
  ('demo-figurines', 'Արձանիկներ', 'Фигурки', 'Figurines', 1),
  ('demo-toys',      'Խաղալիքներ', 'Игрушки', 'Toys', 2),
  ('demo-gifts',     'Նվերներ',    'Подарки', 'Gifts', 3)
on conflict (slug) do nothing;

insert into public.products (slug, name_hy, name_ru, name_en, description_hy, description_ru, description_en, price_amd, category_id, is_available, is_featured, stock_quantity)
select v.slug, v.name_hy, v.name_ru, v.name_en, v.d_hy, v.d_ru, v.d_en, v.price, c.id, v.available, v.featured, v.stock
from (values
  ('demo-angel', 'Հրեշտակ (դեմո)', 'Ангел (демо)', 'Angel (demo)',
   'Դեմո ապրանք։ Փոքրիկ գիպսե հրեշտակ՝ ձեռքով ներկված։', 'Демо-товар. Маленький гипсовый ангел ручной росписи.', 'Demo product. A small hand-painted gypsum angel.',
   4500, 'demo-figurines', true, true, null::integer),
  ('demo-cat', 'Կատու (դեմո)', 'Кошка (демо)', 'Cat (demo)',
   'Դեմո ապրանք։ Գիպսե կատու՝ պաստելային գույներով։', 'Демо-товар. Гипсовая кошка в пастельных тонах.', 'Demo product. A gypsum cat in pastel colours.',
   3500, 'demo-figurines', true, true, 3),
  ('demo-bear', 'Արջուկ (դեմո)', 'Мишка (демо)', 'Teddy bear (demo)',
   'Դեմո ապրանք։ Գիպսե արջուկ՝ ներկելու համար։', 'Демо-товар. Гипсовый мишка для раскрашивания.', 'Demo product. A gypsum teddy bear to paint yourself.',
   2500, 'demo-toys', true, false, null),
  ('demo-heart', 'Սիրտ (դեմո)', 'Сердце (демо)', 'Heart (demo)',
   'Դեմո ապրանք։ Դեկորատիվ գիպսե սիրտ։', 'Демо-товар. Декоративное гипсовое сердце.', 'Demo product. A decorative gypsum heart.',
   3000, 'demo-gifts', true, true, null),
  ('demo-gift-box', 'Նվերի տուփ (դեմո)', 'Подарочный набор (демо)', 'Gift box (demo)',
   'Դեմո ապրանք։ Երեք արձանիկ՝ նվերի տուփում։', 'Демо-товар. Три фигурки в подарочной коробке.', 'Demo product. Three figurines in a gift box.',
   12000, 'demo-gifts', true, true, null),
  ('demo-sold-out', 'Լուսին (դեմո)', 'Луна (демо)', 'Moon (demo)',
   'Դեմո ապրանք՝ անհասանելի կարգավիճակով։', 'Демо-товар в статусе «нет в наличии».', 'Demo product shown as unavailable.',
   4000, 'demo-figurines', false, false, null)
) as v(slug, name_hy, name_ru, name_en, d_hy, d_ru, d_en, price, category_slug, available, featured, stock)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

update public.shop_settings
   set delivery_fee_amd = 1000, free_delivery_threshold_amd = 20000
 where id = 1;
