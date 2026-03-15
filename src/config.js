// .env is loaded once in server.js (entry point)
const APP_NAME = "Molbazar2005 Backend";
const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
/** Resend: OTP email. Set RESEND_API_KEY and APP_FROM_EMAIL (e.g. "Molbazar <no-reply@molbazar.uz>") in .env */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_FROM_EMAIL = process.env.APP_FROM_EMAIL || "Molbazar <onboarding@resend.dev>";
/** Banner/upload rasmlari uchun asosiy URL (relative yo‘llarni to‘liq qilish). Masalan: https://molbazar.uz */
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.API_BASE_URL || "https://molbazar.uz";

/** Admin emaillar (vergul bilan). Yangi ro'yxatdan o'tganda shu email bo'lsa role=admin beriladi. */
const ADMIN_EMAILS_RAW = process.env.ADMIN_EMAILS || "";
const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  ? ADMIN_EMAILS_RAW.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Set it in .env");
}
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Set it in .env");
}

module.exports = {
  APP_NAME,
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  RESEND_API_KEY,
  APP_FROM_EMAIL,
  PUBLIC_URL,
  ADMIN_EMAILS,
};
