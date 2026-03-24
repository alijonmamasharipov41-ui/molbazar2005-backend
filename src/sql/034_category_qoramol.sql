-- Alohida kategoriya: Qoramol (ilova category_slug = qoramol)
INSERT INTO categories (id, name, parent_id) VALUES (7, 'Qoramol', NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  'categories_id_seq',
  (SELECT COALESCE(MAX(id), 1) FROM categories)
);
