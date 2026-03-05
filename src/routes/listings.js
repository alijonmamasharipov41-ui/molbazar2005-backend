const express = require("express");
const { z } = require("zod");
const { query, pool } = require("../db");
const { auth, optionalAuth } = require("../middleware/auth");
const { trackEvent } = require("../analytics");

const router = express.Router();

const createSchema = z.object({
  title: z.string().min(1, "title required"),
  description: z.string().optional().default(""),
  price: z.number().min(0).optional().default(0),
  category_id: z.number().int().positive().optional().nullable(),
  region: z.string().optional().default(""),
  district: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  phone_visible: z.boolean().optional().default(false),
  product_type: z.string().optional().default(""),
  images: z.array(z.string()).max(10).optional(),
});

/** PUT /listings/:id — only validates and updates provided fields */
const updateSchema = z
  .object({
    title: z.string().min(1, "title required").optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    region: z.string().optional(),
    district: z.string().optional(),
    phone: z.string().optional(),
    phone_visible: z.boolean().optional(),
    product_type: z.string().optional(),
    category_id: z.number().int().positive().nullable().optional(),
    status: z.enum(["approved", "rejected"]).optional(),
  })
  .strict();

const SORT_MAP = {
  new: "l.created_at DESC",
  price_asc: "l.price ASC",
  price_desc: "l.price DESC",
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

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (req.query.query && String(req.query.query).trim()) {
      const searchTerm = "%" + String(req.query.query).trim() + "%";
      conditions.push(`(l.title ILIKE $${paramIndex} OR l.description ILIKE $${paramIndex})`);
      params.push(searchTerm);
      paramIndex++;
    }
    if (req.query.category_id != null && req.query.category_id !== "") {
      const catId = parseInt(req.query.category_id, 10);
      if (!Number.isNaN(catId)) {
        conditions.push(`l.category_id = $${paramIndex}`);
        params.push(catId);
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
      conditions.push(`l.status = $${paramIndex}`);
      params.push("approved");
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
        FROM listings l
        ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    let limitIndex, offsetIndex, listParams;
    let favoritesJoin = "";
    let isFavoriteSelect = "false AS is_favorite";

    if (userId != null) {
      favoritesJoin = `LEFT JOIN favorites f
       ON f.listing_id = l.id
       AND f.user_id = $${paramIndex}`;
      isFavoriteSelect = "MAX(f.id) IS NOT NULL AS is_favorite";
      limitIndex = paramIndex + 1;
      offsetIndex = paramIndex + 2;
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
  l.phone,
  l.phone_visible,
  l.product_type,
  l.status,
  l.created_at,
  COALESCE(
    JSON_AGG(li.image_url)
      FILTER (WHERE li.image_url IS NOT NULL),
    '[]'
  ) AS images,
  ${isFavoriteSelect}
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN listing_images li ON li.listing_id = l.id
${favoritesJoin}
${whereClause}
GROUP BY l.id, c.name
ORDER BY ${orderBy}
LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams
    );

    const items = listResult.rows.map((row) => maskPhoneForResponse(row));
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
  l.created_at,
  COALESCE(
    JSON_AGG(li.image_url)
      FILTER (WHERE li.image_url IS NOT NULL),
    '[]'
  ) AS images,
  ${isFavoriteSelect}
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN listing_images li ON li.listing_id = l.id
${favoritesJoin}
WHERE l.id = $1
GROUP BY l.id, c.name`,
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
    if (req.body.phone !== undefined) raw.phone = req.body.phone;
    if (req.body.phone_visible !== undefined) raw.phone_visible = req.body.phone_visible;
    if (req.body.product_type !== undefined) raw.product_type = req.body.product_type;
    if (req.body.category_id !== undefined) {
      raw.category_id = req.body.category_id === null || req.body.category_id === "" ? null : parseInt(req.body.category_id, 10);
    }
    if (req.body.status !== undefined) raw.status = req.body.status;

    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }

    const data = parsed.data;
    const allowedColumns = ["title", "description", "price", "region", "district", "phone", "phone_visible", "product_type", "category_id"];
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

    if (setParts.length === 0) {
      return res.status(400).json({ ok: false, error: "No fields to update" });
    }

    setParams.push(id);
    const result = await query(
      `UPDATE listings SET ${setParts.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
      setParams
    );

    res.json({ ok: true, item: maskPhoneForResponse(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post("/", auth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse({
      ...req.body,
      price: req.body.price != null ? Number(req.body.price) : 0,
      category_id:
        req.body.category_id != null ? parseInt(req.body.category_id, 10) : null,
      images: Array.isArray(req.body.images) ? req.body.images : undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const { title, description, price, category_id, region, district, phone, phone_visible, product_type, images } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const listingResult = await client.query(
        `INSERT INTO listings (user_id, category_id, title, description, price, region, district, phone, phone_visible, product_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          req.user.id,
          category_id || null,
          title,
          description || "",
          price,
          region || "",
          district || "",
          phone || "",
          !!phone_visible,
          product_type || "",
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
  l.created_at,
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
    await query("DELETE FROM listings WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
