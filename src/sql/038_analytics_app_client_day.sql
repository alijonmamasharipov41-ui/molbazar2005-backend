-- Ilova ochilishlari: har bir qurilma (client_id) + kun — noyob DAU; qayta kirish sessiya sanagi

CREATE TABLE IF NOT EXISTS analytics_app_client_day (
  day DATE NOT NULL,
  client_id TEXT NOT NULL,
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  session_opens INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, client_id)
);

CREATE INDEX IF NOT EXISTS idx_aacd_day ON analytics_app_client_day (day DESC);
CREATE INDEX IF NOT EXISTS idx_aacd_client ON analytics_app_client_day (client_id);
