const express = require("express");
const { query } = require("../db");
const { auth } = require("../middleware/auth");
const { trackEvent } = require("../analytics");

const router = express.Router();

router.post("/:listingId", auth, async (req, res, next) => {
  try {
    const listingId = parseInt(req.params.listingId, 10);
    if (Number.isNaN(listingId)) {
      return res.status(400).json({ ok: false, error: "Invalid listing id" });
    }
    const listing = await query(
      `SELECT user_id FROM listings WHERE id = $1`,
      [listingId]
    );
    if (listing.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    const sellerId = listing.rows[0].user_id;
    const buyerId = req.user.id;
    if (sellerId === buyerId) {
      return res.status(400).json({ ok: false, error: "Cannot chat with yourself" });
    }
    const existing = await query(
      `SELECT id FROM conversations WHERE listing_id = $1 AND buyer_id = $2`,
      [listingId, buyerId]
    );
    if (existing.rows.length > 0) {
      return res.json({ ok: true, conversation_id: existing.rows[0].id });
    }
    const insert = await query(
      `INSERT INTO conversations (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [listingId, buyerId, sellerId]
    );
    const newConversationId = insert.rows[0].id;
    trackEvent({ type: "conversation_created", listingId, conversationId: newConversationId, userId: req.user.id }).catch(() => {});
    res.status(201).json({ ok: true, conversation_id: newConversationId });
  } catch (err) {
    next(err);
  }
});

router.get("/", auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM conversations c
       WHERE c.buyer_id = $1 OR c.seller_id = $1`,
      [userId]
    );
    const total = countResult.rows[0].total;

    const listResult = await query(
      `SELECT
  c.id AS conversation_id,
  COALESCE(l.title, 'Yordam markazi') AS listing_title,
  u_other.full_name AS other_user_name,
  last_msg.body AS last_message,
  last_msg.created_at AS last_message_time,
  COALESCE(unread.cnt, 0)::int AS unread_count,
  c.type AS conversation_type
FROM conversations c
LEFT JOIN listings l ON l.id = c.listing_id
INNER JOIN users u_other ON u_other.id = CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
LEFT JOIN LATERAL (
  SELECT m.body, m.created_at
  FROM messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
) last_msg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM messages m
  WHERE m.conversation_id = c.id
    AND m.sender_id != $1
    AND m.read_at IS NULL
) unread ON true
WHERE c.buyer_id = $1 OR c.seller_id = $1
ORDER BY last_msg.created_at DESC NULLS LAST
LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      ok: true,
      page,
      limit,
      total,
      items: listResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:conversationId/messages", auth, async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (Number.isNaN(conversationId)) {
      return res.status(400).json({ ok: false, error: "Invalid conversation id" });
    }
    const conv = await query(
      `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
      [conversationId]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Conversation not found" });
    }
    const { buyer_id, seller_id } = conv.rows[0];
    const userId = req.user.id;
    if (userId !== buyer_id && userId !== seller_id) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    await query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE conversation_id = $1
         AND sender_id != $2
         AND read_at IS NULL`,
      [conversationId, userId]
    );

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );
    const total = countResult.rows[0].total;

    const listResult = await query(
      `SELECT id, sender_id, body, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    res.json({
      ok: true,
      page,
      limit,
      total,
      items: listResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:conversationId/messages", auth, async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    if (Number.isNaN(conversationId)) {
      return res.status(400).json({ ok: false, error: "Invalid conversation id" });
    }
    const body = req.body && typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (!body) {
      return res.status(400).json({ ok: false, error: "body required" });
    }
    const conv = await query(
      `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
      [conversationId]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Conversation not found" });
    }
    const { buyer_id, seller_id } = conv.rows[0];
    const userId = req.user.id;
    if (userId !== buyer_id && userId !== seller_id) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, body, created_at`,
      [conversationId, userId, body]
    );
    trackEvent({ type: "message_sent", conversationId, userId: req.user.id }).catch(() => {});
    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
