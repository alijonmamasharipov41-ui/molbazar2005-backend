-- Listings ga kategoriya ustuni (categories(id) ga havola)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category_id INT REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
