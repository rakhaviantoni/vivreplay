PRAGMA defer_foreign_keys = ON;
CREATE TABLE sealed_migration_offers AS SELECT * FROM listing_offers;
CREATE TABLE sealed_migration_messages AS SELECT * FROM listing_offer_messages;
CREATE TABLE sealed_migration_attachments AS SELECT * FROM listing_offer_attachments;
CREATE TABLE sealed_migration_saved AS SELECT * FROM market_saved_listings;
CREATE TABLE listings_sealed_new (
 id TEXT PRIMARY KEY NOT NULL,
 seller_id TEXT NOT NULL REFERENCES profiles(id),
 printing_id TEXT REFERENCES card_printings(id),
 sealed_product_id TEXT REFERENCES tcg_sealed_products(id),
 instance_id TEXT REFERENCES collectible_instances(id),
 title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), currency TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0), condition TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'WTS',city TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',
 demo INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT,items TEXT,negotiable INTEGER NOT NULL DEFAULT 1,
 CHECK((printing_id IS NOT NULL AND sealed_product_id IS NULL) OR (printing_id IS NULL AND sealed_product_id IS NOT NULL))
);
INSERT INTO listings_sealed_new(id,seller_id,printing_id,instance_id,title,amount,currency,quantity,condition,type,city,status,demo,created_at,expires_at,items,negotiable)
 SELECT id,seller_id,printing_id,instance_id,title,amount,currency,quantity,condition,type,city,status,demo,created_at,expires_at,items,negotiable FROM listings;
DROP TABLE listings;
ALTER TABLE listings_sealed_new RENAME TO listings;
CREATE INDEX listing_printing_status ON listings(printing_id,status);
CREATE INDEX listing_status_expires ON listings(status,expires_at);
CREATE INDEX listing_sealed_status ON listings(sealed_product_id,status);
INSERT OR IGNORE INTO listing_offers SELECT * FROM sealed_migration_offers;
INSERT OR IGNORE INTO listing_offer_messages SELECT * FROM sealed_migration_messages;
INSERT OR IGNORE INTO listing_offer_attachments SELECT * FROM sealed_migration_attachments;
INSERT OR IGNORE INTO market_saved_listings SELECT * FROM sealed_migration_saved;
DROP TABLE sealed_migration_offers;
DROP TABLE sealed_migration_messages;
DROP TABLE sealed_migration_attachments;
DROP TABLE sealed_migration_saved;
CREATE TABLE market_product_photos(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES profiles(id),object_key TEXT NOT NULL,mime TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
