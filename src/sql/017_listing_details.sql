-- Chorva e'lonlari uchun: yoshi, zoti, jinsi, vazn (ilovada to'ldiriladi, to'liq saqlanadi va qaytariladi)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS yoshi TEXT DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS zoti TEXT DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS jinsi TEXT DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS vazn TEXT DEFAULT '';
