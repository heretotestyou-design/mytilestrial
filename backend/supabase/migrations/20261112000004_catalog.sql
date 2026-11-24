-- =============================================================================
-- MyTilesTrial · Catalog reference data (safe to re-run)
-- Prices in paise. Change these any time; the website and API read them live.
-- =============================================================================

insert into public.credit_packs (id, name, description, credits, bonus_credits, price_paise, is_featured, sort_order) values
  ('starter',  'Starter',  'For homeowners and small projects.',        25,  0,   49900, false, 1),
  ('studio',   'Studio',   'For designers and growing showrooms.',      90,  10, 149900, true,  2),
  ('showroom', 'Showroom', 'For high-volume showrooms and dealers.',    320, 80, 499900, false, 3)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  credits = excluded.credits,
  bonus_credits = excluded.bonus_credits,
  price_paise = excluded.price_paise,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;

insert into public.generation_costs (type, label, description, credits, sort_order) values
  ('standard', 'Standard render', '1080p photorealistic preview',    1, 1),
  ('hd',       'HD render',       '2K render with refined lighting', 2, 2),
  ('ultra',    'Ultra render',    '4K render or 360° view',          4, 3)
on conflict (type) do update set
  label = excluded.label,
  description = excluded.description,
  credits = excluded.credits,
  sort_order = excluded.sort_order;
