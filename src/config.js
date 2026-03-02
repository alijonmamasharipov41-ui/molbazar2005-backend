// .env is loaded once in server.js (entry point)
const APP_NAME = "Molbazar2005 Backend";
const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
/** Resend: OTP email. Set RESEND_API_KEY and APP_FROM_EMAIL (e.g. "Molbozor <no-reply@yourdomain.com>") in .env */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_FROM_EMAIL = process.env.APP_FROM_EMAIL || "Molbozor <onboarding@resend.dev>";

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
};
