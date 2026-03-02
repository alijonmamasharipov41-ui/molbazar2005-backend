-- =========================================
-- 012_analytics_events.sql
-- Analytics events for views, messages, conversations, listings
-- =========================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('listing_view', 'message_sent', 'conversation_created', 'listing_created')),
  listing_id INTEGER NULL REFERENCES listings(id) ON DELETE SET NULL,
  conversation_id INTEGER NULL REFERENCES conversations(id) ON DELETE SET NULL,
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ae_type_created_at ON analytics_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_listing_created_at ON analytics_events (listing_id, created_at DESC) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ae_conv_created_at ON analytics_events (conversation_id, created_at DESC) WHERE conversation_id IS NOT NULL;
