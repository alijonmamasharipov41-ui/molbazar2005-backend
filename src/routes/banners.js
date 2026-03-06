const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { auth, optionalAuth } = require("../middleware/auth");
const { PUBLIC_URL } = require("../config");

const router = express.Router();

/** Rasm URL i http(s) bilan boshlanmasa, PUBLIC_URL qo‘shiladi (app va admin uchun to‘liq yo‘l). */
function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return url || "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const base = PUBLIC_URL.replace(/\/$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

const createSchema = z.object({
  name: z.string().min(1, "name required"),
  image_url: z.string().min(1, "image_url required"),
  link_url: z.string().optional().default(""),
  placement: z.enum(["home", "categories", "listing"]).optional().default("home"),
  type: z.enum(["hero", "sidebar"]).optional().default("hero"),
  link_type: z.enum(["category_filter", "article", "external_link"]).optional().default("external_link"),
  end_date: z.string().optional().nullable(),
  show_after_index: z.number().int().min(0).optional().default(0),
  priority: z.number().int().min(1).optional().default(1),
});

const updateSchema = createSchema.partial();

/** GET /api/banners — ro'yxat (public). placement=home|categories|listing, type=hero|sidebar ixtiyoriy. all=1 + auth admin = barcha bannerlar. */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const placementRaw = req.query.placement != null ? String(req.query.placement).toLowerCase() : "";
    const placement = ["home", "categories", "listing"].includes(placementRaw) ? placementRaw : null;
    const typeRaw = req.query.type != null ? String(req.query.type).toLowerCase() : "";
    const typeFilter = ["hero", "sidebar"].includes(typeRaw) ? typeRaw : null;
    const showAll = req.query.all === "1" && req.user?.role === "admin";
    const today = new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT id, name, image_url, link_url, placement, type, link_type, end_date,
             show_after_index, priority, views, clicks, created_at, updated_at
      FROM banners
    `;
    const params = [];
    let idx = 1;
    if (!showAll) {
      params.push(today);
      sql += ` WHERE (end_date IS NULL OR end_date >= $${idx})`;
      idx++;
    }
    if (placement) {
      params.push(placement);
      sql += (params.length === 1 ? " WHERE " : " AND ") + `placement = $${idx}`;
      idx++;
    }
    if (typeFilter) {
      params.push(typeFilter);
      sql += (params.length === 1 ? " WHERE " : " AND ") + `type = $${idx}`;
      idx++;
    }
    sql += ` ORDER BY priority ASC, id ASC`;

    const result = await query(sql, params);
    const items = result.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      imageUrl: normalizeImageUrl(row.image_url),
      link: row.link_url ?? "",
      endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
      placement: row.placement ?? "home",
      type: row.type ?? "hero",
      linkType: row.link_type ?? "external_link",
      showAfterIndex: row.show_after_index ?? 0,
      priority: row.priority ?? 1,
      views: row.views ?? 0,
      clicks: row.clicks ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
});

/** GET /api/banners/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const result = await query(
      "SELECT id, name, image_url, link_url, placement, type, link_type, end_date, show_after_index, priority, views, clicks, created_at, updated_at FROM banners WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Banner not found" });
    }
    const row = result.rows[0];
    res.json({
      ok: true,
      item: {
        id: String(row.id),
        name: row.name,
        imageUrl: normalizeImageUrl(row.image_url),
        link: row.link_url ?? "",
        endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
        placement: row.placement ?? "home",
        type: row.type ?? "hero",
        linkType: row.link_type ?? "external_link",
        showAfterIndex: row.show_after_index ?? 0,
        priority: row.priority ?? 1,
        views: row.views ?? 0,
        clicks: row.clicks ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/banners — faqat admin */
router.post("/", auth, async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  try {
    const parsed = createSchema.safeParse({
      ...req.body,
      image_url: req.body.image_url ?? req.body.imageUrl,
      link_url: req.body.link_url ?? req.body.link ?? "",
      end_date: req.body.end_date ?? req.body.endDate ?? null,
      show_after_index: req.body.show_after_index ?? req.body.showAfterIndex ?? 0,
      priority: req.body.priority ?? 1,
    });
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const d = parsed.data;
    const result = await query(
      `INSERT INTO banners (name, image_url, link_url, placement, type, link_type, end_date, show_after_index, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, image_url, link_url, placement, type, link_type, end_date, show_after_index, priority, views, clicks, created_at, updated_at`,
      [d.name, d.image_url, d.link_url, d.placement, d.type, d.link_type, d.end_date || null, d.show_after_index, d.priority]
    );
    const row = result.rows[0];
    res.status(201).json({
      ok: true,
      item: {
        id: String(row.id),
        name: row.name,
        imageUrl: normalizeImageUrl(row.image_url),
        link: row.link_url ?? "",
        endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
        placement: row.placement ?? "home",
        type: row.type ?? "hero",
        linkType: row.link_type ?? "external_link",
        showAfterIndex: row.show_after_index ?? 0,
        priority: row.priority ?? 1,
        views: row.views ?? 0,
        clicks: row.clicks ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/banners/:id — faqat admin */
router.put("/:id", auth, async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const check = await query("SELECT id FROM banners WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Banner not found" });
    }
    const body = {
      ...req.body,
      image_url: req.body.image_url ?? req.body.imageUrl,
      link_url: req.body.link_url ?? req.body.link,
      end_date: req.body.end_date ?? req.body.endDate,
      show_after_index: req.body.show_after_index ?? req.body.showAfterIndex,
      priority: req.body.priority,
    };
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.errors[0]?.message || "Validation failed",
      });
    }
    const d = parsed.data;
    const updates = [];
    const params = [];
    let idx = 1;
    if (d.name !== undefined) { updates.push(`name = $${idx}`); params.push(d.name); idx++; }
    if (d.image_url !== undefined) { updates.push(`image_url = $${idx}`); params.push(d.image_url); idx++; }
    if (d.link_url !== undefined) { updates.push(`link_url = $${idx}`); params.push(d.link_url); idx++; }
    if (d.placement !== undefined) { updates.push(`placement = $${idx}`); params.push(d.placement); idx++; }
    if (d.type !== undefined) { updates.push(`type = $${idx}`); params.push(d.type); idx++; }
    if (d.link_type !== undefined) { updates.push(`link_type = $${idx}`); params.push(d.link_type); idx++; }
    if (d.end_date !== undefined) { updates.push(`end_date = $${idx}`); params.push(d.end_date); idx++; }
    if (d.show_after_index !== undefined) { updates.push(`show_after_index = $${idx}`); params.push(d.show_after_index); idx++; }
    if (d.priority !== undefined) { updates.push(`priority = $${idx}`); params.push(d.priority); idx++; }
    updates.push("updated_at = NOW()");
    params.push(id);
    const result = await query(
      `UPDATE banners SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, name, image_url, link_url, placement, type, link_type, end_date, show_after_index, priority, views, clicks, created_at, updated_at`,
      params
    );
    const row = result.rows[0];
    res.json({
      ok: true,
      item: {
        id: String(row.id),
        name: row.name,
        imageUrl: normalizeImageUrl(row.image_url),
        link: row.link_url ?? "",
        endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
        placement: row.placement ?? "home",
        type: row.type ?? "hero",
        linkType: row.link_type ?? "external_link",
        showAfterIndex: row.show_after_index ?? 0,
        priority: row.priority ?? 1,
        views: row.views ?? 0,
        clicks: row.clicks ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/banners/:id — faqat admin */
router.delete("/:id", auth, async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const result = await query("DELETE FROM banners WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Banner not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
