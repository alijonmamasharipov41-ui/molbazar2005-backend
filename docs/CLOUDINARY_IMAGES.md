# Cloudinary rasmlar — tekshiruv natijasi

## Savol
Foydalanuvchi e'lon rasmini tahrirlab yangisini yuklasa, eski (tahrirlanmagan) rasm Cloudinary'dan o'chib ketayaptimi?

## Javob: **Yo'q — eski rasm Cloudinary'dan o'chirilmaydi**

### Hozirgi xatti-harakat

1. **PUT /api/listings/:id** (e'lon tahrirlash, rasmlar yangilansa):
   - `listing_images` jadvalida eski barcha qatorlar **o‘chiriladi** (`DELETE FROM listing_images WHERE listing_id = $1`).
   - Yangi `data.images` ro‘yxati (URL’lar) **qayta yoziladi**.
   - **Cloudinary’ga hech qanday so‘rov yuborilmaydi** — eski fayllar bulutda qoladi.

2. **POST /api/uploads** — faqat **yuklash** (upload). Cloudinary’dan o‘chirish (destroy) endpoint’i yo‘q.

3. **DELETE /api/listings/:id** — e'lon o‘chirilganda ham faqat ma’lumotlar bazasidagi yozuv o‘chiriladi; Cloudinary’dagi rasmlar o‘chirilmaydi.

### Natija

- Eski rasmlar Cloudinary’da **qoladi** (storage ishlatiladi, tozalash yo‘q).
- Ilova va API to‘g‘ri ishlaydi — faqat DB dagi URL’lar yangilanadi; foydalanuvchi eski rasmlarni ko‘rmaydi.

---

## Tavsiya (ixtiyoriy)

Agar eski rasmlarni Cloudinary’dan ham o‘chirmoqchi bo‘lsangiz:

1. **Cloudinary URL → public_id:**  
   Format: `https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<public_id>.<ext>`  
   `public_id` ni ajratib, `cloudinary.uploader.destroy(public_id)` chaqirish kerak.

2. **Qayerda chaqirish:**
   - PUT listings/:id — yangi `data.images` bilan solishtirganda, endi ro‘yxatda yo‘q bo‘lgan URL’lar uchun Cloudinary’dan `destroy` qilish.
   - DELETE listings/:id — e'lon o‘chirilganda uning barcha rasmlarini Cloudinary’dan o‘chirish.

3. **Ehtiyot:** `destroy` muvaffaqiyatsiz bo‘lsa (masalan, URL boshqa domen yoki formatda), listing yangilanishi baribir muvaffaqiyatli bo‘lishi kerak; Cloudinary xatosini log qilib, davom etish ma’qul.

Hozircha loyihada Cloudinary’dan avtomatik o‘chirish **qo‘shilmagan**.
