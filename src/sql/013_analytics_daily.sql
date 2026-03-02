-- =========================================
-- 013_analytics_daily.sql
-- Daily aggregated analytics
-- =========================================

CREATE TABLE IF NOT EXISTS analytics_daily (
  day DATE PRIMARY KEY,
  listing_views INTEGER NOT NULL DEFAULT 0,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  conversations_created INTEGER NOT NULL DEFAULT 0,
  listings_created INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
