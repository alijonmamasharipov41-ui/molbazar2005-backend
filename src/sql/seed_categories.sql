-- Kategoriyalar (VPS da bir marta ishlatish: sudo -u postgres psql molbozor -f .../seed_categories.sql)
-- Ilova slug lari: chorva, parandalar, baliqlar, don (= Yem), yemish
INSERT INTO categories (id, name, parent_id) VALUES
  (1, 'Chorva', NULL),
  (2, 'Parandalar', NULL),
  (3, 'Baliqlar', NULL),
  (4, 'Yem', NULL),
  (5, 'Yemish', NULL)
ON CONFLICT (id) DO NOTHING;
-- id seriyasini yangilash (keyingi INSERT lar 6 dan boshlansin)
SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));
