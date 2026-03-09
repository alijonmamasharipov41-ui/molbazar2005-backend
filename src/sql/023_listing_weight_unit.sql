-- Vazn (miqdori) va birlik (kg, tonna, press) e'lonlar uchun
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS weight DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20);

-- Tekshirish: eng so'nggi e'londa title, weight, unit
-- SELECT title, weight, unit FROM listings ORDER BY created_at DESC LIMIT 1;
