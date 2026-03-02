const { query } = require("./db");

const EVENT_TYPES = new Set([
  "listing_view",
  "message_sent",
  "conversation_created",
  "listing_created",
  "app_open",
  "user_login",
]);

/**
 * Track an analytics event: insert into analytics_events and upsert daily aggregates.
 * @param {{ type: string, listingId?: number, conversationId?: number, userId?: number }} opts
 */
async function trackEvent(opts) {
  const { type, listingId, conversationId, userId } = opts;
  if (!type || !EVENT_TYPES.has(type)) return;

  try {
    await query(
      `INSERT INTO analytics_events (event_type, listing_id, conversation_id, user_id)
       VALUES ($1, $2, $3, $4)`,
      [type, listingId ?? null, conversationId ?? null, userId ?? null]
    );

    const today = new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO analytics_daily (day, listing_views, messages_sent, conversations_created, listings_created, app_opens, logins, updated_at)
       VALUES (
         $1::date,
         CASE WHEN $2 = 'listing_view' THEN 1 ELSE 0 END,
         CASE WHEN $2 = 'message_sent' THEN 1 ELSE 0 END,
         CASE WHEN $2 = 'conversation_created' THEN 1 ELSE 0 END,
         CASE WHEN $2 = 'listing_created' THEN 1 ELSE 0 END,
         CASE WHEN $2 = 'app_open' THEN 1 ELSE 0 END,
         CASE WHEN $2 = 'user_login' THEN 1 ELSE 0 END,
         NOW()
       )
       ON CONFLICT (day) DO UPDATE SET
         listing_views = analytics_daily.listing_views + (CASE WHEN $2 = 'listing_view' THEN 1 ELSE 0 END),
         messages_sent = analytics_daily.messages_sent + (CASE WHEN $2 = 'message_sent' THEN 1 ELSE 0 END),
         conversations_created = analytics_daily.conversations_created + (CASE WHEN $2 = 'conversation_created' THEN 1 ELSE 0 END),
         listings_created = analytics_daily.listings_created + (CASE WHEN $2 = 'listing_created' THEN 1 ELSE 0 END),
         app_opens = analytics_daily.app_opens + (CASE WHEN $2 = 'app_open' THEN 1 ELSE 0 END),
         logins = analytics_daily.logins + (CASE WHEN $2 = 'user_login' THEN 1 ELSE 0 END),
         updated_at = NOW()`,
      [today, type]
    );
  } catch (err) {
    // non-fatal: log and continue
    console.error("[analytics] trackEvent error:", err.message);
  }
}

module.exports = { trackEvent };
