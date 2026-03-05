const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");
const { auth } = require("../middleware/auth");
const { handleVerify } = require("./otp");

const router = express.Router();

const registerSchema = z.object({
  full_name: z.string().min(1, "full_name required"),
  phone: z.string().min(1, "phone required"),
  password: z.string().min(6, "password min 6 chars"),
});

const loginSchema = z.object({
  phone: z.string().min(1, "phone required"),
  password: z.string().min(1, "password required"),
});

router.post("/register", async (req, res, next) => {
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

router.post("/login", async (req, res, next) => {
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
