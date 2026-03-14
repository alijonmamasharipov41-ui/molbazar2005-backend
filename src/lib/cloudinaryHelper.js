/**
 * Cloudinary yordamchi moduli: URL dan public_id ajratish va rasm o'chirish.
 * Listing rasmlarini tozalashda (akkaunt o'chirish, tahrirlash) ishlatiladi.
 */

const cloudinary = require("./cloudinary");

/**
 * Cloudinary delivery URL dan public_id ni ajratib oladi.
 * Format: https://res.cloudinary.com/<cloud>/image/upload/[v<ver>/]<public_id>.<ext>
 *
 * @param {string} url - Cloudinary to'liq URL (secure_url)
 * @returns {string|null} - public_id yoki null (URL Cloudinary emas bo'lsa)
 */
function getPublicIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const uploadIdx = trimmed.indexOf("/upload/");
  if (uploadIdx === -1) return null;
  const afterUpload = trimmed.slice(uploadIdx + "/upload/".length);
  // Versiyani olib tashlash: v1234567890/
  const withoutVersion = afterUpload.replace(/^v\d+\//, "");
  // Fayl kengaytmasini olib tashlash (.jpg, .png, .webp va h.k.)
  const lastDot = withoutVersion.lastIndexOf(".");
  const publicId = lastDot > 0 ? withoutVersion.slice(0, lastDot) : withoutVersion;
  return publicId || null;
}

/**
 * Bitta rasmni Cloudinary'dan o'chiradi. Xato bo'lsa log qiladi, exception otmaydi.
 *
 * @param {string} publicId - Cloudinary public_id
 * @param {object} [options] - { resource_type: 'image' } (default)
 * @returns {Promise<boolean>} - muvaffaqiyatli o'chirilgan bo'lsa true
 */
async function destroyImage(publicId, options = {}) {
  if (!publicId || typeof publicId !== "string") return false;
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: options.resource_type || "image",
    });
    return result.result === "ok" || result.result === "not found";
  } catch (err) {
    console.error("[cloudinaryHelper] destroy error for public_id:", publicId, err.message);
    return false;
  }
}

/**
 * Bir nechta URL lar uchun Cloudinary'dan o'chirish. Bitta xato bo'lsa ham qolganlar davom etadi.
 *
 * @param {string[]} urls - Cloudinary URL lar ro'yxati
 * @returns {Promise<{ deleted: number, failed: number }>}
 */
async function destroyImagesByUrls(urls) {
  const list = Array.isArray(urls) ? urls : [];
  let deleted = 0;
  let failed = 0;
  for (const url of list) {
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
      failed++;
      continue;
    }
    const ok = await destroyImage(publicId);
    if (ok) deleted++;
    else failed++;
  }
  return { deleted, failed };
}

module.exports = {
  getPublicIdFromUrl,
  destroyImage,
  destroyImagesByUrls,
};
