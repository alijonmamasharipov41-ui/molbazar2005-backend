const express = require("express");
const { trackAppOpenByClient, trackEvent } = require("../analytics");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/analytics/app-open
 * Body: { clientId: string } — mobil qurilma UUID (bir marta yaratiladi, AsyncStorage).
 * Bir qurilma + bir kun = bitta noyob qator; qayta kirishlar session_opens ni oshiradi.
 * optionalAuth: token bo‘lsa user_id bog‘lanadi (login qilganlar alohida statistikada).
 */
router.post("/app-open", optionalAuth, async (req, res, next) => {
  try {
    const clientId = req.body?.clientId ?? req.body?.client_id;
    const userId = req.user?.id != null ? Number(req.user.id) : null;
    const uid = Number.isFinite(userId) ? userId : null;

    if (!clientId || typeof clientId !== "string") {
      /** Eski mobil versiyalar (body yo‘q) — faqat jami ochilishlar (analytics_daily) */
      await trackEvent({ type: "app_open", userId: uid });
      return res.json({ ok: true, legacy: true });
    }

    await trackAppOpenByClient(clientId, uid);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
