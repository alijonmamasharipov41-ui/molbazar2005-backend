const express = require("express");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs"); // Parol hash: register/login uchun; kelajakda OTP-user uchun parol qo'shilsa ham bcrypt ishlatish
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");
const { auth } = require("../middleware/auth");
const { handleVerify } = require("./otp");

const router = express.Router();

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
  full_name: z.string().min(1, "full_name required"),
  phone: z.string().min(1, "phone required"),
  password: passwordField,
});

const loginSchema = z.object({
  phone: z.string().min(1, "phone required"),
  password: z.string().min(1, "password required"),
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
    const password_hash = await bcrypt.hash(password, 10);
    await query(
      "INSERT INTO users (full_name, phone, password_hash, role) VALUES ($1, $2, $3, $4)",
      [full_name, phone, password_hash, "user"]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ ok: false, error: "Phone already registered" });
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
    const result = await query(
      "SELECT id, password_hash, role, COALESCE(token_version, 0) AS token_version FROM users WHERE phone = $1",
      [phone]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Invalid phone or password" });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: "Invalid phone or password" });
    }
    const token = jwt.sign(
      { id: user.id, role: user.role, tokenVersion: Number(user.token_version) || 0 },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
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
