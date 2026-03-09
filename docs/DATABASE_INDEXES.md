# Database indexlar — tekshiruv

## Listings jadvali

| Ustun / maqsad | Indeks | Fayl | Izoh |
|----------------|--------|------|------|
| `created_at` (tartib, yangilar birinchi) | `idx_listings_created_at` | 001, 002 | ✅ Mavjud |
| `category_id` (kategoriya filter) | `idx_listings_category` | 002 | ✅ Mavjud |
| `region` (viloyat filter) | `idx_listings_region` | 002 | ✅ Mavjud |
| `price` (narx oralig‘i) | `idx_listings_price` | 002 | ✅ Mavjud |
| `user_id` (profil "e'lonlarim", JOIN users) | `idx_listings_user_id` | 020 | ✅ 020 qo‘shildi |
| `status` (faqat approved) | `idx_listings_status` | 009 yoki 020 | ✅ 020 da IF NOT EXISTS |
| `category_slug` (chorva, don, …) | `idx_listings_category_slug` | 020 | ✅ 020 qo‘shildi |
| `district` (tuman filter) | `idx_listings_district` | 020 | ✅ 020 qo‘shildi |

## Boshqa jadvalar

- **listing_images**: `idx_listing_images_listing_id` (004, 005)
- **favorites**: `idx_favorites_user`, `idx_favorites_listing` (006)
- **chat**: conversations (buyer_id, seller_id), messages (conversation_id)
- **banners**: placement, priority
- **users**: email (unique)
- **otp_codes**: email
- **admin_audit_logs**: user_id, created_at
- **analytics_events**: event_type+created_at, listing_id, conversation_id

## Qo‘llash

```bash
node src/server.js --migrate
```

020_listings_indexes.sql barcha muhim listing indekslarini `IF NOT EXISTS` bilan qo‘shadi.
