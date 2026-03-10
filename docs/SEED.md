# Kategoriyalar va ma'lumotlarni kiriting

## Kategoriyalar bo'sh bo'lsa (0 rows)

VPS da:

```bash
cd /path/to/molbazar2005-backend
sudo -u postgres psql molbozor -f src/sql/seed_categories.sql
```

Yoki psql ichida:

```bash
sudo -u postgres psql molbozor
\i /to'liq/yo'l/molbazar2005-backend/src/sql/seed_categories.sql
```

Bundan keyin `SELECT * FROM categories;` — 5 ta kategoriya (Chorva, Parandalar, Baliqlar, Don, Yemish) chiqadi.

**Mahsulotlar (e'lonlar)** foydalanuvchilar ilova orqali qo'shadi; faqat **kategoriyalar** jadvalini seed qilish kerak.
