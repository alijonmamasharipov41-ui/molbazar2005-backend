# GitHub → VPS: yangiliklarni ishga tushirish

Barcha o‘zgarishlar (yoshi, zoti, jinsi, vazn, category_slug va boshqalar) ishlashi uchun quyidagilarni bajaring.

---

## 1. GitHub ga push qilish (lokal mashinada)

```bash
# Backend
cd /Users/macbookair/molbazar2005-backend
git add .
git commit -m "Listing: yoshi, zoti, jinsi, vazn, category_slug, migratsiyalar"
git push origin main
```

Agar **admin panel** va **mobil ilova** ham alohida repolar bo‘lsa, ularni ham push qiling:

```bash
# Admin (agar alohida repo bo'lsa)
cd /Users/macbookair/Molbazar.Admin
git add .
git commit -m "Listing: category_slug, yoshi, zoti, jinsi, vazn"
git push origin main
```

```bash
# Mobil ilova (agar alohida repo bo'lsa)
cd /Users/macbookair/molbozor-mobile
git add .
git commit -m "Listing: category_slug, chorva tur+sub, barcha maydonlar"
git push origin main
```

---

## 2. VPS da backend yangilash

SSH orqali VPS ga kiring, keyin:

```bash
# Backend papkasiga o‘ting (o‘zingizning yo‘lingiz bo‘yicha)
cd /path/to/molbazar2005-backend   # masalan: cd ~/molbazar2005-backend

# Oxirgi kodni GitHub dan oling
git pull origin main

# Yangi dependency bo‘lsa (package.json o‘zgarganda)
npm install

# ⚠️ MAJHURIY: Migratsiya — buni esdan chiqarmang (yangi ustunlar bazaga qo‘shiladi)
node src/server.js --migrate

# Backendni qayta ishga tushiring
# Agar PM2 ishlatilsa:
pm2 restart molbazar2005-backend
# yoki
pm2 restart all

# Agar systemd ishlatilsa:
sudo systemctl restart molbazar-backend
```

**Eslatma:** "Akkauntni o'chirish" (DELETE /api/users/me) ishlashi uchun serverta yangi backend kodi bo‘lishi kerak. Agar ilovada akkaunt o‘chirishda "Not found" chiqsa, backendni yuqoridagi qadamlarga ko‘ra qayta deploy qiling (`git pull`, `pm2 restart`).

---

## 3. Migratsiya bajarildi-yo‘qligini tekshirish

VPS da:

```bash
psql $DATABASE_URL -c "\d listings"
```

Chiqishda quyidagi ustunlar bo‘lishi kerak: `phone_visible`, `yoshi`, `zoti`, `jinsi`, `vazn`, `category_slug`. Agar yo‘q bo‘lsa, migratsiyani qayta ishga tushiring:

```bash
node src/server.js --migrate
```

---

## 4. Admin panel (VPS da host qilinsa)

Agar admin panel ham VPS da (Next.js build) ishlayotgan bo‘lsa:

```bash
cd /path/to/Molbazar.Admin   # yoki molbozor-admin
git pull origin main
npm install
npm run build
pm2 restart admin
# yoki qanday ishga tushiryotganingizga qarab
```

---

## 5. Mobil ilova

- **Expo / EAS:** yangi build yoki OTA yangilanish chiqarib, foydalanuvchilarga yangi versiyani yuklashni taklif qiling.
- **Lokal test:** `npx expo start` — API endi VPS dagi backendga ulanadi (`.env` da `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_API_BASE_URL` = `https://molbazar.uz/api`).

---

## Qisqa ro‘yxat

| Qadam | Qayerda | Amal |
|-------|---------|------|
| 1 | Lokal | Backend / Admin / Mobile kodni GitHub ga **push** |
| 2 | VPS | Backend papkada **git pull** |
| 3 | VPS | **npm install** (kerak bo‘lsa) |
| 4 | VPS | **`node src/server.js --migrate`** — esdan chiqarmang |
| 5 | VPS | Backendni **restart** (pm2 yoki systemd) |
| 6 | VPS | Admin panelni **pull + build + restart** (agar VPS da bo‘lsa) |
| 7 | - | Mobil ilovaga yangi build/OTA berish (kerak bo‘lsa) |

Shundan keyin barcha yangi ustunlar va kategoriya/tur ma’lumotlari ishlaydi.
