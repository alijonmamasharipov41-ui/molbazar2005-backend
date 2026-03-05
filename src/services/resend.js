const { RESEND_API_KEY, APP_FROM_EMAIL } = require("../config");

let resend = null;
if (RESEND_API_KEY && String(RESEND_API_KEY).trim()) {
  try {
    const { Resend } = require("resend");
    resend = new Resend(RESEND_API_KEY);
  } catch (_) {
    // resend package not installed or invalid
  }
}

/**
 * Send OTP code email via Resend.
 * @param {string} email - Recipient email
 * @param {string} code - 6-digit plain code (will be shown in email)
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
async function sendOtpEmail(email, code) {
  if (!resend) {
    return {
      ok: false,
      error: "Email xizmati sozlanmagan. Serverda RESEND_API_KEY o'rnating.",
    };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: APP_FROM_EMAIL,
      to: email,
      subject: "Molbozor tasdiqlash kodi",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Tasdiqlash kodi</h2>
          <p>Sizning tasdiqlash kodingiz:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0ea5e9;">${code}</p>
          <p style="color: #64748b; font-size: 14px;">Kod 10 daqiqa amal qiladi.</p>
        </div>
      `,
    });
    if (error) {
      const msg = error.message || "Email yuborilmadi";
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    const msg = err?.message || "Email yuborilmadi";
    return { ok: false, error: msg };
  }
}

module.exports = { sendOtpEmail };
