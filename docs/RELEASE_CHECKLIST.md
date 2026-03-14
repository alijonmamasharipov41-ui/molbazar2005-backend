# Bozorga chiqishdan oldin — buzilmaslik uchun tekshiruv ro‘yxati

Barcha qadamlar bajarilgach, ilova va backend barqaror ishlashi kerak.

---

## 1. Backend (VPS / molbazar.uz)

| # | Ishlar | Qanday tekshirish |
|---|--------|-------------------|
| 1.1 | **Production .env** — `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `PORT` to‘g‘ri | Serverda `.env` fayl mavjud va hech narsa GitHub’ga commit qilinmagan |
| 1.2 | **Migratsiyalar** — barcha SQL migratsiyalar bajarilgan | `node src/server.js --migrate` xatosiz tugaydi |
| 1.3 | **PM2** — backend `pm2 start` yoki `pm2 restart` bilan ishlaydi, avtostart yoqilgan | `pm2 list`, `pm2 startup` |
| 1.4 | **API manzil** — `https://molbazar.uz/api/health` brauzerda `{"ok":true,"db":"connected"}` qaytaradi | Brauzerda tekshirish |
| 1.5 | **Firewall** — faqat kerakli portlar ochiq (80, 443, 22); backend nginx orqali proxy qilingan | `ufw status` |
| 1.6 | **Admin foydalanuvchi** — kamida bitta `role='admin'` bo‘lgan user mavjud | `SELECT id, email, role FROM users WHERE role='admin';` |

---

## 2. Mobil ilova (Expo / React Native)

| # | Ishlar | Qanday tekshirish |
|---|--------|-------------------|
| 2.1 | **Production API** — default URL `https://molbazar.uz/api`; build vaqtida `.env` yoki EAS env da shu qiymat | Ilova production build’da faqat molbazar.uz API’ga so‘rov yuboradi |
| 2.2 | **app.json / app.config** — `version`, `slug`, `ios.bundleIdentifier`, `android.package` to‘g‘ri; `scheme` (masalan `molbozor`) deep link uchun | `app.json` tekshirish; `npx expo prebuild` xatosiz |
| 2.3 | **Rasmlar** — `icon.png`, `splash.png`, `adaptive-icon` mavjud va yo‘llar to‘g‘ri | Build xato bermasligi kerak |
| 2.4 | **EAS Build** (agar ishlatilsa) — production profile’da `EXPO_PUBLIC_API_URL=https://molbazar.uz/api` | `eas.json` va EAS env o‘zgaruvchilari |
| 2.5 | **Store** — App Store / Play Market uchun versiya, skrinshotlar, tavsif tayyor | Chiqishdan oldin yakuniy tekshirish |

---

## 3. Admin panel

| # | Ishlar | Qanday tekshirish |
|---|--------|-------------------|
| 3.1 | **API manzil** — production build’da `NEXT_PUBLIC_API_BASE_URL` yoki env `https://molbazar.uz/api` | Admin production’da mahsulotlar ro‘yxati ochiladi |
| 3.2 | **Login** — admin email orqali OTP keladi va kirish ishlaydi | Admin panelga kirish va “Mahsulotlar” sahifasi |
| 3.3 | **Deploy** — Vercel / serverda build va domain (masalan admin.molbazar.uz) | Brauzerda admin panel ochiladi |

---

## 4. Xavfsizlik va barqarorlik

| # | Ishlar | Qanday tekshirish |
|---|--------|-------------------|
| 4.1 | **Git** — `.env`, `node_modules` `.gitignore` da; maxfiy ma’lumotlar commit qilinmagan | `git status`, repo ichida `.env` yo‘q |
| 4.2 | **Rate limit** — backend’da `/api` uchun rate limit yoqilgan (masalan daqiqada 120 so‘rov) | `src/app.js` da `express-rate-limit` |
| 4.3 | **HTTPS** — molbazar.uz va admin faqat HTTPS orqali | Brauzerda qulf ikonkasi |
| 4.4 | **DB backup** — PostgreSQL uchun muntazam backup (cron yoki xizmat) | Backup fayllar mavjud va tekshirilgan |

---

## 5. Chiqishdan oldin bir martalik tekshiruv

1. **Backend:** `curl -s https://molbazar.uz/api/health` → `"ok":true`
2. **Backend listings:** `curl -s "https://molbazar.uz/api/listings?page=1&limit=5"` → `"ok":true`, `items` massiv
3. **Mobil ilova:** Production build yoki Expo Go’da API URL = `https://molbazar.uz/api` — Asosiy, Qidiruv, E’lon berish, Profil ishlaydi
4. **Admin:** Kirish → Mahsulotlar → bitta e’lonni tahrirlash / tasdiqlash → xato yo‘q

---

## Qisqacha

- Backend: env to‘g‘ri, migratsiya o‘tgan, PM2 ishlaydi, API health va listings javob beradi.
- Ilova: production’da API = `https://molbazar.uz/api`, app.json/scheme/rasmlar tayyor.
- Admin: production API ulangan, login va mahsulotlar ishlaydi.
- Xavfsizlik: env commit qilinmagan, rate limit yoqilgan, HTTPS, backup rejasi bor.

Bular bajarilganda bozorga chiqganda kutilmagan buzilishlar kamayadi.
