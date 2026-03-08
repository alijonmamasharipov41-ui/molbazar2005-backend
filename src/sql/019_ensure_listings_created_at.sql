-- Ensure listings.created_at exists (for relative time in app: "2 soat oldin")
ALTER TABLE listings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
UPDATE listings SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;
