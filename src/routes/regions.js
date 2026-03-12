const express = require("express");
const { query } = require("../db");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

/** GET /regions — barcha viloyatlar (14 ta) */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name FROM regions ORDER BY id ASC"
    );
    res.json({ ok: true, items: result.rows });
  } catch (err) {
    next(err);
  }
});

/** GET /districts?region_id=1 — tumannar (region_id bo'lsa shu viloyat bo'yicha) */
router.get("/districts", optionalAuth, async (req, res, next) => {
  try {
    const regionId = req.query.region_id != null && req.query.region_id !== ""
      ? parseInt(req.query.region_id, 10)
      : null;
    if (regionId != null && !Number.isNaN(regionId)) {
      const result = await query(
        "SELECT id, name, region_id FROM districts WHERE region_id = $1 ORDER BY name ASC",
        [regionId]
      );
      return res.json({ ok: true, items: result.rows });
    }
    const result = await query(
      "SELECT id, name, region_id FROM districts ORDER BY region_id ASC, name ASC"
    );
    res.json({ ok: true, items: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
