-- E'lon moderatsiyasi: user qo'shadi -> pending, admin tasdiqlagach -> bozorda ko'rinadi

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

-- Migratsiyadan oldin mavjud e'lonlar bozorda ko'rinsin (bir martalik)
UPDATE listings SET status = 'approved';
