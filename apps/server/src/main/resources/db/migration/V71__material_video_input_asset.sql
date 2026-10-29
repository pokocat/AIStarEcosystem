-- Supplier audio receipts are scoped by a hash of endpoint/address/model/credential/source key.
-- The owned OSS source remains authoritative; expiry never removes the character's voice binding.
CREATE TABLE material_video_input_asset (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    source_key VARCHAR(512) NOT NULL,
    asset_id VARCHAR(255) NOT NULL,
    expires_at DATETIME(6) NULL
);
