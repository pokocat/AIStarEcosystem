CREATE TABLE studio_media_job (
    id VARCHAR(40) PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL,
    input_json TEXT NOT NULL,
    result_json TEXT,
    error_code VARCHAR(64),
    error_message VARCHAR(512),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    lease_until BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_studio_media_job_dispatch ON studio_media_job(state, lease_until, created_at);
CREATE INDEX idx_studio_media_job_owner ON studio_media_job(owner_user_id, created_at);
