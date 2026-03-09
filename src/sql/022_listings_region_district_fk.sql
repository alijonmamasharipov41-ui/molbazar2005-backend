-- Listings ga viloyat/tuman ID lar (region, district matn ustunlari saqlanadi — mavjud ma'lumotlar uchun)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS region_id INT REFERENCES regions(id) ON DELETE SET NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS district_id INT REFERENCES districts(id) ON DELETE SET NULL;

-- Tezkor filtrlash: viloyat + tuman bo'yicha
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(region_id, district_id);
