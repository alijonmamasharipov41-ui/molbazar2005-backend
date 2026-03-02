-- =========================================
-- 011_otp_attempt_limit.sql
-- Adds brute-force protection to OTP verify
-- =========================================

ALTER TABLE otp_codes
ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE otp_codes
ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMP NULL;
