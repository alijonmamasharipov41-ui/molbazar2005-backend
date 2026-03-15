# Yordam markazi (Support Center) API

## Database

- **support_tickets**: `id` (PK), `user_id` (FK → users.id ON DELETE CASCADE), `subject` (varchar 500), `message` (text), `status` (default `open`), `created_at`.
- Migratsiya: `030_support_tickets.sql` (server ishga tushganda `node src/server.js --migrate`).

## Endpointlar

### Foydalanuvchi (Auth kerak)

| Method | Path | Tavsif |
|--------|------|--------|
| POST | /api/support | Xabar yuborish. Body: `{ "subject": "...", "message": "..." }`. |

### Admin (Auth + isAdmin)

| Method | Path | Tavsif |
|--------|------|--------|
| GET | /api/admin/support | Barcha shikoyatlar (user: email, full_name, phone bilan). |
| GET | /api/admin/support/:id/replies | Shikoyat bo'yicha admin javoblari. |
| POST | /api/admin/support/:id/reply | Javob yuborish. Body: `{ "message": "..." }`. Javob foydalanuvchi Chat bo'limida ko'rinadi. |
| PATCH | /api/admin/support/:id | Statusni o'zgartirish. Body: `{ "status": "closed" \| "resolved" \| "open" }`. |
| DELETE | /api/admin/support/:id | Shikoyatni o'chirish. |

## Middleware

- **auth** — POST /api/support va barcha admin support endpointlari uchun.
- **isAdmin** — GET/PATCH/DELETE /api/admin/support uchun (faqat `role === 'admin'`).

## Xatoliklar

- Barcha route'larda try-catch, xato `next(err)` orqali errorHandler ga yuboriladi.
- Log: `console.error("[support] ...")` va `[admin/support] ...`.
