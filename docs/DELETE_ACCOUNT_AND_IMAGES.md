# Akkaunt o'chirish va Cloudinary rasmlarini boshqarish

## 1. Akkauntni o'chirish (Delete Account)

### Endpoint
- **DELETE /api/users/me**
- **Auth:** JWT talab qilinadi (`Authorization: Bearer <token>`).
- **Huquq:** Faqat login qilgan foydalanuvchi o'z akkauntini o'chiradi (boshqa user o'chirolmaydi).

### Ketma-ketlik
1. Middleware `auth` — `req.user.id` tekshiriladi.
2. Foydalanuvchiga tegishli barcha e'lonlardagi rasm URL'lari olinadi (`listings` + `listing_images`).
3. Bu URL'lar Cloudinary'dan `destroy` API orqali o'chiriladi (bitta xato bo'lsa ham qolganlar davom etadi).
4. `DELETE FROM users WHERE id = $1` — CASCADE orqali avtomatik o'chadi: `listings`, `listing_images`, `favorites`, `conversations` va boshqa bog'liq jadvalar (schema ga qarab).

### Javob
- **200:** `{ "ok": true, "message": "Akkaunt o'chirildi" }`
- **401:** Token yo'q yoki noto'g'ri
- **404:** User topilmadi (odatda bo'lmaydi)
- **500:** Server xatosi

---

## 2. Cloudinary tozalash

### Yordamchi modul: `src/lib/cloudinaryHelper.js`
- **getPublicIdFromUrl(url)** — Cloudinary URL dan `public_id` ni ajratib beradi.
- **destroyImage(publicId)** — Bitta rasmni o'chiradi; xato bo'lsa log, exception emas.
- **destroyImagesByUrls(urls)** — Bir nechta URL uchun o'chirish; har biri try-catch ichida, bitta xato umumiy jarayonni to'xtatmaydi.

### Qayerda ishlatiladi
- **DELETE /api/users/me** — Foydalanuvchi o'chirilishidan oldin uning barcha e'lon rasmlari Cloudinary'dan o'chiriladi.
- **PUT /api/listings/:id** — Tahrirlashda yangi `images` ro'yxati yuborilganda, eski ro'yxatda bor lekin yangida yo'q bo'lgan URL'lar Cloudinary'dan o'chiriladi.

---

## 3. SQL integrity (CASCADE)

### Mavjud schema (001, 004)
- `listings.user_id` → `users(id) ON DELETE CASCADE`
- `listing_images.listing_id` → `listings(id) ON DELETE CASCADE`

Shuning uchun `DELETE FROM users WHERE id = $1` bajarilganda PostgreSQL avtomatik ravishda shu user'ning barcha `listings` va ularning `listing_images` qatorlarini o'chiradi.

### Agar CASCADE bo'lmasa (eski baza)
Migration **029_user_listing_cascade.sql** CASCADE ni ta'minlaydi: mavjud FK'larni topib olib tashlaydi va `ON DELETE CASCADE` bilan qayta qo'shadi. Migratsiyani ishga tushirish:
```bash
node src/server.js --migrate
```

### Qo'lda CASCADE qo'shish (migration ishlamasa)
```sql
-- listings: user o'chganda e'lonlar o'chsin
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_user_id_fkey;
ALTER TABLE listings ADD CONSTRAINT listings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- listing_images: e'lon o'chganda rasmlar o'chsin
ALTER TABLE listing_images DROP CONSTRAINT IF EXISTS listing_images_listing_id_fkey;
ALTER TABLE listing_images ADD CONSTRAINT listing_images_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
```
(Constraint nomi loyihada boshqacha bo'lsa, `pg_constraint` jadvalidan topib, shu nom bilan `DROP` qiling.)

---

## 4. Xavfsizlik

- **DELETE /api/users/me:** Faqat `auth` middleware orqali kiriladi; `req.user.id` faqat o'zining ID'si. Boshqa user'ni o'chirish uchun alohida admin endpoint kerak (bu loyihada faqat "o'zini o'chirish").
- Rasm o'chirishda Cloudinary xatosi (masalan, URL boshqa domen) listing yoki user o'chirish jarayonini to'xtatmaydi; xato log qilinadi.
