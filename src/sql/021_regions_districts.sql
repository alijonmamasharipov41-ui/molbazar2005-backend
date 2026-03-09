-- Viloyatlar (dropdown va filtrlash uchun)
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- Tumanlar (viloyatga bog'liq)
CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  region_id INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_districts_region_id ON districts(region_id);
