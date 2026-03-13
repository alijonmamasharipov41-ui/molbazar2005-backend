# Database schema (molbazar2005-backend)

## 1. `listings` jadvali

| Column         | Type                     | Default / Constraint |
|----------------|--------------------------|----------------------|
| id             | SERIAL                   | PRIMARY KEY          |
| user_id        | INT                      | REFERENCES users(id) ON DELETE CASCADE |
| title          | TEXT                     | NOT NULL             |
| description    | TEXT                     | DEFAULT ''           |
| price          | NUMERIC                  | NOT NULL, DEFAULT 0  |
| region         | TEXT                     | DEFAULT ''           |
| district       | TEXT                     | DEFAULT ''           |
| created_at     | TIMESTAMP                | DEFAULT NOW()        |
| category_id    | INT                      | REFERENCES categories(id), nullable |
| phone          | TEXT                     | nullable             |
| product_type   | TEXT                     | nullable             |
| status         | TEXT                     | NOT NULL, DEFAULT 'pending', CHECK (pending/approved/rejected) |
| phone_visible  | BOOLEAN                  | DEFAULT false        |
| yoshi          | TEXT                     | DEFAULT ''           |
| zoti           | TEXT                     | DEFAULT ''           |
| jinsi          | TEXT                     | DEFAULT ''           |
| vazn           | TEXT                     | DEFAULT ''           |
| category_slug  | TEXT                     | DEFAULT ''           |
| region_id      | INT                      | REFERENCES regions(id) ON DELETE SET NULL |
| district_id    | INT                      | REFERENCES districts(id) ON DELETE SET NULL |
| weight         | DECIMAL(15,2)            | nullable             |
| unit           | VARCHAR(20)              | nullable             |
| search_vector  | tsvector                 | nullable (full-text search) |

**Indexlar (listings):**

| Index name                    | Definition                          |
|------------------------------|-------------------------------------|
| listings_pkey                | PRIMARY KEY (id)                    |
| idx_listings_created_at      | (created_at DESC)                   |
| idx_listings_category        | (category_id)                       |
| idx_listings_region          | (region)                            |
| idx_listings_price           | (price)                             |
| idx_listings_status          | (status)                            |
| idx_listings_user_id         | (user_id)                           |
| idx_listings_category_slug   | (category_slug)                     |
| idx_listings_district        | (district)                          |
| idx_listings_location        | (region_id, district_id)            |
| idx_listings_search_vector   | GIN (search_vector)                 |

---

## 2. `categories` jadvali

| Column     | Type      | Default / Constraint |
|------------|-----------|----------------------|
| id         | SERIAL    | PRIMARY KEY          |
| name       | TEXT      | NOT NULL             |
| parent_id  | INT       | REFERENCES categories(id) ON DELETE CASCADE, nullable |
| created_at | TIMESTAMP | DEFAULT NOW()        |

**Indexlar (categories):**

| Index name       | Definition        |
|------------------|-------------------|
| categories_pkey  | PRIMARY KEY (id)  |

---

## 3. `regions` jadvali

| Column | Type         | Default / Constraint |
|--------|--------------|----------------------|
| id     | SERIAL       | PRIMARY KEY          |
| name   | VARCHAR(100) | NOT NULL             |

**Indexlar (regions):**

| Index name    | Definition       |
|---------------|------------------|
| regions_pkey  | PRIMARY KEY (id) |

---

## 4. `districts` jadvali

| Column    | Type         | Default / Constraint |
|-----------|--------------|----------------------|
| id        | SERIAL       | PRIMARY KEY          |
| name      | VARCHAR(100) | NOT NULL             |
| region_id | INT          | NOT NULL, REFERENCES regions(id) ON DELETE CASCADE |

**Indexlar (districts):**

| Index name             | Definition              |
|------------------------|-------------------------|
| districts_pkey         | PRIMARY KEY (id)        |
| idx_districts_region_id| (region_id)             |

---

*Migratsiyalar: `src/sql/001_init.sql` … `026_listings_fulltext_search.sql`*
