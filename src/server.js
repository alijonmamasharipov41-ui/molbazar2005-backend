require("dotenv").config();

const path = require("path");
const fs = require("fs");
const { query } = require("./db");
const { APP_NAME, PORT } = require("./config");
const app = require("./app");

const isMigrate = process.argv.includes("--migrate");

if (isMigrate) {
  (async () => {
    try {
      const sqlDir = path.join(__dirname, "sql");
      const files = ["001_init.sql", "002_categories_listings.sql", "003_users_profile.sql", "004_listing_images.sql", "005_listing_images_index.sql", "006_favorites.sql", "007_chat.sql", "008_add_phone_and_product_type.sql", "009_token_version.sql", "010_otp_email_auth.sql", "011_otp_attempt_limit.sql", "012_analytics_events.sql", "013_analytics_daily.sql", "014_analytics_app_login.sql"];
      for (const file of files) {
        const sqlPath = path.join(sqlDir, file);
        if (!fs.existsSync(sqlPath)) continue;
        const sql = fs.readFileSync(sqlPath, "utf8");
        const statements = sql
          .split(/;\s*\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const statement of statements) {
          await query(statement + (statement.endsWith(";") ? "" : ";"));
        }
      }
      console.log("Migrations completed.");
      process.exit(0);
    } catch (err) {
      console.error("Migration failed:", err);
      process.exit(1);
    }
  })();
} else {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 ${APP_NAME} — ${PORT}\n`);
  });
}
