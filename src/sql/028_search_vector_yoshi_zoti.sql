-- Qidiruvda yoshi, zoti ham ishlashi uchun (masalan: "2 yosh hisori", "arashan qo'chqor")
-- search_vector ga yoshi va zoti ustunlarini qo'shamiz

-- Qidiruvda sheva variantlari ham topilsin: arashan~aralash, xisori~hisori
CREATE OR REPLACE FUNCTION listings_search_vector_update() RETURNS trigger AS $$
DECLARE
  t text;
  pt text;
BEGIN
  t := COALESCE(NEW.title, '');
  pt := COALESCE(NEW.product_type, '');
  t := replace(replace(replace(t, 'arashan', 'aralash'), 'xisori', 'hisori'), 'qochqor', 'qo''chqor');
  pt := replace(replace(replace(pt, 'arashan', 'aralash'), 'xisori', 'hisori'), 'qochqor', 'qo''chqor');
  NEW.search_vector :=
    setweight(to_tsvector('simple', t), 'A') ||
    setweight(to_tsvector('simple', pt), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.yoshi, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.zoti, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: mavjud qatorlarni yangilash (arashan->aralash, xisori->hisori)
UPDATE listings
SET search_vector =
  setweight(to_tsvector('simple', replace(replace(replace(COALESCE(title, ''), 'arashan', 'aralash'), 'xisori', 'hisori'), 'qochqor', 'qo''chqor')), 'A') ||
  setweight(to_tsvector('simple', replace(replace(replace(COALESCE(product_type, ''), 'arashan', 'aralash'), 'xisori', 'hisori'), 'qochqor', 'qo''chqor')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(yoshi, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(zoti, '')), 'B')
WHERE id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_listings_search_vector_update ON listings;
CREATE TRIGGER trg_listings_search_vector_update
BEFORE INSERT OR UPDATE OF title, product_type, description, yoshi, zoti
ON listings
FOR EACH ROW
EXECUTE PROCEDURE listings_search_vector_update();
