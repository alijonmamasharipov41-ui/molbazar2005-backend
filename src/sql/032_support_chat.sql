-- =========================================
-- 032_support_chat.sql
-- Yordam markazi javoblarini ilova Chat bo'limida ko'rsatish: support conversation.
-- =========================================

-- Tizim foydalanuvchisi: Chat ro'yxatida "Molbazar Yordam" ko'rinadi
INSERT INTO users (email, full_name, role)
  SELECT 'support@molbazar.uz', 'Molbazar Yordam', 'user'
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'support@molbazar.uz');

-- conversations: listing_id ixtiyoriy, support uchun type = 'support'
ALTER TABLE conversations
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'listing';

-- Bir foydalanuvchiga bitta support conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_support_buyer
  ON conversations(buyer_id) WHERE type = 'support';

COMMENT ON COLUMN conversations.type IS 'listing = e''lon asosida, support = yordam markazi';
