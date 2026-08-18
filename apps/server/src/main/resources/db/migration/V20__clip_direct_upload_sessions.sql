-- 快出片本人素材改为「客户端一次直传 OSS + 服务端异步受理」。
-- owner + client_request_id 唯一，网络重试只能回到同一会话，不能重复创建供应商任务。
CREATE TABLE clip_upload_session (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    external_owner_id VARCHAR(128) NOT NULL,
    client_request_id VARCHAR(100) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    object_key VARCHAR(512) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    declared_bytes BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'issued',
    avatar_id VARCHAR(64) NULL,
    voice_id VARCHAR(64) NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    CONSTRAINT uk_clip_upload_owner_request UNIQUE (external_owner_id, client_request_id)
);
CREATE INDEX idx_clip_upload_status_updated ON clip_upload_session(status, updated_at);
