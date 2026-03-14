const express = require("express");
const { z } = require("zod");
const { query, pool } = require("../db");
const { auth, optionalAuth } = require("../middleware/auth");
const { trackEvent } = require("../analytics");

const router = express.Router();

const CATEGORY_SLUGS = ["chorva", "parandalar", "baliqlar", "don", "yemish"];
const regionDistrictIdSchema = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return null;
    const n = Number(val);
    // Mobile form: tanlanmagan paytida 0 yuborilishi mumkin
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  },
  z.number().int().positive().nullable().optional()
);

const weightSchema = z.preprocess(
  (val) => (val === "" || val === undefined ? null : Number(val)),
  z.number().min(0).nullable().optional()
);

const createSchema = z.object({
  title: z.string().min(3, "title required"),
  description: z.string().optional().default(""),
  price: z.number().min(0).optional().default(0),
  category_id: z.number().int().positive().optional().nullable(),
  category_slug: z.string().optional().default(""),
  region: z.string().optional().default(""),
  district: z.string().optional().default(""),
  region_id: regionDistrictIdSchema,
  district_id: regionDistrictIdSchema,
  phone: z.string().optional().default(""),
  phone_visible: z.boolean().optional().default(false),
  product_type: z.string().optional().default(""),
  images: z.array(z.string()).max(10).optional(),
  yoshi: z.string().optional().default(""),
  zoti: z.string().optional().default(""),
  jinsi: z.string().optional().default(""),
  vazn: z.string().optional().default(""),
  weight: weightSchema,
  unit: z.string().optional().nullable(),
});

/** PUT /listings/:id — only validates and updates provided fields */
const updateSchema = z
  .object({
    title: z.string().min(1, "title required").optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    region: z.string().optional(),
    district: z.string().optional(),
    region_id: regionDistrictIdSchema,
    district_id: regionDistrictIdSchema,
    phone: z.string().optional(),
    phone_visible: z.boolean().optional(),
    product_type: z.string().optional(),
    category_id: z.number().int().positive().nullable().optional(),
    category_slug: z.string().optional(),
    status: z.enum(["approved", "rejected"]).optional(),
    yoshi: z.string().optional(),
    zoti: z.string().optional(),
    jinsi: z.string().optional(),
    vazn: z.string().optional(),
    weight: weightSchema,
    unit: z.string().optional().nullable(),
    images: z.array(z.string()).max(10).optional(),
  })
  .strict();

const SORT_MAP = {
  new: "l.created_at DESC",
  price_asc: "l.price ASC",
  price_desc: "l.price DESC",
  id_asc: "l.id ASC",
  id_desc: "l.id DESC",
};

/** When returning listings to API: hide phone unless phone_visible is true. */
function maskPhoneForResponse(listing) {
  if (listing && !listing.phone_visible) {
    listing.phone = null;
  }
  return listing;
}

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const sortKey = req.query.sort && SORT_MAP[req.query.sort] ? req.query.sort : "new";
    const orderBy = SORT_MAP[sortKey];

    const search = (req.query.search ?? req.query.query)?.trim() || null;
    // Qidiruvni normalizatsiya: sheva/yozuv farqlari (qo'zli~qozli, qo'y~qoy, hisori~xisori)
    const normalizeSearch = (s) => {
      let t = String(s || "").toLowerCase();
      t = t.replace(/[’‘ʻʼ`´]/g, "'"); // apostrof variantlari
      t = t.replace(/o'/g, "o'").replace(/g'/g, "g'"); // safe no-op, readability
      t = t.replace(/\s+/g, " ").trim();
      // eng ko'p uchraydigan sheva/harf almashishlar
      t = t.replace(/\bqoy\b/g, "qo'y");
      t = t.replace(/\bqozli\b/g, "qo'zli");
      t = t.replace(/\bqochqor\b/g, "qo'chqor");
      t = t.replace(/\bxisori\b/g, "hisori");
      t = t.replace(/\barashan\b/g, "aralash");
      t = t.replace(/\bzot\b/g, "zoti");
      return t;
    };
    const searchNorm = search ? normalizeSearch(search) : null;
    // Full-text: plainto_tsquery wildcard ishlatmaydi (tez va "eng mos" uchun)
    // ILIKE fallback: % va _ wildcard; foydalanuvchi matnini literal qilish uchun ekranlash
    const escapeLike = (s) => String(s).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const searchLike = searchNorm ? `%${escapeLike(searchNorm)}%` : null;
    const regionId = req.query.region_id != null && req.query.region_id !== "" ? parseInt(req.query.region_id, 10) : null;
    const districtId = req.query.district_id != null && req.query.district_id !== "" ? parseInt(req.query.district_id, 10) : null;
    const rid = !Number.isNaN(regionId) ? regionId : null;
    const did = !Number.isNaN(districtId) ? districtId : null;

    // GIN index ishlashi: bitta branch faqat search_vector @@ query; fallback = search_vector IS NULL qatorlar uchun ILIKE.
    // Parametr indekslarini qo'lda boshqaramiz: agar search bo'lmasa, $1 va $2 ishlatilmaydi.
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (searchNorm) {
      conditions.push(
        `((l.search_vector @@ plainto_tsquery('simple', $${paramIndex})) OR ` +
          `(l.search_vector IS NULL AND (l.title ILIKE $${paramIndex + 1} OR COALESCE(l.description,'') ILIKE $${paramIndex + 1} OR COALESCE(l.product_type,'') ILIKE $${paramIndex + 1})))`
      );
      params.push(searchNorm, searchLike);
      paramIndex += 2;
    } else {
      conditions.push("true");
    }

    conditions.push(`(l.region_id = $${paramIndex} OR ($${paramIndex}::integer IS NULL))`);
    params.push(rid);
    paramIndex++;

    conditions.push(`(l.district_id = $${paramIndex} OR ($${paramIndex}::integer IS NULL))`);
    params.push(did);
    paramIndex++;

    if (req.query.category_id != null && req.query.category_id !== "") {
      const catId = parseInt(req.query.category_id, 10);
      if (!Number.isNaN(catId)) {
        const slugFromQuery = req.query.category_slug && String(req.query.category_slug).trim()
          ? String(req.query.category_slug).trim().toLowerCase()
          : null;
        if (slugFromQuery && CATEGORY_SLUGS.includes(slugFromQuery)) {
          conditions.push(`(l.category_id = $${paramIndex} OR LOWER(TRIM(l.category_slug)) = $${paramIndex + 1})`);
          params.push(catId, slugFromQuery);
          paramIndex += 2;
        } else {
          conditions.push(`(l.category_id = $${paramIndex} OR LOWER(TRIM(l.category_slug)) = (SELECT LOWER(TRIM(name)) FROM categories WHERE id = $${paramIndex}))`);
          params.push(catId);
          paramIndex++;
        }
      }
    } else if (req.query.category_slug && String(req.query.category_slug).trim()) {
      const slug = String(req.query.category_slug).trim().toLowerCase();
      if (CATEGORY_SLUGS.includes(slug)) {
        conditions.push(`LOWER(TRIM(l.category_slug)) = $${paramIndex}`);
        params.push(slug);
        paramIndex++;
      }
    }
    if (req.query.region && String(req.query.region).trim()) {
      conditions.push(`l.region = $${paramIndex}`);
      params.push(String(req.query.region).trim());
      paramIndex++;
    }
    if (req.query.district && String(req.query.district).trim()) {
      conditions.push(`l.district = $${paramIndex}`);
      params.push(String(req.query.district).trim());
      paramIndex++;
    }
    if (req.query.min_price != null && req.query.min_price !== "") {
      const minPrice = parseFloat(req.query.min_price);
      if (!Number.isNaN(minPrice)) {
        conditions.push(`l.price >= $${paramIndex}`);
        params.push(minPrice);
        paramIndex++;
      }
    }
    if (req.query.max_price != null && req.query.max_price !== "") {
      const maxPrice = parseFloat(req.query.max_price);
      if (!Number.isNaN(maxPrice)) {
        conditions.push(`l.price <= $${paramIndex}`);
        params.push(maxPrice);
        paramIndex++;
      }
    }
    if (req.query.user_id) {
      const uid = parseInt(req.query.user_id, 10);
      if (!Number.isNaN(uid)) {
        conditions.push(`l.user_id = $${paramIndex}`);
        params.push(uid);
        paramIndex++;
      }
    }
    // Bozor: faqat tasdiqlangan. Admin yoki o'z e'lonlari (user_id=o'z id) barcha status.
    const isAdmin = req.user && req.user.role === "admin";
    const ownUserId = req.query.user_id && req.user && String(req.user.id) === String(req.query.user_id);
    if (!isAdmin && !ownUserId) {
      conditions.push(`l.status = $${paramIndex}::text`);
      params.push("approved");
      paramIndex++;
    }
    // Admin: status bo'yicha filtrlash (approved, pending, rejected)
    if (isAdmin && req.query.status && String(req.query.status).trim()) {
      const statusVal = String(req.query.status).trim().toLowerCase();
      if (["approved", "pending", "rejected"].includes(statusVal)) {
        conditions.push(`l.status = $${paramIndex}::text`);
        params.push(statusVal);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    // Qidiruv bo'lsa: ts_rank (relevancy) keyin created_at; yo'q bo'lsa: sort param (new, price_asc, ...)
    const orderByClause = searchNorm
      ? `ts_rank(l.search_vector, plainto_tsquery('simple', $1)) DESC NULLS LAST, l.created_at DESC`
      : orderBy;
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
        FROM listings l
        ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    // LATERAL: bitta qator per listing (GROUP BY + JSON_AGG o'rniga — 10x tez)
    let limitIndex, offsetIndex, listParams;
    let favoritesLateral = "";
    let isFavoriteSelect = "false AS is_favorite";

    if (userId != null) {
      favoritesLateral = `LEFT JOIN LATERAL (SELECT true AS is_favorite FROM favorites f WHERE f.listing_id = l.id AND f.user_id = $${paramIndex}::integer LIMIT 1) fav ON true`;
      isFavoriteSelect = "COALESCE(fav.is_favorite, false) AS is_favorite";
      limitIndex = paramIndex + 2;
      offsetIndex = paramIndex + 3;
      listParams = [...params, userId, limit, offset];
    } else {
      limitIndex = paramIndex;
      offsetIndex = paramIndex + 1;
      listParams = [...params, limit, offset];
    }

    const listResult = await query(
      `SELECT
  l.id,
  l.user_id,
  l.category_id,
  c.name AS category_name,
  l.title,
  l.description,
  l.price,
  l.region,
  l.district,
  r.name AS region_name,
  d.name AS district_name,
  l.phone,
  l.phone_visible,
  l.product_type,
  l.status,
  l.category_slug,
  l.created_at,
  l.yoshi,
  l.zoti,
  l.jinsi,
  l.vazn,
  l.weight,
  l.unit,
  u.full_name AS seller_name,
  COALESCE(img.images, '[]') AS images,
  ${isFavoriteSelect}
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN users u ON u.id = l.user_id
LEFT JOIN regions r ON r.id = l.region_id
LEFT JOIN districts d ON d.id = l.district_id
LEFT JOIN LATERAL (
  SELECT COALESCE(JSON_AGG(li.image_url) FILTER (WHERE li.image_url IS NOT NULL), '[]') AS images
  FROM listing_images li WHERE li.listing_id = l.id
) img ON true
${favoritesLateral}
${whereClause}
ORDER BY ${orderByClause}
LIMIT $${limitIndex}::integer OFFSET $${offsetIndex}::integer`,
      listParams
    );

    const items = listResult.rows.map((row) => {
      const r = maskPhoneForResponse(row);
      if (r && (typeof r.price === "string" || r.price == null)) {
        r.price = Number(r.price) || 0;
      }
      return r;
    });
    res.json({
      ok: true,
      page,
      limit,
      total,
      items,
    });
  } catch (err) {
    next(err);
  }
});

// OLX-style autocomplete: qidiruv so'ziga mos sarlavhalar (top 10)
router.get("/autocomplete", optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q ?? req.query.query ?? "").trim();
    if (!q || q.length < 2) {
      return res.json({ ok: true, suggestions: [] });
    }
    const searchNorm = q.toLowerCase().replace(/\s+/g, " ").trim();
    const searchLike = `%${searchNorm}%`;
    const result = await query(
      `SELECT l.id, l.title
       FROM listings l
       WHERE l.status = 'approved'
         AND (l.search_vector @@ plainto_tsquery('simple', $1)
              OR l.title ILIKE $2
              OR COALESCE(l.product_type,'') ILIKE $2)
       ORDER BY l.created_at DESC
       LIMIT 10`,
      [searchNorm, searchLike]
    );
    res.json({ ok: true, suggestions: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    let favoritesJoin = "";
    let isFavoriteSelect = "false AS is_favorite";
    let params = [id];

    if (userId != null) {
      favoritesJoin = `LEFT JOIN favorites f
       ON f.listing_id = l.id
       AND f.user_id = $2`;
      isFavoriteSelect = "MAX(f.id) IS NOT NULL AS is_favorite";
      params = [id, userId];
    }

    const result = await query(
      `SELECT
  l.*,
  r.name AS region_name,
  d.name AS district_name,
  c.name AS category_name,
  u.full_name AS seller_name,
  COALESCE(
    JSON_AGG(li.image_url)
      FILTER (WHERE li.image_url IS NOT NULL),
    '[]'
  ) AS images,
  ${isFavoriteSelect}
FROM listings l
LEFT JOIN regions r ON l.region_id = r.id
LEFT JOIN districts d ON l.district_id = d.id
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN users u ON u.id = l.user_id
LEFT JOIN listing_images li ON li.listing_id = l.id
${favoritesJoin}
WHERE l.id = $1
GROUP BY l.id, c.name, u.full_name, r.name, d.name`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    const item = result.rows[0];
    const isAdminView = req.user && req.user.role === "admin";
    const isOwner = req.user && (Number(req.user.id) === Number(item.user_id) || String(req.user.id) === String(item.user_id));
    // Tasdiqlanmagan e'lon: faqat admin yoki egasi ko'radi (tahrirlash uchun)
    if (!isAdminView && !isOwner && item.status !== "approved") {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    // Telefonni faqat ega yoki admin ko'rsin; boshqalar uchun phone_visible bo'lsagina
    if (!isOwner && !isAdminView) {
      maskPhoneForResponse(item);
    }
    const listingId = parseInt(req.params.id, 10);
    trackEvent({ type: "listing_view", listingId, userId: req.user ? req.user.id : null }).catch(() => {});
    res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const check = await query(
      "SELECT user_id FROM listings WHERE id = $1",
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    const ownerId = check.rows[0].user_id;
    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.id === ownerId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const raw = {};
    if (req.body.title !== undefined) raw.title = req.body.title;
    if (req.body.description !== undefined) raw.description = req.body.description;
    if (req.body.price !== undefined && req.body.price !== null) raw.price = Number(req.body.price);
    if (req.body.region !== undefined) raw.region = req.body.region;
    if (req.body.district !== undefined) raw.district = req.body.district;
    if (req.body.region_id !== undefined) raw.region_id = req.body.region_id === null || req.body.region_id === "" ? null : parseInt(req.body.region_id, 10);
    if (req.body.district_id !== undefined) raw.district_id = req.body.district_id === null || req.body.district_id === "" ? null : parseInt(req.body.district_id, 10);
    if (req.body.phone !== undefined) raw.phone = req.body.phone;
    if (req.body.phone_visible !== undefined) raw.phone_visible = req.body.phone_visible;
    if (req.body.product_type !== undefined) raw.product_type = req.body.product_type;
    if (req.body.category_id !== undefined) {
      raw.category_id = req.body.category_id === null || req.body.category_id === "" ? null : parseInt(req.body.category_id, 10);
    }
    if (req.body.category_slug !== undefined) raw.category_slug = req.body.category_slug;
    if (req.body.status !== undefined) raw.status = req.body.status;
    if (req.body.yoshi !== undefined) raw.yoshi = req.body.yoshi;
    if (req.body.zoti !== undefined) raw.zoti = req.body.zoti;
    if (req.body.jinsi !== undefined) raw.jinsi = req.body.jinsi;
    if (req.body.vazn !== undefined) raw.vazn = req.body.vazn;
    if (req.body.weight !== undefined) raw.weight = req.body.weight == null || req.body.weight === "" ? null : Number(req.body.weight);
    if (req.body.unit !== undefined) raw.unit = req.body.unit == null || req.body.unit === "" ? null : req.body.unit;
    if (req.body.images !== undefined) raw.images = Array.isArray(req.body.images) ? req.body.images : [];

    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }

    const data = parsed.data;
    const allowedColumns = ["title", "description", "price", "region", "district", "region_id", "district_id", "weight", "unit", "phone", "phone_visible", "product_type", "category_id", "category_slug", "yoshi", "zoti", "jinsi", "vazn"];
    const setParts = [];
    const setParams = [];
    let paramIdx = 1;

    for (const key of allowedColumns) {
      if (data[key] !== undefined) {
        setParts.push(`${key} = $${paramIdx}`);
        setParams.push(data[key]);
        paramIdx++;
      }
    }
    if (isAdmin && data.status !== undefined) {
      setParts.push(`status = $${paramIdx}`);
      setParams.push(data.status);
      paramIdx++;
    }

    const wantsImagesUpdate = data.images !== undefined;
    if (setParts.length === 0 && !wantsImagesUpdate) {
      return res.status(400).json({ ok: false, error: "No fields to update" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (setParts.length > 0) {
        setParams.push(id);
        await client.query(
          `UPDATE listings SET ${setParts.join(", ")} WHERE id = $${paramIdx}`,
          setParams
        );
      }

      if (wantsImagesUpdate) {
        await client.query(`DELETE FROM listing_images WHERE listing_id = $1`, [id]);
        const images = Array.isArray(data.images) ? data.images : [];
        for (const imageUrl of images) {
          const url = String(imageUrl || "").trim();
          if (!url) continue;
          await client.query(
            `INSERT INTO listing_images (listing_id, image_url) VALUES ($1, $2)`,
            [id, url]
          );
        }
      }

      if (isAdmin && (data.status === "approved" || data.status === "rejected")) {
        const auditAction = data.status === "approved" ? "listing_approved" : "listing_rejected";
        const ip = req.ip || req.get("x-forwarded-for") || null;
        const ua = req.get("user-agent") || "";
        await client.query(
          `INSERT INTO admin_audit_logs (user_id, action, ip_address, user_agent) VALUES ($1, $2, $3, $4)`,
          [req.user.id, `${auditAction}#${id}`, ip, ua]
        );
      }

      const result = await client.query(
        `SELECT
  l.*,
  c.name AS category_name,
  u.full_name AS seller_name,
  COALESCE(
    JSON_AGG(li.image_url)
      FILTER (WHERE li.image_url IS NOT NULL),
    '[]'
  ) AS images
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN users u ON u.id = l.user_id
LEFT JOIN listing_images li ON li.listing_id = l.id
WHERE l.id = $1
GROUP BY l.id, c.name, u.full_name`,
        [id]
      );

      await client.query("COMMIT");
      res.json({ ok: true, item: maskPhoneForResponse(result.rows[0]) });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.post("/", auth, async (req, res, next) => {
  try {
    const regionIdRaw = req.body.region_id;
    const districtIdRaw = req.body.district_id;
    const parsed = createSchema.safeParse({
      ...req.body,
      price: req.body.price != null ? Number(req.body.price) : 0,
      category_id:
        req.body.category_id != null ? parseInt(req.body.category_id, 10) : null,
      region_id: regionIdRaw == null || regionIdRaw === "" ? null : parseInt(regionIdRaw, 10),
      district_id: districtIdRaw == null || districtIdRaw === "" ? null : parseInt(districtIdRaw, 10),
      images: Array.isArray(req.body.images) ? req.body.images : undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { title, description, price, category_id, category_slug, region, district, region_id, district_id, weight, unit, phone, phone_visible, product_type, images, yoshi, zoti, jinsi, vazn } = parsed.data;
    const client = await pool.connect();
    const slug = (category_slug && CATEGORY_SLUGS.includes(String(category_slug).toLowerCase()))
      ? String(category_slug).toLowerCase()
      : "";
    try {
      await client.query("BEGIN");

      const listingResult = await client.query(
        `INSERT INTO listings (user_id, category_id, category_slug, title, description, price, region, district, region_id, district_id, weight, unit, phone, phone_visible, product_type, yoshi, zoti, jinsi, vazn) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id`,
        [
          req.user.id,
          category_id || null,
          slug,
          title,
          description || "",
          price,
          region || "",
          district || "",
          region_id || null,
          district_id || null,
          weight ?? null,
          unit ?? null,
          phone || "",
          !!phone_visible,
          product_type || "",
          (yoshi || "").toString(),
          (zoti || "").toString(),
          (jinsi || "").toString(),
          (vazn || "").toString(),
        ]
      );
      const listingId = listingResult.rows[0].id;

      if (images && images.length > 0) {
        for (const imageUrl of images) {
          await client.query(
            `INSERT INTO listing_images (listing_id, image_url) VALUES ($1, $2)`,
            [listingId, imageUrl]
          );
        }
      }

      const fullListing = await client.query(
        `SELECT
  l.id,
  l.user_id,
  l.category_id,
  c.name AS category_name,
  l.title,
  l.description,
  l.price,
  l.region,
  l.district,
  l.phone,
  l.phone_visible,
  l.product_type,
  l.status,
  l.category_slug,
  l.created_at,
  l.yoshi,
  l.zoti,
  l.jinsi,
  l.vazn,
  COALESCE(
    JSON_AGG(li.image_url)
      FILTER (WHERE li.image_url IS NOT NULL),
    '[]'
  ) AS images
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN listing_images li ON li.listing_id = l.id
WHERE l.id = $1
GROUP BY l.id, c.name`,
        [listingId]
      );

      await client.query("COMMIT");
      trackEvent({ type: "listing_created", listingId, userId: req.user.id }).catch(() => {});

      res.status(201).json({
        ok: true,
        item: maskPhoneForResponse(fullListing.rows[0]),
        message: "Sizning e'loningiz tekshiruv jarayoniga yuborildi. Administrator tomonidan tasdiqlangach, u platformada ko'rinadi.",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", auth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const check = await query("SELECT user_id FROM listings WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }
    const ownerId = check.rows[0].user_id;
    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.id === ownerId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    if (isAdmin) {
      const ip = req.ip || req.get("x-forwarded-for") || null;
      const ua = req.get("user-agent") || "";
      await query(
        `INSERT INTO admin_audit_logs (user_id, action, ip_address, user_agent) VALUES ($1, $2, $3, $4)`,
        [req.user.id, `listing_deleted#${id}`, ip, ua]
      );
    }
    await query("DELETE FROM listings WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
