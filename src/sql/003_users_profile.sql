-- Users / Profile — add email, avatar_url, updated_at (users table from 001)

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE users SET email = phone WHERE email IS NULL OR email = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE users ALTER COLUMN updated_at SET NOT NULL;
