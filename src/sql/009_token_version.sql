-- =========================================
-- 009_token_version.sql
-- JWT token versioning (server-side invalidation on logout)
-- Adds token_version column to users table
-- =========================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
