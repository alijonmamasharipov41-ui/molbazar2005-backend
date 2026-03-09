-- Listinglar uchun muhim indekslar (GET /api/listings filtrlari va JOIN tezligi)
-- user_id: profil "e'lonlarim", admin user_id bo'yicha, JOIN users
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
-- status: bozor faqat status = 'approved'
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
-- category_slug: ilova kategoriya bo'yicha filter (chorva, don, ...)
CREATE INDEX IF NOT EXISTS idx_listings_category_slug ON listings(category_slug);
-- district: viloyat + tuman filter
CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district);
