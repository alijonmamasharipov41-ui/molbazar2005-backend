-- Performance index for listing_images.listing_id (idempotent)

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id
ON listing_images(listing_id);
