# App qidiruv — dasturchi kuzatuvi

Qisqa audit: ilova qidiruvi qanchalik to‘g‘ri qurilgan va qayerda yaxshilash mumkin.

---

## 1. Umumiy baho: **to‘g‘ri qurilgan** ✓

- Mobil **API ga yuboradi** (lokal “barcha yuklab, filtrlash” emas).
- Backend **bitta manba** (GET /api/listings): qidiruv, kategoriya, hudud, pagination.
- Parametrlar **mos**: `search`/`query`, `category_slug`, `region`, `district`, `limit`.

---

## 2. Nima yaxshi

| Qism | Izoh |
|------|------|
| **Debounce 400 ms** | Matn o‘zgarganda har harfda emas, 400 ms dan keyin so‘rov — API va batareya uchun yaxshi. |
| **API parametrlari** | `query` → `search` va `query` ikkalasi yuboriladi (backend ikkalasini qabul qiladi). |
| **Kategoriya** | `category_slug` (chorva, don, …) backend filtri bilan mos. |
| **Hudud** | `region` va `district` matn sifatida — backend `l.region`, `l.district` bilan filtrlashga mos. |
| **Sub-kategoriya** | Mahalliy filtrlash (tur) — API dan kelgan 50 ta ichida; tez va oddiy. |
| **Backend qidiruv** | GIN + ts_rank + LATERAL (rasmlar), normalizatsiya (sheva), fallback ILIKE — zanjir to‘g‘ri. |
| **Filter modal** | Viloyat tanlash → tumanlar ro‘yxati → “Qo‘llash” dan keyin `load()` dependency orqali qayta so‘rov — mantiqan to‘g‘ri. |

---

## 3. Zaif joylar va tavsiyalar

### 3.1 Sahifalash (pagination) yo‘q

- **Hozir:** `limit: 50`, `page` yuborilmaydi → doim 1-sahifa.
- **Ta’sir:** 50 tadan ortiq natija bo‘lsa, qolgani ko‘rinmaydi.
- **Tavsiya:** “Keyingi” yoki infinite scroll: `page` ni saqlab, `fetchElons({ ..., page: page + 1 })` va natijani `setElons(prev => [...prev, ...data])` qilib qo‘shish. Backend `page`, `limit`, `total` qaytaradi.

### 3.2 Xato va bo‘sh holat

- **Hozir:** `catch` da `setElons([])` — tarmoq xatosi bo‘lsa faqat bo‘sh ro‘yxat.
- **Tavsiya:** “Qayta urinish” tugmasi yoki qisqa xabar: “Qidiruv ishlamadi. Qayta urinib ko‘ring.”; `loading`/`error` state ajratib, error da empty o‘rniga xabar ko‘rsatish.

### 3.3 Hudud nomlari mosligi

- **Hozir:** App da `REGIONS_DATA` kalitlari (masalan “Toshkent viloyati”) va tuman nomlari backend `listings.region` / `listings.district` bilan bir xil bo‘lishi kerak.
- **Tavsiya:** Backendda viloyat/tuman ro‘yxati `regions`/`districts` jadvalidan kelsa, ilovadagi dropdown ham shu API dan olinsa (yoki bir xil nomlar ishlatilsa) nomlar har doim mos bo‘ladi.

### 3.4 Sort parametri

- **Hozir:** App `sort` yubormaydi → backend default “yangi” yoki qidiruvda ts_rank.
- **Tavsiya:** Agar kerak bo‘lsa, qidiruv sahifasida “Yangi / Arzon / Qimmat” kabi sort tanlovi va `fetchElons({ ..., sort: 'price_asc' })` qo‘shish mumkin.

### 3.5 Autocomplete ishlatilmayapti

- **Backend:** GET /api/listings/autocomplete?q=... mavjud.
- **App:** Hozircha ishlatilmayapti.
- **Tavsiya:** Qidiruv input ostida yoki fokusda “Takliflar” (suggestions) ko‘rsatish — autocomplete endpoint’dan so‘rov va natijani dropdown ko‘rinishida.

---

## 4. Zanjir (qisqa)

```
[User yozadi] → debounce 400ms → [fetchElons({ query, category_slug, region, district, limit: 50 })]
  → GET /api/listings?search=...&query=...&category_slug=...&region=...&district=...&limit=50
  → Backend: normalizeSearch, GIN/ts_rank, LATERAL images, filters
  → { items, total } → mapListingToElon → setElons
  → [Sub-kategoriya] → filterBySub(elons, selectedSubCategory) → filtered
  → [Grid]
```

Bu zanjir **mantiqan to‘g‘ri**: bitta API, to‘g‘ri parametrlar, backend qidiruv va filtrlash to‘g‘ri.

---

## 5. Xulosa

| Baho | Sabab |
|------|--------|
| **Arxitektura** | Yaxshi — bitta API, parametrlar mos, backend qidiruv zamonaviy (GIN, ts_rank, LATERAL). |
| **UX** | Yaxshi — debounce, kategoriya/hudud filtri, placeholder va hint bor. |
| **Pagination** | Yo‘q — faqat birinchi 50 ta; “load more” yoki sahifalash qo‘shilsa yaxshi bo‘ladi. |
| **Xato va autocomplete** | Xato ko‘rsatish va autocomplete endpoint’dan foydalanish qo‘shilishi mumkin. |

**Yakuniy:** App qidiruv **to‘g‘ri qurilgan**; asosiy tafovutlar sahifalash, xato UX va ixtiyoriy autocomplete/sort qo‘shishda.
