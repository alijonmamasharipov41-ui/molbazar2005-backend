# Search API — backend kod

Qidiruv alohida endpoint emas: **GET /api/listings** da `search` yoki `query` parametri orqali ishlaydi.

---

## 1. Route

| Method | Path | Middleware | Fayl |
|--------|------|------------|------|
| GET | `/api/listings` | optionalAuth | `src/routes/listings.js` |

**App’da ulanish:** `src/app.js` da `api.use("/listings", listingsRouter)` — to‘liq URL: `GET /api/listings`.

**Qidiruv parametrlari (query):**

| Parametr | Turi | Tavsif |
|----------|------|--------|
| `search` yoki `query` | string | Qidiruv matni (sarlavha, tavsif, product_type) |
| `category_id` | number | Kategoriya ID |
| `category_slug` | string | chorva, parandalar, baliqlar, don, yemish |
| `region` | string | Viloyat nomi (matn) |
| `district` | string | Tuman nomi (matn) |
| `region_id` | number | Viloyat ID |
| `district_id` | number | Tuman ID |
| `min_price`, `max_price` | number | Narx oralig‘i |
| `page`, `limit` | number | Sahifa, limit (default 20) |
| `sort` | string | new, price_asc, price_desc, id_asc, id_desc |
| `user_id` | number | Faqat shu user e’lonlari |
| `status` | string | Admin: approved, pending, rejected |

---

## 2. Controller (handler)

Bitta handler ichida: parametrlar o‘qiladi, qidiruv normalizatsiya qilinadi, `conditions` va `params` yig‘iladi, so‘ng COUNT va SELECT SQL chaqiriladi.

### 2.1 Qidiruv parametri va normalizatsiya

```javascript
// src/routes/listings.js (taxminan 98–117)

const search = (req.query.search ?? req.query.query)?.trim() || null;

const normalizeSearch = (s) => {
  let t = String(s || "").toLowerCase();
  t = t.replace(/[''ʻʼ`´]/g, "'");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/\bqoy\b/g, "qo'y");
  t = t.replace(/\bqozli\b/g, "qo'zli");
  t = t.replace(/\bxisori\b/g, "hisori");
  t = t.replace(/\barashan\b/g, "aralash");
  t = t.replace(/\bzot\b/g, "zoti");
  return t;
};
const searchNorm = search ? normalizeSearch(search) : null;

const escapeLike = (s) => String(s).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
const searchLike = searchNorm ? `%${escapeLike(searchNorm)}%` : null;
```

### 2.2 WHERE shartlari (qidiruv + boshqa filtrlar)

Qidiruv uchun birinchi shart (full-text + ILIKE fallback):

```javascript
// $1 = searchNorm, $2 = searchLike, $3 = rid, $4 = did
const conditions = [
  "((l.search_vector @@ plainto_tsquery('simple', $1)) OR (l.title ILIKE $2 OR COALESCE(l.description,'') ILIKE $2 OR COALESCE(l.product_type,'') ILIKE $2) OR $1 IS NULL)",
  "(l.region_id = $3 OR $3 IS NULL)",
  "(l.district_id = $4 OR $4 IS NULL)",
];
const params = [searchNorm, searchLike, rid, did];
let paramIndex = 5;
// keyin category_id, category_slug, region, district, min_price, max_price, user_id, status qo‘shiladi
```

Keyin `whereClause = "WHERE " + conditions.join(" AND ")` va shu `params` bilan COUNT va SELECT chaqiriladi.

---

## 3. SQL query

### 3.1 Count (jami yozuvlar)

```sql
SELECT COUNT(*)::int AS total
FROM listings l
WHERE
  (
    (l.search_vector @@ plainto_tsquery('simple', $1))
    OR (l.title ILIKE $2 OR COALESCE(l.description,'') ILIKE $2 OR COALESCE(l.product_type,'') ILIKE $2)
    OR $1 IS NULL
  )
  AND (l.region_id = $3 OR $3 IS NULL)
  AND (l.district_id = $4 OR $4 IS NULL)
  -- + category, region, district, price, user_id, status shartlari
;
```

### 3.2 List (natijalar, sahifalash)

```sql
SELECT
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
  l.yoshi, l.zoti, l.jinsi, l.vazn,
  l.weight, l.unit,
  u.full_name AS seller_name,
  COALESCE(JSON_AGG(li.image_url) FILTER (WHERE li.image_url IS NOT NULL), '[]') AS images,
  -- is_favorite (agar userId bo‘lsa)
FROM listings l
LEFT JOIN categories c ON c.id = l.category_id
LEFT JOIN users u ON u.id = l.user_id
LEFT JOIN regions r ON r.id = l.region_id
LEFT JOIN districts d ON d.id = l.district_id
LEFT JOIN listing_images li ON li.listing_id = l.id
-- + LEFT JOIN favorites f (agar userId bo‘lsa)
WHERE
  -- (qidiruv + region_id + district_id + ... barcha conditions)
GROUP BY l.id, c.name, u.full_name, r.name, d.name
ORDER BY l.created_at DESC   -- yoki sort parametriga qarab
LIMIT $N OFFSET $N+1;
```

Qidiruv sharti:
- `$1` bo‘sh bo‘lsa (`$1 IS NULL`) — qidiruvsiz, barcha e’lonlar (boshqa filtrlarga qarab).
- `$1` berilganda: `l.search_vector @@ plainto_tsquery('simple', $1)` (full-text) yoki `title/description/product_type` bo‘yicha `ILIKE $2` (fallback).

---

## 4. Qisqacha oqim

1. **Route:** `GET /api/listings?search=...` (yoki `query=...`).
2. **Controller:** `listings.js` dagi `router.get("/", optionalAuth, async (req, res) => { ... })` — `search`/`query` o‘qiladi, `normalizeSearch` va `escapeLike` qo‘llanadi, `conditions` va `params` to‘ldiriladi.
3. **SQL:** Bir xil `WHERE` va `params` bilan avval `COUNT(*)`, keyin yuqoridagi `SELECT ... FROM listings l ... WHERE ... GROUP BY ... ORDER BY ... LIMIT/OFFSET` bajariladi.

Barcha kod: `src/routes/listings.js` (taxminan 88–280 qatorlar).
