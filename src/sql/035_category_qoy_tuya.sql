-- Ilova: category_slug = qoy | tuya (listings jadvalida matn sifatida)
-- Admin / katalog bilan moslash uchun categories qatorlari
INSERT INTO categories (id, name, parent_id) VALUES
  (8, 'Qo''y', NULL),
  (9, 'Tuya', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));
