const express = require("express");
const { query } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/:listingId", auth, async (req, res, next) => {
  try {
    const listingId = parseInt(req.params.listingId, 10);
    if (Number.isNaN(listingId)) {
      return res.status(400).json({ ok: false, error: "Invalid listing id" });
    }
    await query(
      `INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [req.user.id, listingId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:listingId", auth, async (req, res, next) => {
  try {
    const listingId = parseInt(req.params.listingId, 10);
    if (Number.isNaN(listingId)) {
      return res.status(400).json({ ok: false, error: "Invalid listing id" });
    }
    await query(
      `DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2`,
      [req.user.id, listingId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/", auth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM favorites WHERE user_id = $1`,
      [req.user.id]
    );
    const total = countResult.rows[0].total;

    const listResult = await query(
      `SELECT
  l.id,
  l.user_id,
  l.category_id,
  c.name AS category_name,
  l.title,
  l.description,
  l.price,
  l.region,
  l.district,
  l.created_at,
  COALESCE(
    JSON_AGG(li.image_url)
      FILTER (WHERE li.image_url IS NOT NULL),
    '[]'
  ) AS images
FROM favorites f
INNER JOIN listings l ON l.id = f.listing_id
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN listing_images li ON li.listing_id = l.id
WHERE f.user_id = $1
GROUP BY l.id, c.name
ORDER BY MAX(f.created_at) DESC
LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
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

module.exports = router;
