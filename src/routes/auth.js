const express = require("express");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs"); // Parol hash: register/login uchun; kelajakda OTP-user uchun parol qo'shilsa ham bcrypt ishlatish
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");
const { auth } = require("../middleware/auth");
const { handleVerify } = require("./otp");
const { normalizeUzbekPhone } = require("../lib/phoneNormalize");

const router = express.Router();

function signUserToken(userRow) {
  return jwt.sign(
    {
      id: userRow.id,
      role: userRow.role,
      tokenVersion: Number(userRow.token_version) || 0,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

/** Telefon + parol: bruteforsni yengillashtirish (IP bo'yicha) */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      error: "Juda ko'p kirish urinishi. 15 daqiqadan keyin qayta urinib ko'ring.",
    });
  },
});

/** Ro'yxatdan o'tish spamini cheklash */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      error: "Juda ko'p ro'yxatdan o'tish urinishi. 1 soatdan keyin qayta urinib ko'ring.",
    });
  },
});

const passwordField = z
  .string()
  .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak")
  .max(128, "Parol juda uzun (maksimum 128 belgi)")
  .refine((p) => /\p{L}/u.test(p), {
    message: "Parolda kamida bitta harf bo'lishi kerak",
  })
  .refine((p) => /\d/.test(p), {
    message: "Parolda kamida bitta raqam bo'lishi kerak",
  });

const registerSchema = z.object({
  full_name: z.string().min(2, "Ism kamida 2 belgi").max(120, "Ism juda uzun"),
  phone: z.string().min(1, "Telefon kiriting"),
  password: passwordField,
});

const loginSchema = z.object({
  phone: z.string().min(1, "Telefon kiriting"),
  password: z.string().min(1, "Parol kiriting"),
});

router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { full_name, phone, password } = parsed.data;
    const norm = normalizeUzbekPhone(phone);
    if (!norm.ok) {
      return res.status(400).json({ ok: false, error: norm.error });
    }
    const dup = await query(
      `SELECT 1 FROM users WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1 LIMIT 1`,
      [norm.phone]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ ok: false, error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const ins = await query(
      `INSERT INTO users (full_name, phone, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, role, COALESCE(token_version, 0) AS token_version`,
      [full_name.trim(), norm.phone, password_hash, "user"]
    );
    const row = ins.rows[0];
    const token = signUserToken(row);
    res.status(201).json({ ok: true, token });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ ok: false, error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan" });
    }
    next(err);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { phone, password } = parsed.data;
    const norm = normalizeUzbekPhone(phone);
    if (!norm.ok) {
      return res.status(400).json({ ok: false, error: norm.error });
    }
    const result = await query(
      `SELECT id, password_hash, role, COALESCE(token_version, 0) AS token_version
       FROM users
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1`,
      [norm.phone]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Telefon yoki parol noto'g'ri" });
    }
    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({
        ok: false,
        error: "Bu akkaunt email orqali ochilgan. Email bilan kirishdan foydalaning.",
      });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: "Telefon yoki parol noto'g'ri" });
    }
    const token = signUserToken(user);
    res.json({ ok: true, token });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/verify — OTP verification (email + code), returns token. Same behavior as /api/otp/verify. */
router.post("/verify", handleVerify);

/** POST /api/auth/logout — increment token_version to invalidate all tokens for current user */
router.post("/logout", auth, async (req, res, next) => {
  try {
    await query(
      "UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1",
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
