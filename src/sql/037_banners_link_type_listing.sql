-- link_type: boshqa e'longa yo'naltirish (listing). Eski CHECK nomi farq qilishi mumkin — barcha link_type tekshiruvlarini almashtiramiz.

DO $$
DECLARE
  conrec RECORD;
BEGIN
  FOR conrec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'banners'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%link_type%'
  LOOP
    EXECUTE format('ALTER TABLE banners DROP CONSTRAINT %I', conrec.conname);
  END LOOP;
END $$;

ALTER TABLE banners ADD CONSTRAINT banners_link_type_check
  CHECK (link_type IN ('category_filter', 'article', 'external_link', 'listing'));
