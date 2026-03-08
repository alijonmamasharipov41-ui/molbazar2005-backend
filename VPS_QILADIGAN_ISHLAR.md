# VPS da qiladigan ishlar

Mahsulotlar ustunlari, banner tizimi va boshqa o‘zgarishlar ishlashi uchun VPS da quyidagilarni bajaring.

---

## 1. VPS ga ulanish

```bash
ssh root@SIZNING_VPS_IP
# yoki
ssh foydalanuvchi@molbazar.uz
```

---

## 2. Backend papkasiga o‘tish

```bash
cd /path/to/molbazar2005-backend
```

Masalan: `cd ~/molbazar2005-backend` yoki `cd /var/www/molbazar2005-backend` (qayerda clone qilgan bo‘lsangiz).

---

## 3. GitHub dan yangi kodni olish

```bash
git pull origin main
```

Agar `Permission denied` yoki `branch` xatosi chiqsa, avval `git status` qiling va kerak bo‘lsa `git fetch origin` keyin `git pull origin main`.

---

## 4. Dependency’larni o‘rnatish (ixtiyoriy)

Agar `package.json` o‘zgargan bo‘lsa:

```bash
npm install
```

---

## 5. Migratsiyani ishga tushirish (majburiy)

Bu qadam **muhim**. Unda bazaga quyidagilar qo‘shiladi:

- **listings** jadvali: `phone_visible`, `yoshi`, `zoti`, `jinsi`, `vazn`, `category_slug` ustunlari
- **banners** jadvali (agar yo‘q bo‘lsa) — admin panelda bannerlar uchun

```bash
node src/server.js --migrate
```

Muvaffaqiyatli bo‘lsa ekranda: **Migrations completed.**

Xato chiqsa: `DATABASE_URL` to‘g‘ri ekanini va PostgreSQL ishlayotganini tekshiring.

---

## 6. Backendni qayta ishga tushirish

**PM2 ishlatilsa:**

```bash
pm2 restart molbazar2005-backend
# yoki barcha protsesslar uchun:
pm2 restart all
```

**systemd ishlatilsa:**

```bash
sudo systemctl restart molbazar-backend
```

**Boshqa usul** (masalan, `npm start` bilan qo‘lda ishga tushiryotgan bo‘lsangiz):  
protsessni to‘xtating (Ctrl+C) va qayta `npm start` yoki `node src/server.js` ishga tushiring.

---

## 7. Tekshirish

- Brauzerda: `https://molbazar.uz/api/...` (yoki sizning backend URL) ochilishi kerak.
- Admin panelda: Bannerlar sahifasi xato bermasligi, mahsulotlar to‘liq ustunlar bilan ko‘rinishi kerak.
- Ilovada: E’lon berishda barcha maydonlar (yoshi, zoti, jinsi, vazn, kategoriya) saqlanadi va bannerlar bosh sahifada chiqadi.

---

## Qisqa buyruqlar (bitta ketma-ketlik)

```bash
cd /path/to/molbazar2005-backend
git pull origin main
npm install
node src/server.js --migrate
pm2 restart molbazar2005-backend
```

Shundan keyin VPS dagi backend yangi migratsiyalar va kod bilan ishlaydi.

---

## Admin banner qo‘yadi, ilovada ko‘rinmayapti

- **Admin** va **ilova** bir xil backend’dan ma’lumot olishi kerak. Agar admin **localhost**da ishlab, bannerlarni **localhost** backend’ga yozsa, ilova **https://molbazar.uz/api** dan olganda bu bannerlarni ko‘rmaydi.
- **Admin panel .env** da quyidagi bo‘lishi kerak:
  ```env
  NEXT_PUBLIC_API_BASE_URL=https://molbazar.uz/api
  ```
  Agar `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api` bo‘lsa, banner faqat kompyuteringizdagi bazaga yoziladi — **o‘zgartiring**: `https://molbazar.uz/api` qiling.
- **Yechim:** Admin panelni VPS dagi backend’ga ulang. Bannerlarni shu admin orqali qo‘shing — ular molbazar.uz bazasiga yoziladi va ilova ko‘radi.
- **VPS da** `node src/server.js --migrate` bajarilgan bo‘lishi kerak (banners jadvali mavjud bo‘ladi).
- **Muddat:** "Muddat (reklama tugash sanasi)" da **kelajak** sana tanlang; o‘tgan sana bo‘lsa ilova bannerlarni ko‘rsatmaydi.
