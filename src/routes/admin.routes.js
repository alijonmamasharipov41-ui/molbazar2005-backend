const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");
const { sendOtpEmail } = require("../services/resend");
const { trackEvent } = require("../analytics");

const router = express.Router();

const emailSchema = z.string().email("Email noto'g'ri").max(255);
const requestSchema = z.object({ email: emailSchema });
const verifySchema = z.object({
  email: emailSchema,
  code: z.string().length(6, "Kod 6 ta raqam bo'lishi kerak").regex(/^\d+$/, "Kod faqat raqamlardan iborat bo'lishi kerak"),
});

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function getAdminByEmail(normalizedEmail) {
  const r = await query(
    `SELECT id, email, role, full_name, phone, avatar_url, created_at, COALESCE(token_version, 0) AS token_version
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );
  if (r.rows.length === 0) return null;
  const user = r.rows[0];
  if ((user.role || "user") !== "admin") return null;
  return user;
}

/** POST /api/admin/request-code — admin emailga 6 xonali kod yuborish */
router.post("/request-code", async (req, res, next) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "So'rov noto'g'ri",
      });
    }
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const admin = await getAdminByEmail(normalizedEmail);
    if (!admin) {
      return res.status(403).json({
        ok: false,
        error: "Admin topilmadi yoki ruxsat yo'q",
      });
    }

    // Rate limit: max 3 OTP requests per email per minute
    const rateLimitResult = await query(
      `SELECT COUNT(*) AS cnt FROM otp_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
      [normalizedEmail]
    );
    const recentCount = parseInt(rateLimitResult.rows[0]?.cnt ?? "0", 10);
    if (recentCount >= 3) {
      return res.status(429).json({
        ok: false,
        error: "Juda ko'p so'rov. 1 daqiqadan keyin qayta urinib ko'ring.",
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [normalizedEmail, codeHash, expiresAt]
    );

    const sendResult = await sendOtpEmail(normalizedEmail, code);
    if (!sendResult.ok) {
      return res.status(500).json({
        ok: false,
        error: sendResult.error || "Email yuborilmadi",
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/verify-code — admin OTP kodini tasdiqlash, JWT qaytarish */
router.post("/verify-code", async (req, res, next) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "So'rov noto'g'ri",
      });
    }
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const code = parsed.data.code;

    const admin = await getAdminByEmail(normalizedEmail);
    if (!admin) {
      return res.status(403).json({
        ok: false,
        error: "Admin topilmadi yoki ruxsat yo'q",
      });
    }

    const otpRow = await query(
      `SELECT id, code_hash, expires_at, COALESCE(attempts, 0) AS attempts, blocked_until
       FROM otp_codes
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (otpRow.rows.length === 0) {
      return res.status(400).json({ ok: false, error: "Kod topilmadi yoki muddati o'tgan" });
    }

    const row = otpRow.rows[0];
    if (row.blocked_until && new Date(row.blocked_until) > new Date()) {
      return res.status(429).json({
        ok: false,
        error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring.",
      });
    }

    if (new Date(row.expires_at) < new Date()) {
      await query("DELETE FROM otp_codes WHERE email = $1", [normalizedEmail]);
      return res.status(400).json({ ok: false, error: "Kod topilmadi yoki muddati o'tgan" });
    }

    const codeHash = hashCode(code);
    if (row.code_hash !== codeHash) {
      const newAttempts = (Number(row.attempts) || 0) + 1;
      await query(
        `UPDATE otp_codes
         SET attempts = $1,
             blocked_until = CASE WHEN $1 >= 10 THEN NOW() + INTERVAL '15 minutes' ELSE blocked_until END
         WHERE id = $2`,
        [newAttempts, row.id]
      );
      return res.status(400).json({ ok: false, error: "Kod noto'g'ri" });
    }

    await query("DELETE FROM otp_codes WHERE email = $1", [normalizedEmail]);

    const tokenVersion = Number(admin.token_version) || 0;
    const token = jwt.sign(
      { id: admin.id, role: "admin", tokenVersion },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    await trackEvent({ type: "user_login", userId: admin.id }).catch(() => {});
    const ip = req.ip || req.get("x-forwarded-for") || null;
    const userAgent = req.get("user-agent") || "";
    await query(
      `INSERT INTO admin_audit_logs (user_id, action, ip_address, user_agent)
       VALUES ($1, 'admin_login', $2, $3)`,
      [admin.id, ip, userAgent]
    ).catch(() => {});

    res.json({
      ok: true,
      token,
      user: {
        id: admin.id,
        email: admin.email,
        role: "admin",
        full_name: admin.full_name,
        phone: admin.phone,
        avatar_url: admin.avatar_url,
        created_at: admin.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

