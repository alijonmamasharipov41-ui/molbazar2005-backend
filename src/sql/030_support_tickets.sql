-- =========================================
-- 030_support_tickets.sql
-- Yordam markazi (Support Center): foydalanuvchi shikoyatlari.
-- =========================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     VARCHAR(500) NOT NULL,
  message     TEXT NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

COMMENT ON TABLE support_tickets IS 'Yordam markazi shikoyatlari (support tickets)';
