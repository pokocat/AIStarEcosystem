-- 配音（TTS）预览时间线。一个项目最多一行：timeline_hash 是「segments 文案 + voiceId」的指纹，
-- 文案或音色一变就地作废并重算，不留历史版本 —— 预览是一次性的确认物，不是作品。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java 两处
-- （见本目录 README.md）。V24（java）、V25（sql）已占用，故本次开 V26。已执行的迁移一律不改。
CREATE TABLE clip_tts_preview (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    external_owner_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    timeline_hash VARCHAR(96) NOT NULL,
    voice_id VARCHAR(64) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'generating',
    -- {"items":[{"no":1,"role":"avatar","audioCdnKey":"…","actualDurationSec":6.4,"estimateDurationSec":6}]}
    -- 存的是我方存储 key，**不存签名 URL**：签名有 TTL，落库就等于埋一个几小时后必然 403 的雷。
    segments_json TEXT NULL,
    total_duration_sec DOUBLE NOT NULL DEFAULT 0,
    -- Scheme A：clip 域不碰钻石账本，这里恒为 0；非 0 表示调用方需要先 hold（见 BUSINESS_RULES）。
    credits INT NOT NULL DEFAULT 0,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    attempts INT NOT NULL DEFAULT 0,
    lease_owner VARCHAR(64) NULL,
    lease_until DATETIME(6) NULL,
    heartbeat_at DATETIME(6) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    CONSTRAINT uk_clip_tts_preview_project UNIQUE (external_owner_id, project_id)
);
CREATE INDEX idx_clip_tts_preview_status ON clip_tts_preview(status, heartbeat_at);
