-- Banners: admin boshqaruvi, mobil feed'da ko'rsatish

CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  placement TEXT DEFAULT 'home' CHECK (placement IN ('home', 'categories', 'listing')),
  type TEXT DEFAULT 'hero' CHECK (type IN ('hero', 'sidebar')),
  link_type TEXT DEFAULT 'external_link' CHECK (link_type IN ('category_filter', 'article', 'external_link')),
  end_date DATE,
  show_after_index INT DEFAULT 0,
  priority INT DEFAULT 1,
  views INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_placement ON banners(placement);
CREATE INDEX IF NOT EXISTS idx_banners_priority ON banners(priority);
