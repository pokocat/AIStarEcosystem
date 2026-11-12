ALTER TABLE video_asset_library ADD COLUMN portrait_upload_after timestamptz(6);
ALTER TABLE video_asset_portrait ADD COLUMN review_after timestamptz(6);
CREATE INDEX idx_video_portrait_dispatch ON video_asset_portrait (library_id, status, declared_at, id);
CREATE INDEX idx_video_portrait_review ON video_asset_portrait (status, review_after, updated_at, id);
