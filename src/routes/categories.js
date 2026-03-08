const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { auth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

/** Bosh sahifada banner tagida ko'rsatiladigan kategoriyalar (bozor bo'limi tepasida). "Bozor" so'zi nomda yo'q. */
const HOME_CATEGORIES = [
  { slug: "chorva", name: "Chorva", icon: "🐄" },
  { slug: "parandalar", name: "Paranda", icon: "🐔" },
  { slug: "baliqlar", name: "Baliq", icon: "🐟" },
  { slug: "yemish", name: "Yem-yemish", icon: "🥬" },
];

const createSchema = z.object({
  name: z.string().min(1, "name required"),
  parent_id: z.number().int().positive().optional().nullable(),
});

/** GET /api/categories/home — mobil: banner tagida kategoriya ikonkalari uchun (chorva, paranda, baliq, yem-yemish) */
router.get("/home", optionalAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, items: HOME_CATEGORIES });
  } catch (err) {
    next(err);
  }
});

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name, parent_id, created_at FROM categories ORDER BY id ASC"
    );
    res.json({ ok: true, items: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post("/", auth, async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  try {
    const parsed = createSchema.safeParse({
      ...req.body,
      parent_id:
        req.body.parent_id != null ? parseInt(req.body.parent_id, 10) : null,
    });
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { name, parent_id } = parsed.data;
    const result = await query(
      "INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id, name, parent_id, created_at",
      [name, parent_id || null]
    );
    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
