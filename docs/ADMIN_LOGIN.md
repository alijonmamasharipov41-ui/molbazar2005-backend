# Admin panelga kirish — kod kelmasa

## 1. Kod emailga yetmayapti (Resend "Recipient not found")

Resend xabar yuboradi, lekin **bounce** bo‘ladi: "Recipient not found" — manzil mavjud emas yoki xato.

- **Tekshiring:** Email to‘g‘rimi? Masalan: `alijonmmasharipov41` (ikki **m**) yoki `alijonmasharipov41` (bitta **m**)?
- **Qiling:** To‘g‘ri va **haqiqiy** Gmail manzilini kiriting (o‘sha hisobga kirish mumkin bo‘lgan).
- Keyin admin panelda "Boshqa email kiritish" orqali yangi email bilan kod so‘rang.

## 2. "Access denied. Admin only."

Bu email **users** jadvalida **role = 'admin'** bo‘lmaganda chiqadi. Backend faqat admin ro‘yxatidagi emailga kod yuboradi.

### Admin qanday qo‘shiladi

Bazada `users` jadvalida email va `role = 'admin'` bo‘lishi kerak.

**Variant A — yangi admin (email hali users da yo‘q):**

```sql
-- Avval mavjudmi tekshiring: SELECT id, email, role FROM users WHERE email = 'your-admin@gmail.com';
-- Yo'q bo'lsa yangi qator qo'shing (phone bo'sh qolishi mumkin):
INSERT INTO users (full_name, phone, email, password_hash, role)
VALUES ('Admin', NULL, 'your-admin@gmail.com', '', 'admin');
-- Mavjud bo'lsa faqat role ni yangilang:
-- UPDATE users SET role = 'admin' WHERE email = 'your-admin@gmail.com';
```

**Variant B — mavjud foydalanuvchini admin qilish (email allaqachon bor):**

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-admin@gmail.com';
```

`your-admin@gmail.com` o‘rniga **to‘g‘ri va qabul qiladigan** email yozing.

## 3. Ketma-ketlik

1. Bazada bu email uchun `role = 'admin'` ekanligini tekshiring yoki yuqoridagi SQL bilan qo‘shing/o‘zgartiring.
2. Admin panelda kirish sahifasida **to‘g‘ri** emailni kiriting (Resend bounce bo‘lmasin).
3. "Tasdiqlash kodi yuborish" → email keladi → 6 xonali kodni kiriting → Tasdiqlash.
