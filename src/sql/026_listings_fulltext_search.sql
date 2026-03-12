-- Full-text search for listings (OLX-like "eng mos" qidiruv)
-- Uses 'simple' config (Uzbek/Russian mixed text friendly without stemming surprises).
-- Safe to run multiple times.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Backfill existing rows
UPDATE listings
SET search_vector =
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(product_type, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'C')
WHERE search_vector IS NULL;

-- Keep updated on insert/update
CREATE OR REPLACE FUNCTION listings_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.product_type, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listings_search_vector_update ON listings;
CREATE TRIGGER trg_listings_search_vector_update
BEFORE INSERT OR UPDATE OF title, product_type, description
ON listings
FOR EACH ROW
EXECUTE FUNCTION listings_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_listings_search_vector
ON listings
USING GIN (search_vector);

