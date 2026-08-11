-- 「快出片」独立业务域。四张表不依赖 AIStar 本地 user 表：真属主是军师 BFF 下发的
-- external_owner_id，避免复制身份或建立脆弱的跨库外键。

CREATE TABLE IF NOT EXISTS clip_template (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  industry VARCHAR(64) NOT NULL,
  theme_key VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  owner_scope VARCHAR(16) NOT NULL DEFAULT 'official',
  script_skeleton_json TEXT NOT NULL,
  timeline_json TEXT NULL,
  tail_clips_json TEXT NULL,
  broll_pool_json TEXT NULL,
  preview_cover_key VARCHAR(512) NULL,
  preview_video_key VARCHAR(512) NULL,
  ratio VARCHAR(8) NOT NULL DEFAULT '9:16',
  est_duration_sec INT NOT NULL DEFAULT 0,
  avatar_sec_hint INT NOT NULL DEFAULT 0,
  credit_hint INT NULL,
  created_at TIMESTAMP(6) NULL,
  updated_at TIMESTAMP(6) NULL,
  deleted_at TIMESTAMP(6) NULL
);
CREATE INDEX idx_clip_template_status ON clip_template (status, industry, theme_key);

CREATE TABLE IF NOT EXISTS clip_project (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  owner_user_id VARCHAR(64) NULL,
  external_owner_id VARCHAR(128) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  payload_json TEXT NOT NULL,
  duration_sec INT NOT NULL DEFAULT 0,
  avatar_seconds INT NOT NULL DEFAULT 0,
  segment_count INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  step INT NOT NULL DEFAULT 1,
  credits_held INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(6) NULL,
  updated_at TIMESTAMP(6) NULL,
  deleted_at TIMESTAMP(6) NULL
);
CREATE INDEX idx_clip_project_external_owner ON clip_project (external_owner_id, updated_at);
CREATE INDEX idx_clip_project_status ON clip_project (status, updated_at);

CREATE TABLE IF NOT EXISTS clip_render_job (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  external_owner_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  client_request_id VARCHAR(100) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  stage VARCHAR(24) NOT NULL DEFAULT 'tts',
  progress INT NOT NULL DEFAULT 0,
  heartbeat_at TIMESTAMP(6) NULL,
  lease_owner VARCHAR(64) NULL,
  lease_until TIMESTAMP(6) NULL,
  credits_held INT NOT NULL DEFAULT 0,
  segment_jobs_json TEXT NULL,
  output_cdn_key VARCHAR(512) NULL,
  thumbnail_cdn_key VARCHAR(512) NULL,
  duration_sec INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(6) NULL,
  updated_at TIMESTAMP(6) NULL,
  completed_at TIMESTAMP(6) NULL
);
CREATE INDEX idx_clip_job_external_owner ON clip_render_job (external_owner_id, created_at);
CREATE INDEX idx_clip_job_status_heartbeat ON clip_render_job (status, heartbeat_at);
CREATE UNIQUE INDEX idx_clip_job_request ON clip_render_job (external_owner_id, client_request_id);

CREATE TABLE IF NOT EXISTS clip_asset (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  external_owner_id VARCHAR(128) NULL,
  kind VARCHAR(16) NOT NULL,
  label VARCHAR(128) NOT NULL,
  tag VARCHAR(128) NULL,
  local_path VARCHAR(1024) NULL,
  cdn_key VARCHAR(512) NULL,
  thumbnail_cdn_key VARCHAR(512) NULL,
  mime_type VARCHAR(128) NOT NULL,
  bytes BIGINT NOT NULL DEFAULT 0,
  duration_sec DOUBLE NOT NULL DEFAULT 0,
  used_count INT NOT NULL DEFAULT 0,
  preset BOOLEAN NOT NULL DEFAULT FALSE,
  preset_group VARCHAR(64) NULL,
  created_at TIMESTAMP(6) NULL,
  deleted_at TIMESTAMP(6) NULL
);
CREATE INDEX idx_clip_asset_owner_kind ON clip_asset (external_owner_id, kind);
CREATE INDEX idx_clip_asset_preset ON clip_asset (preset, kind);

-- DapAvatar.engine_source_key、DapAvatar/DapVoice 的石榴状态字段继续由当前
-- ddl-auto=update 补列；Flyway 完整接管 schema 后再迁入版本化 ALTER（TODO 已登记）。
