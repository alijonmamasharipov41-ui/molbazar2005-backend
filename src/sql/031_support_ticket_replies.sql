-- =========================================
-- 031_support_ticket_replies.sql
-- Admin javoblari va ularni chatga yuborish uchun.
-- =========================================

CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id                SERIAL PRIMARY KEY,
  support_ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket ON support_ticket_replies(support_ticket_id);
