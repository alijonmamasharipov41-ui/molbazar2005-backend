-- =========================================
-- 029_user_listing_cascade.sql
-- Akkaunt o'chirishda CASCADE: user o'chganda uning listings va listing_images o'chishi.
-- 001 va 004 da CASCADE allaqachon bor bo'lishi mumkin; bu migration eski bazalarda
-- CASCADE ni ta'minlash uchun (constraint nomi turli bo'lsa ham ishlaydi).
-- =========================================

-- listings.user_id -> users(id) ON DELETE CASCADE
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'listings' AND c.contype = 'f'
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'user_id' AND a.attnum = ANY(c.conkey));
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE listings DROP CONSTRAINT %I', conname);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE listings
  ADD CONSTRAINT listings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- listing_images.listing_id -> listings(id) ON DELETE CASCADE
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'listing_images' AND c.contype = 'f'
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'listing_id' AND a.attnum = ANY(c.conkey));
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE listing_images DROP CONSTRAINT %I', conname);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE listing_images
  ADD CONSTRAINT listing_images_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
