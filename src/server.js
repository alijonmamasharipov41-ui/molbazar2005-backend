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
      const files = ["001_init.sql", "002_categories_listings.sql", "003_users_profile.sql", "004_listing_images.sql", "005_listing_images_index.sql", "006_favorites.sql", "007_chat.sql", "008_banners.sql", "008_add_phone_and_product_type.sql", "009_token_version.sql", "010_otp_email_auth.sql", "011_otp_attempt_limit.sql", "012_analytics_events.sql", "013_analytics_daily.sql", "014_analytics_app_login.sql", "015_admin_audit_log.sql", "016_phone_visible.sql", "017_listing_details.sql", "018_listing_category_slug.sql", "019_ensure_listings_created_at.sql", "020_listings_indexes.sql", "021_regions_districts.sql", "022_listings_region_district_fk.sql", "023_listing_weight_unit.sql", "024_ensure_listings_category_id.sql", "025_seed_regions_districts.sql", "026_listings_fulltext_search.sql", "027_search_performance_indexes.sql", "028_search_vector_yoshi_zoti.sql", "029_user_listing_cascade.sql", "030_support_tickets.sql", "031_support_ticket_replies.sql", "032_support_chat.sql"];
      for (const file of files) {
        const sqlPath = path.join(sqlDir, file);
        if (!fs.existsSync(sqlPath)) continue;
        const sql = fs.readFileSync(sqlPath, "utf8").trim();
        if (!sql) continue;
        // Execute the whole file in one go.
        // This avoids breaking PL/pgSQL functions/triggers that contain semicolons.
        await query(sql);
      }
      console.log("Migrations completed.");
      process.exit(0);
    } catch (err) {
      const msg = process.env.NODE_ENV === "production" ? (err.message || "Migration failed") : err;
      console.error("Migration failed:", msg);
      process.exit(1);
    }
  })();
} else {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 ${APP_NAME} — ${PORT}\n`);
  });
}
