-- Kategoriya slug: chorva, parandalar, baliqlar, don, yemish (ilova va admin filtri uchun)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category_slug TEXT DEFAULT '';
