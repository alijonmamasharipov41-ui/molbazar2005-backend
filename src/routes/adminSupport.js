const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { auth, isAdmin } = require("../middleware/auth");

const router = express.Router();

const statusSchema = z.enum(["open", "closed", "resolved"]);
const replySchema = z.object({ message: z.string().min(1, "Xabar bo'sh bo'lmasin") });

const SUPPORT_SYSTEM_EMAIL = "support@molbazar.uz";

/**
 * GET /api/admin/support
 * Admin barcha shikoyatlarni user ma'lumotlari bilan oladi.
 */
router.get("/", auth, isAdmin, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT st.id, st.user_id, st.subject, st.message, st.status, st.created_at,
              u.email, u.full_name, u.phone
       FROM support_tickets st
       JOIN users u ON u.id = st.user_id
       ORDER BY st.created_at DESC`
    );

    res.json({
      ok: true,
      items: result.rows,
    });
  } catch (err) {
    console.error("[admin/support] GET / error:", err.message);
    next(err);
  }
});

/**
 * PATCH /api/admin/support/:id
 * Admin ticket statusni 'closed' yoki 'resolved' ga o'zgartiradi.
 */
router.patch("/:id", auth, isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const parsed = z.object({ status: statusSchema }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "status 'open', 'closed' yoki 'resolved' bo'lishi kerak",
      });
    }
    const { status } = parsed.data;

    const result = await query(
      `UPDATE support_tickets SET status = $1 WHERE id = $2 RETURNING id, user_id, subject, message, status, created_at`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Shikoyat topilmadi" });
    }

    res.json({ ok: true, ticket: result.rows[0] });
  } catch (err) {
    console.error("[admin/support] PATCH /:id error:", err.message);
    next(err);
  }
});

/**
 * POST /api/admin/support/:id/reply
 * Admin javob yozadi; javob support_ticket_replies ga yoziladi va foydalanuvchi Chat bo'limida ko'radi.
 */
router.post("/:id/reply", auth, isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || "Xabar kerak";
      return res.status(400).json({ ok: false, error: msg });
    }
    const { message } = parsed.data;
    const adminId = req.user.id;

    const ticketRows = await query(
      `SELECT id, user_id FROM support_tickets WHERE id = $1`,
      [id]
    );
    if (ticketRows.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Shikoyat topilmadi" });
    }
    const { user_id: ticketUserId } = ticketRows.rows[0];

    const systemUser = await query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [SUPPORT_SYSTEM_EMAIL]
    );
    if (systemUser.rows.length === 0) {
      console.error("[admin/support] support@molbazar.uz user topilmadi. Migratsiya 032 ni ishlating.");
      return res.status(500).json({ ok: false, error: "Tizim sozlamasi topilmadi" });
    }
    const supportSellerId = systemUser.rows[0].id;

    let conv = await query(
      `SELECT id FROM conversations WHERE type = 'support' AND buyer_id = $1 AND seller_id = $2 LIMIT 1`,
      [ticketUserId, supportSellerId]
    );
    let conversationId;
    if (conv.rows.length > 0) {
      conversationId = conv.rows[0].id;
    } else {
      const ins = await query(
        `INSERT INTO conversations (listing_id, buyer_id, seller_id, type)
         VALUES (NULL, $1, $2, 'support')
         RETURNING id`,
        [ticketUserId, supportSellerId]
      );
      conversationId = ins.rows[0].id;
    }

    await query(
      `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)`,
      [conversationId, adminId, message.trim()]
    );

    await query(
      `INSERT INTO support_ticket_replies (support_ticket_id, author_id, message) VALUES ($1, $2, $3)`,
      [id, adminId, message.trim()]
    );

    res.status(201).json({ ok: true, message: "Javob yuborildi; foydalanuvchi Chat bo'limida ko'radi" });
  } catch (err) {
    console.error("[admin/support] POST /:id/reply error:", err.message);
    next(err);
  }
});

/**
 * GET /api/admin/support/:id/replies
 * Shikoyat bo'yicha admin javoblarini olish.
 */
router.get("/:id/replies", auth, isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const result = await query(
      `SELECT str.id, str.author_id, str.message, str.created_at, u.full_name AS author_name
       FROM support_ticket_replies str
       JOIN users u ON u.id = str.author_id
       WHERE str.support_ticket_id = $1
       ORDER BY str.created_at ASC`,
      [id]
    );
    res.json({ ok: true, items: result.rows });
  } catch (err) {
    console.error("[admin/support] GET /:id/replies error:", err.message);
    next(err);
  }
});

/**
 * DELETE /api/admin/support/:id
 * Admin shikoyatni o'chiradi.
 */
router.delete("/:id", auth, isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const result = await query(
      `DELETE FROM support_tickets WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Shikoyat topilmadi" });
    }

    res.json({ ok: true, message: "O'chirildi" });
  } catch (err) {
    console.error("[admin/support] DELETE /:id error:", err.message);
    next(err);
  }
});

module.exports = router;
