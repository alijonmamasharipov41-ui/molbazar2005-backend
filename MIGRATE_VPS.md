# VPS da migratsiyani ishga tushirish

---

## ⚠️ ESDAN CHIQMASIN: GitHub dan pull qilgach nima qilish kerak

**VPS** da backend papkasiga kirib, **bitta buyruq** bajaring:

```bash
cd /path/to/molbazar2005-backend
node src/server.js --migrate
```

Keyin backendni qayta ishga tushiring (masalan: `pm2 restart molbazar2005-backend`).

Bu buyruq barcha SQL fayllarni (017, 018 va boshqalar) bajaradi va `listings` jadvaliga yangi ustunlarni qo‘shadi. **Har safar yangi migratsiya qo‘shilganda yoki kodni VPS ga tortgandan keyin `--migrate` ni bir marta ishga tushirish kifoya.**

---

Agar e'lon joylashda `column "phone_visible" of relation "listings" does not exist` xatosi chiqsa, VPS bazasida migratsiya ishlamagan — yuqoridagi `node src/server.js --migrate` ni bajaring.

## 1-usul: Barcha migratsiyalarni ishga tushirish (tavsiya etiladi)

VPS serverda backend papkasida:

```bash
cd /path/to/molbazar2005-backend
node src/server.js --migrate
```

Keyin backendni qayta ishga tushiring.

## 2-usul: Faqat `phone_visible` ustunini qo'shish

Agar faqat shu ustun kerak bo'lsa, VPS da PostgreSQL ga ulaning va quyidagi SQL ni bajaring:

```sql
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS phone_visible BOOLEAN DEFAULT false;
```

Yoki bir qatorda:

```bash
psql $DATABASE_URL -c "ALTER TABLE listings ADD COLUMN IF NOT EXISTS phone_visible BOOLEAN DEFAULT false;"
```

## 3-usul: Chorva maydonlari (yoshi, zoti, jinsi, vazn)

Agar e'lonlarda "yoshi, zoti, jinsi, vazn" to'liq saqlanmasa yoki xato chiqsa, 017 migratsiyasini qo'shing:

```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS yoshi TEXT DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS zoti TEXT DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS jinsi TEXT DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS vazn TEXT DEFAULT '';
```

Yoki migratsiyalarni to'liq ishga tushiring: `node src/server.js --migrate`

## 4-usul: Bannerlar jadvali

Agar admin panelda "Bannerlar" bo‘limida "Xatolik yuz berdi" chiqsa, `banners` jadvali mavjud emas. Migratsiyani to‘liq ishga tushiring (008_banners.sql ro‘yxatda bo‘lishi kerak):

```bash
node src/server.js --migrate
```

## 5-usul: Kategoriya slug (chorva, don, yemish, baliqlar, parandalar)

E'lonlarda kategoriya turi to'liq saqlanishi uchun:

```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category_slug TEXT DEFAULT '';
```

## Jarayon (tekshiruv)

1. **User** — ilovada e'lon yaratadi (rasm, narx, telefon, phone_visible va hokazo).
2. **Backend** — `POST /api/listings` qabul qiladi, `listings` jadvaliga (shu jumladan `phone_visible`) yozadi.
3. **Admin** — admin panelda e'lonlarni ko'radi, "Tasdiqlash" / "Rad etish" qiladi; `status` `pending` → `approved` / `rejected` bo'ladi.
4. **User** — "E'lonlarim" da statusni ko'radi; tasdiqlangan e'lonlar bozorda chiqadi.

`phone_visible` ustuni mavjud bo'lishi shart, aks holda INSERT xato beradi.
