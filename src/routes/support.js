const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

const createTicketSchema = z.object({
  subject: z.string().min(1, "Mavzu bo'sh bo'lmasin").max(500),
  message: z.string().min(1, "Xabar bo'sh bo'lmasin"),
});

/**
 * POST /api/support
 * Foydalanuvchi yordam markaziga xabar (ticket) yuboradi. Auth shart.
 */
router.post("/", auth, async (req, res, next) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || "So'rov noto'g'ri";
      return res.status(400).json({ ok: false, error: msg });
    }
    const { subject, message } = parsed.data;
    const userId = req.user.id;

    const result = await query(
      `INSERT INTO support_tickets (user_id, subject, message, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, user_id, subject, message, status, created_at`,
      [userId, subject.trim(), message.trim()]
    );

    const ticket = result.rows[0];
    res.status(201).json({ ok: true, ticket });
  } catch (err) {
    console.error("[support] POST / error:", err.message);
    next(err);
  }
});

module.exports = router;
