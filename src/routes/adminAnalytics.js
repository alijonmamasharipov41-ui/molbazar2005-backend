const express = require("express");
const { query } = require("../db");
const { auth } = require("../middleware/auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ ok: false, error: "Forbidden" });
}

function eachDayUtc(fromStr, toStr) {
  const days = [];
  const d = new Date(fromStr + "T12:00:00.000Z");
  const end = new Date(toStr + "T12:00:00.000Z");
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** GET /api/admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get("/overview", auth, requireAdmin, async (req, res, next) => {
  try {
    const from =
      req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
        ? req.query.from
        : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to =
      req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
        ? req.query.to
        : new Date().toISOString().slice(0, 10);

    const [dailyRows, appDailyRows, appPeriod, monthlyRows, userCounts] = await Promise.all([
      query(
        `SELECT day::text AS day, listing_views, messages_sent, conversations_created, listings_created,
                COALESCE(app_opens, 0) AS app_opens_legacy, COALESCE(logins, 0) AS logins
         FROM analytics_daily
         WHERE day >= $1::date AND day <= $2::date
         ORDER BY day ASC`,
        [from, to]
      ),
      query(
        `SELECT day::text AS day,
                COUNT(*)::int AS app_unique_devices,
                COALESCE(SUM(session_opens), 0)::bigint AS app_session_opens,
                COUNT(*) FILTER (WHERE user_id IS NULL)::int AS app_devices_guest,
                COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int AS app_devices_logged
         FROM analytics_app_client_day
         WHERE day >= $1::date AND day <= $2::date
         GROUP BY day
         ORDER BY day ASC`,
        [from, to]
      ),
      query(
        `SELECT
           COUNT(DISTINCT client_id)::int AS unique_devices,
           COALESCE(SUM(session_opens), 0)::bigint AS session_opens
         FROM analytics_app_client_day
         WHERE day >= $1::date AND day <= $2::date`,
        [from, to]
      ),
      query(
        `SELECT
           to_char(date_trunc('month', day), 'YYYY-MM') AS month_key,
           COUNT(DISTINCT client_id)::int AS unique_devices,
           COALESCE(SUM(session_opens), 0)::bigint AS session_opens
         FROM analytics_app_client_day
         WHERE day >= $1::date AND day <= $2::date
         GROUP BY date_trunc('month', day)
         ORDER BY date_trunc('month', day) ASC`,
        [from, to]
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
           COUNT(*) FILTER (WHERE role IS DISTINCT FROM 'admin')::int AS app_users
         FROM users`
      ),
    ]);

    const dailyMap = new Map(
      dailyRows.rows.map((r) => [
        r.day,
        {
          listing_views: Number(r.listing_views) || 0,
          messages_sent: Number(r.messages_sent) || 0,
          conversations_created: Number(r.conversations_created) || 0,
          listings_created: Number(r.listings_created) || 0,
          app_opens_legacy: Number(r.app_opens_legacy) || 0,
          logins: Number(r.logins) || 0,
        },
      ])
    );

    const appMap = new Map(
      appDailyRows.rows.map((r) => [
        r.day,
        {
          app_unique_devices: Number(r.app_unique_devices) || 0,
          app_session_opens: Number(r.app_session_opens) || 0,
          app_devices_guest: Number(r.app_devices_guest) || 0,
          app_devices_logged: Number(r.app_devices_logged) || 0,
        },
      ])
    );

    const allDays = eachDayUtc(from, to);
    const daily = allDays.map((day) => {
      const d = dailyMap.get(day) ?? {
        listing_views: 0,
        messages_sent: 0,
        conversations_created: 0,
        listings_created: 0,
        app_opens_legacy: 0,
        logins: 0,
      };
      const a = appMap.get(day) ?? {
        app_unique_devices: 0,
        app_session_opens: 0,
        app_devices_guest: 0,
        app_devices_logged: 0,
      };
      return {
        day,
        listing_views: d.listing_views,
        messages_sent: d.messages_sent,
        conversations_created: d.conversations_created,
        listings_created: d.listings_created,
        app_opens_legacy: d.app_opens_legacy,
        logins: d.logins,
        app_unique_devices: a.app_unique_devices,
        app_session_opens: a.app_session_opens,
        app_devices_guest: a.app_devices_guest,
        app_devices_logged: a.app_devices_logged,
      };
    });

    const p = appPeriod.rows[0] || {};
    const uc = userCounts.rows[0] || {};

    const totals = daily.reduce(
      (acc, row) => ({
        listing_views: acc.listing_views + row.listing_views,
        messages_sent: acc.messages_sent + row.messages_sent,
        conversations_created: acc.conversations_created + row.conversations_created,
        listings_created: acc.listings_created + row.listings_created,
        app_opens_legacy: acc.app_opens_legacy + row.app_opens_legacy,
        logins: acc.logins + row.logins,
      }),
      {
        listing_views: 0,
        messages_sent: 0,
        conversations_created: 0,
        listings_created: 0,
        app_opens_legacy: 0,
        logins: 0,
      }
    );

    const monthly = monthlyRows.rows.map((r) => ({
      month: r.month_key,
      unique_devices: Number(r.unique_devices) || 0,
      session_opens: Number(r.session_opens) || 0,
    }));

    res.json({
      ok: true,
      from,
      to,
      totals: {
        ...totals,
        app_unique_devices: Number(p.unique_devices) || 0,
        app_session_opens: Number(p.session_opens) || 0,
        users_app: Number(uc.app_users) || 0,
        users_admin: Number(uc.admins) || 0,
      },
      daily,
      monthly,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
