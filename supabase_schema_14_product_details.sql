-- Add product detail columns to creative_tracks
ALTER TABLE creative_tracks
ADD COLUMN product_price numeric(10,2),
ADD COLUMN product_shipping numeric(10,2),
ADD COLUMN product_free_shipping boolean DEFAULT false,
ADD COLUMN product_reviews integer,
ADD COLUMN product_sold integer,
ADD COLUMN product_rating numeric(3,1);

-- Notify postgrest to reload cache
NOTIFY pgrst, 'reload schema';
