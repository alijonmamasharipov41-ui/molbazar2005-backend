-- =========================================
-- 014_analytics_app_login.sql
-- Adds app_open and user_login analytics
-- =========================================

ALTER TABLE analytics_daily
ADD COLUMN IF NOT EXISTS app_opens INTEGER NOT NULL DEFAULT 0;

ALTER TABLE analytics_daily
ADD COLUMN IF NOT EXISTS logins INTEGER NOT NULL DEFAULT 0;

ALTER TABLE analytics_events
DROP CONSTRAINT IF EXISTS analytics_events_event_type_check;

ALTER TABLE analytics_events
ADD CONSTRAINT analytics_events_event_type_check
CHECK (event_type IN (
  'listing_view',
  'message_sent',
  'conversation_created',
  'listing_created',
  'app_open',
  'user_login'
));
