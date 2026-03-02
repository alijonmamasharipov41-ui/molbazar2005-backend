const express = require("express");
const { query } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ ok: false, error: "Forbidden" });
}

/** GET /api/admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get("/overview", auth, requireAdmin, async (req, res, next) => {
  try {
    const from = req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
      ? req.query.from
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
      ? req.query.to
      : new Date().toISOString().slice(0, 10);

    const rows = await query(
      `SELECT day, listing_views, messages_sent, conversations_created, listings_created, COALESCE(app_opens, 0) AS app_opens, COALESCE(logins, 0) AS logins
       FROM analytics_daily
       WHERE day >= $1::date AND day <= $2::date
       ORDER BY day ASC`,
      [from, to]
    );

    const daily = rows.rows.map((r) => ({
      day: r.day,
      listing_views: Number(r.listing_views) || 0,
      messages_sent: Number(r.messages_sent) || 0,
      conversations_created: Number(r.conversations_created) || 0,
      listings_created: Number(r.listings_created) || 0,
      app_opens: Number(r.app_opens) || 0,
      logins: Number(r.logins) || 0,
    }));

    const totals = daily.reduce(
      (acc, d) => ({
        listing_views: acc.listing_views + d.listing_views,
        messages_sent: acc.messages_sent + d.messages_sent,
        conversations_created: acc.conversations_created + d.conversations_created,
        listings_created: acc.listings_created + d.listings_created,
        app_opens: acc.app_opens + d.app_opens,
        logins: acc.logins + d.logins,
      }),
      { listing_views: 0, messages_sent: 0, conversations_created: 0, listings_created: 0, app_opens: 0, logins: 0 }
    );

    res.json({ ok: true, from, to, totals, daily });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
