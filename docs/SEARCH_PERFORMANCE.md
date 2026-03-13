# Molbozor: OLX-level search — performance va SQL

## Qaysi o‘zgarishlar 10x tezlik beradi

| O‘zgarish | Sabab |
|-----------|--------|
| **WHERE da GIN-friendly shart** | `(search_vector @@ plainto_tsquery)` bitta branch — planner GIN index ishlatadi; `OR title ILIKE` aralash qilinsa index ishlamaydi. |
| **LATERAL images + favorites** | `GROUP BY` + `JSON_AGG(li.image_url)` o‘rniga `LEFT JOIN LATERAL (SELECT JSON_AGG ... FROM listing_images WHERE listing_id = l.id)` — bitta qator per listing, GROUP BY yo‘q. |
| **ts_rank() ORDER BY** | Qidiruvda “eng mos” birinchi — full-text rank, keyin `created_at`. |
| **Partial index (status = 'approved')** | Bozor ko‘pini `WHERE status = 'approved'` so‘raydi — partial index faqat shu qatorlar uchun, kichikroq va tezroq. |
| **pg_trgm GIN (title, description, product_type)** | ILIKE fallback va autocomplete uchun trigram index — katta jadvalda ham tez. |

---

## 1. To‘liq GET /api/listings SQL (ishlashga tayyor)

### 1.1 COUNT (sahifalash uchun jami)

```sql
SELECT COUNT(*)::int AS total
FROM listings l
WHERE
  (($1 IS NULL) OR (
    (l.search_vector @@ plainto_tsquery('simple', $1))
    OR (l.search_vector IS NULL AND (
      l.title ILIKE $2 OR COALESCE(l.description,'') ILIKE $2 OR COALESCE(l.product_type,'') ILIKE $2
    ))
  ))
  AND (l.region_id = $3 OR $3 IS NULL)
  AND (l.district_id = $4 OR $4 IS NULL)
  -- + category_id/category_slug, region, district, min_price, max_price, user_id, status
;
```

**Parametrlar:** `$1` = searchNorm, `$2` = searchLike (`%...%`), `$3` = region_id, `$4` = district_id, keyin boshqa filtrlar.

### 1.2 LIST (natijalar: LATERAL images + favorites, ts_rank tartib)

```sql
SELECT
  l.id, l.user_id, l.category_id, c.name AS category_name,
  l.title, l.description, l.price, l.region, l.district,
  r.name AS region_name, d.name AS district_name,
  l.phone, l.phone_visible, l.product_type, l.status, l.category_slug,
  l.created_at, l.yoshi, l.zoti, l.jinsi, l.vazn, l.weight, l.unit,
  u.full_name AS seller_name,
  COALESCE(img.images, '[]') AS images,
  COALESCE(fav.is_favorite, false) AS is_favorite
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN users u ON u.id = l.user_id
LEFT JOIN regions r ON r.id = l.region_id
LEFT JOIN districts d ON d.id = l.district_id
LEFT JOIN LATERAL (
  SELECT COALESCE(JSON_AGG(li.image_url) FILTER (WHERE li.image_url IS NOT NULL), '[]') AS images
  FROM listing_images li WHERE li.listing_id = l.id
) img ON true
LEFT JOIN LATERAL (
  SELECT true AS is_favorite FROM favorites f
  WHERE f.listing_id = l.id AND f.user_id = $userId LIMIT 1
) fav ON true
WHERE
  -- (xuddi COUNT dagi shartlar)
ORDER BY ts_rank(l.search_vector, plainto_tsquery('simple', $1)) DESC NULLS LAST, l.created_at DESC
LIMIT $limit OFFSET $offset;
```

Qidiruv bo‘lmasa: `ORDER BY` o‘rniga `l.created_at DESC` yoki `l.price ASC` va h.k. (sort parametriga qarab).

---

## 2. Node.js controller snippet (async/await + pg)

```javascript
const { query } = require("../db");

// Query params
const searchNorm = (req.query.search ?? req.query.query)?.trim() ? normalizeSearch(...) : null;
const searchLike = searchNorm ? `%${escapeLike(searchNorm)}%` : null;
const params = [searchNorm, searchLike, rid, did, /* category, price, status, ... */];

// GIN-friendly: bitta branch search_vector @@ plainto_tsquery; fallback = search_vector IS NULL + ILIKE
const searchCondition = searchNorm
  ? `(($1 IS NULL) OR ((l.search_vector @@ plainto_tsquery('simple', $1)) OR (l.search_vector IS NULL AND (l.title ILIKE $2 OR ...))))`
  : "true";

// ORDER: qidiruv bo'lsa ts_rank, yo'q bo'lsa sort param
const orderByClause = searchNorm
  ? "ts_rank(l.search_vector, plainto_tsquery('simple', $1)) DESC NULLS LAST, l.created_at DESC"
  : SORT_MAP[req.query.sort] || "l.created_at DESC";

const countResult = await query(
  `SELECT COUNT(*)::int AS total FROM listings l WHERE ${whereConditions}`,
  params
);
const total = countResult.rows[0].total;

const listResult = await query(
  `SELECT l.id, ... , COALESCE(img.images, '[]') AS images, COALESCE(fav.is_favorite, false) AS is_favorite
   FROM listings l
   LEFT JOIN ... 
   LEFT JOIN LATERAL (SELECT JSON_AGG(...) FROM listing_images WHERE listing_id = l.id) img ON true
   LEFT JOIN LATERAL (SELECT true FROM favorites WHERE listing_id = l.id AND user_id = $n LIMIT 1) fav ON true
   WHERE ${whereConditions}
   ORDER BY ${orderByClause}
   LIMIT $limit OFFSET $offset`,
  [...params, userId, limit, offset]
);

res.json({ ok: true, page, limit, total, items: listResult.rows });
```

---

## 3. Pagination + sort parametrlari

| Parametr | Default | Tavsif |
|----------|---------|--------|
| `page` | 1 | Sahifa raqami |
| `limit` | 20 | Sahifadagi element (maks 100) |
| `sort` | new | `new` \| `price_asc` \| `price_desc` \| `id_asc` \| `id_desc` |

Qidiruv **bor** bo‘lsa `sort` e’tiborsiz qolinadi va tartib: `ts_rank DESC`, keyin `created_at DESC`.

---

## 4. Category, region, district, price filterlar

- **category_id** + ixtiyoriy **category_slug**: `(l.category_id = $n OR LOWER(TRIM(l.category_slug)) = $slug)`
- **region_id**, **district_id**: `l.region_id = $n`, `l.district_id = $n` (null = filtr yo‘q)
- **region**, **district** (matn): `l.region = $n`, `l.district = $n`
- **min_price**, **max_price**: `l.price >= $n`, `l.price <= $n`
- **status**: bozor uchun `approved`; admin ixtiyoriy `pending`/`rejected`

Barchasi AND bilan birlashtiriladi.

---

## 5. Fallback ILIKE (search_vector bo‘sh qatorlar uchun)

Migratsiya oldingi qatorlarda `search_vector` bo‘sh bo‘lishi mumkin. Shuning uchun:

```text
(search_vector @@ plainto_tsquery('simple', $1))
OR (search_vector IS NULL AND (title ILIKE $2 OR description ILIKE $2 OR product_type ILIKE $2))
```

Birinchi branch GIN ishlatadi, ikkinchisi kam qator uchun ILIKE (yoki 027 da qo‘shilgan pg_trgm GIN title/description/product_type ishlatadi).

---

## 6. LATERAL images + user — nega tez

- **Eski:** `LEFT JOIN listing_images li` → har bir listing uchun N ta qator → `GROUP BY l.id, ...` + `JSON_AGG(li.image_url)` — katta N da sekin.
- **Yangi:** `LEFT JOIN LATERAL (SELECT JSON_AGG(...) FROM listing_images WHERE listing_id = l.id) img ON true` — har bir listing uchun 1 qator, GROUP BY yo‘q. Xuddi shunday favorites uchun LATERAL — bitta subquery per listing.

---

## 7. Partial / composite index tavsiyalari (027 da qo‘shilgan)

| Index | Maqsad |
|-------|--------|
| `idx_listings_approved_created` | `WHERE status = 'approved'` + `ORDER BY created_at DESC` |
| `idx_listings_approved_category_slug` | Kategoriya bo‘yicha sahifa |
| `idx_listings_approved_location` | region_id + district_id filter |
| `idx_listings_approved_price_asc/desc` | Narx bo‘yicha tartib |
| `idx_listings_search_vector` (GIN) | Full-text qidiruv |
| `idx_listings_title_gin_trgm` (pg_trgm) | ILIKE / fuzzy fallback |

---

## 8. pg_trgm + fuzzy

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_listings_title_gin_trgm ON listings USING gin (title gin_trgm_ops);
```

Keyin `title ILIKE '%hisor%'` tezroq (GIN trigram). Optional: `similarity(title, $1) > 0.3` kabi fuzzy qidiruv.

---

## 9. OLX-style autocomplete query (misol)

```sql
SELECT l.id, l.title
FROM listings l
WHERE l.status = 'approved'
  AND (l.search_vector @@ plainto_tsquery('simple', $1) OR l.title ILIKE $2 OR l.product_type ILIKE $2)
ORDER BY l.created_at DESC
LIMIT 10;
```

`$1` = normallashtirilgan qidiruv, `$2` = `%qidiruv%`. Endpoint: **GET /api/listings/autocomplete?q=...**
