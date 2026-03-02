const express = require("express");
const { trackEvent } = require("../analytics");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

/** POST /api/analytics/app-open — track app open (optionalAuth: guest or logged-in) */
router.post("/app-open", optionalAuth, async (req, res, next) => {
  try {
    await trackEvent({ type: "app_open", userId: req.user ? req.user.id : null });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
