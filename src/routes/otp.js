const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");
const { sendOtpEmail } = require("../services/resend");
const { trackEvent } = require("../analytics");

const router = express.Router();

const emailSchema = z.string().email("Invalid email").max(255);
const requestSchema = z.object({ email: emailSchema });
const verifySchema = z.object({
  email: emailSchema,
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must be digits only"),
});

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** POST /api/otp/request — send OTP to email */
router.post("/request", async (req, res, next) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Rate limit: max 3 OTP requests per email per minute (brute-force / abuse prevention)
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
      const msg =
        sendResult.error || "Email yuborilmadi";
      return res.status(500).json({
        ok: false,
        error: msg,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Shared handler: verify OTP (email + code), return JWT. Used by both POST /api/otp/verify and POST /api/auth/verify. */
async function handleVerify(req, res, next) {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { email, code } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const codeHash = hashCode(code);

    const otpRow = await query(
      `SELECT id, code_hash, expires_at, COALESCE(attempts, 0) AS attempts, blocked_until FROM otp_codes
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (otpRow.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Kod topilmadi yoki muddati o'tgan. Yangi kod so'rab, 10 daqiqa ichida kiriting.",
      });
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
      return res.status(400).json({ ok: false, error: "Code expired" });
    }

    if (row.code_hash !== codeHash) {
      const newAttempts = (Number(row.attempts) || 0) + 1;
      await query(
        `UPDATE otp_codes SET attempts = $1, blocked_until = CASE WHEN $1 >= 10 THEN NOW() + INTERVAL '15 minutes' ELSE blocked_until END WHERE id = $2`,
        [newAttempts, row.id]
      );
      return res.status(400).json({ ok: false, error: "Kod noto'g'ri" });
    }

    await query("DELETE FROM otp_codes WHERE email = $1", [normalizedEmail]);

    let userResult = await query(
      `SELECT id, email, role, full_name, phone, avatar_url, created_at, COALESCE(token_version, 0) AS token_version FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    } else {
      const fullName = normalizedEmail.split("@")[0] || "Foydalanuvchi";
      const insertResult = await query(
        `INSERT INTO users (email, full_name, role) VALUES ($1, $2, $3)
         RETURNING id, email, role, full_name, phone, avatar_url, created_at, COALESCE(token_version, 0) AS token_version`,
        [normalizedEmail, fullName, "user"]
      );
      user = insertResult.rows[0];
    }

    const isAdminPanel = req.headers["x-admin-panel"] === "true" || req.body?.adminPanel === true;
    if (isAdminPanel && user.role !== "admin") {
      return res.status(403).json({
        ok: false,
        error: "Access denied. Admin only.",
      });
    }

    const tokenVersion = Number(user.token_version) || 0;
    const expiresIn = isAdminPanel && user.role === "admin" ? "12h" : "30d";
    const token = jwt.sign(
      { id: user.id, role: user.role || "user", tokenVersion },
      JWT_SECRET,
      { expiresIn }
    );

    await trackEvent({ type: "user_login", userId: user.id });

    if (isAdminPanel && user.role === "admin") {
      const ip = req.ip || req.get("x-forwarded-for") || null;
      const userAgent = req.get("user-agent") || "";
      await query(
        `INSERT INTO admin_audit_logs (user_id, action, ip_address, user_agent)
         VALUES ($1, 'admin_login', $2, $3)`,
        [user.id, ip, userAgent]
      );
    }

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

router.post("/verify", handleVerify);

module.exports = router;
module.exports.handleVerify = handleVerify;
