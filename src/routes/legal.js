/**
 * Ochiq huquqiy hujjatlar — faqat GET.
 * lang noto'g'ri yoki yo'q bo'lsa ham har doim o'zbekcha kontent, 200 OK.
 */
const express = require("express");

const router = express.Router();
const CACHE_SEC = 3600;

const FALLBACK_TERMS = {
  title: "Foydalanuvchi shartlari",
  html: "<p><strong>Molbazar.</strong> Hujjat matni vaqtincha yuklanmadi. Keyinroq urinib ko'ring yoki qo'llab-quvvatlashga murojaat qiling.</p>",
};

const FALLBACK_PRIVACY = {
  title: "Maxfiylik siyosati",
  html: "<p><strong>Molbazar.</strong> Maxfiylik siyosati vaqtincha yuklanmadi. Keyinroq urinib ko'ring.</p>",
};

/** Express ba'zan query ni massiv qiladi — xavfsiz uzgatirish */
function normalizeLang(query) {
  const raw = query.lang;
  let s = "uz";
  if (Array.isArray(raw)) {
    s = raw[0] != null ? String(raw[0]) : "uz";
  } else if (raw != null && String(raw).trim() !== "") {
    s = String(raw);
  }
  s = s.toLowerCase().trim().slice(0, 10);
  const allowed = new Set(["uz", "ru", "en"]);
  if (!allowed.has(s)) return "uz";
  return s;
}

function loadDoc(kind) {
  if (kind === "terms") {
    return require("../legal/terms.uz");
  }
  return require("../legal/privacy.uz");
}

/**
 * Har doim 200 + { title, html } (ixtiyoriy ok).
 * Ichki xato bo'lsa — konsolga log, fallback matn.
 */
function sendLegalJson(res, payload) {
  res.set("Cache-Control", `public, max-age=${CACHE_SEC}, stale-while-revalidate=86400`);
  res.status(200).json({
    ok: true,
    title: payload.title,
    html: payload.html,
  });
}

router.get("/terms", (req, res) => {
  const lang = normalizeLang(req.query);
  try {
    if (lang !== "uz") {
      console.info("[legal] /terms lang=%s — hozircha faqat uz kontent qaytariladi", lang);
    }
    const doc = loadDoc("terms");
    const title = typeof doc.title === "string" ? doc.title : FALLBACK_TERMS.title;
    const html = typeof doc.html === "string" ? doc.html : "";
    if (!html.trim()) {
      console.warn("[legal] /terms: bo'sh html, fallback ishlatildi");
      return sendLegalJson(res, FALLBACK_TERMS);
    }
    return sendLegalJson(res, { title, html });
  } catch (err) {
    console.error("[legal] /terms xato:", err && err.stack ? err.stack : err);
    return sendLegalJson(res, FALLBACK_TERMS);
  }
});

router.get("/privacy", (req, res) => {
  const lang = normalizeLang(req.query);
  try {
    if (lang !== "uz") {
      console.info("[legal] /privacy lang=%s — hozircha faqat uz kontent qaytariladi", lang);
    }
    const doc = loadDoc("privacy");
    const title = typeof doc.title === "string" ? doc.title : FALLBACK_PRIVACY.title;
    const html = typeof doc.html === "string" ? doc.html : "";
    if (!html.trim()) {
      console.warn("[legal] /privacy: bo'sh html, fallback ishlatildi");
      return sendLegalJson(res, FALLBACK_PRIVACY);
    }
    return sendLegalJson(res, { title, html });
  } catch (err) {
    console.error("[legal] /privacy xato:", err && err.stack ? err.stack : err);
    return sendLegalJson(res, FALLBACK_PRIVACY);
  }
});

module.exports = router;
