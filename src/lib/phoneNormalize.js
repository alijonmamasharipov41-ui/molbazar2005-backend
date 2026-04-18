/**
 * O‘zbekiston mobil raqamini DB uchun yagona format: 998 + 9 raqam (jami 12 raqam).
 * @param {string} raw
 * @returns {{ ok: true, phone: string } | { ok: false, error: string }}
 */
function normalizeUzbekPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Telefon raqamini kiriting" };
  }
  let d = digits.replace(/^0+/, "");
  if (d.startsWith("998")) {
    if (d.length !== 12) {
      return { ok: false, error: "Telefon raqami to'liq emas (12 raqam: 998...)" };
    }
  } else if (d.length === 9) {
    d = `998${d}`;
  } else {
    return { ok: false, error: "Telefon raqami noto'g'ri (+998 yoki 9 raqam)" };
  }
  if (!/^998\d{9}$/.test(d)) {
    return { ok: false, error: "Telefon raqami noto'g'ri" };
  }
  return { ok: true, phone: d };
}

module.exports = { normalizeUzbekPhone };
