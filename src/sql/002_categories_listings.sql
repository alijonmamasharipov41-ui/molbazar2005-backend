-- Categories + Listings schema (category_id, indexes)

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INT REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS category_id INT REFERENCES categories(id);

UPDATE listings SET price = 0 WHERE price IS NULL;
ALTER TABLE listings ALTER COLUMN price SET NOT NULL;
ALTER TABLE listings ALTER COLUMN price SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
