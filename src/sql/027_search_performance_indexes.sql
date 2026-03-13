-- OLX-level search: pg_trgm (fuzzy/ILIKE tezligi), composite va partial indexlar
-- 10x tezlik: GIN faqat search_vector da ishlashi uchun route'da WHERE bitta branch (search_vector @@ query)

-- 1) Fuzzy / ILIKE fallback uchun (search_vector bo'sh qatorlar yoki trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) title, description, product_type bo'yicha trigram GIN — ILIKE va similarity() tez
CREATE INDEX IF NOT EXISTS idx_listings_title_gin_trgm ON listings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_description_gin_trgm ON listings USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_product_type_gin_trgm ON listings USING gin (product_type gin_trgm_ops);

-- 3) Bozor ro'yxati: status = 'approved' eng ko'p so'raladi — partial index
CREATE INDEX IF NOT EXISTS idx_listings_approved_created
  ON listings (created_at DESC)
  WHERE status = 'approved';

-- 4) Filtrlar birga: category_slug + approved (kategoriya bo'yicha sahifa)
CREATE INDEX IF NOT EXISTS idx_listings_approved_category_slug
  ON listings (category_slug, created_at DESC)
  WHERE status = 'approved';

-- 5) Hudud filtri: region_id + district_id (approved)
CREATE INDEX IF NOT EXISTS idx_listings_approved_location
  ON listings (region_id, district_id, created_at DESC)
  WHERE status = 'approved';

-- 6) Narx tartibi (price_asc / price_desc) — approved
CREATE INDEX IF NOT EXISTS idx_listings_approved_price_asc
  ON listings (price ASC, id ASC)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_listings_approved_price_desc
  ON listings (price DESC NULLS LAST, id DESC)
  WHERE status = 'approved';
