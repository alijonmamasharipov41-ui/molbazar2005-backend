const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { auth } = require("../middleware/auth");
const { destroyImagesByUrls } = require("../lib/cloudinaryHelper");

const router = express.Router();

const patchSchema = z.object({
  full_name: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  avatar_url: z.string().max(500).optional(),
});

const ME_FIELDS =
  "id, email, role, full_name, phone, avatar_url, created_at, updated_at";

const PUBLIC_FIELDS = "id, full_name, avatar_url, created_at";

router.get("/me", auth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ${ME_FIELDS} FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/** GET /api/users — faqat admin: barcha foydalanuvchilar ro'yxati */
router.get("/", auth, async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  try {
    const result = await query(
      `SELECT id, full_name, phone, role, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ ok: true, items: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch("/me", auth, async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const data = parsed.data;
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (keys.length === 0) {
      const result = await query(
        `SELECT ${ME_FIELDS} FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      return res.json({ ok: true, user: result.rows[0] });
    }

    const allowed = { full_name: true, phone: true, avatar_url: true };
    const setParts = [];
    const params = [];
    let idx = 1;
    for (const key of keys) {
      if (allowed[key]) {
        setParts.push(`${key} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }
    setParts.push(`updated_at = NOW()`);
    params.push(req.user.id);

    const result = await query(
      `UPDATE users SET ${setParts.join(", ")} WHERE id = $${idx} RETURNING ${ME_FIELDS}`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ ok: false, error: "Phone already in use" });
    }
    next(err);
  }
});

/**
 * DELETE /api/users/me — login qilgan foydalanuvchi o'z akkauntini o'chiradi.
 * Xavfsizlik: faqat auth middleware orqali req.user.id ishlatiladi (o'zini o'zi o'chiradi).
 * Ketma-ketlik: 1) Foydalanuvchiga tegishli barcha e'lon rasmlarini Cloudinary'dan o'chirish,
 * 2) users jadvalidan o'chirish (ON DELETE CASCADE orqali listings va listing_images ham o'chadi).
 */
router.delete("/me", auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 1) Foydalanuvchining barcha e'lonlaridagi rasm URL'larini olish
    const imagesResult = await query(
      `SELECT li.image_url
       FROM listing_images li
       INNER JOIN listings l ON l.id = li.listing_id
       WHERE l.user_id = $1`,
      [userId]
    );
    const urls = (imagesResult.rows || []).map((r) => r.image_url).filter(Boolean);

    // 2) Cloudinary'dan o'chirish (bitta xato bo'lsa ham qolganlar davom etadi)
    const { deleted, failed } = await destroyImagesByUrls(urls);
    if (failed > 0) {
      console.warn("[users] Cloudinary cleanup: some images could not be deleted", { deleted, failed });
    }

    // 3) Foydalanuvchini o'chirish — CASCADE orqali listings va listing_images ham o'chadi
    const deleteResult = await query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    res.status(200).json({
      ok: true,
      message: "Akkaunt o'chirildi",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const result = await query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
