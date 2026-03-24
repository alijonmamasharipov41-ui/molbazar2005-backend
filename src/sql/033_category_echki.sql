-- Alohida bozor kategoriyasi: Echki (ilova category_slug = echki)
INSERT INTO categories (id, name, parent_id) VALUES (6, 'Echki', NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  'categories_id_seq',
  (SELECT COALESCE(MAX(id), 1) FROM categories)
);
