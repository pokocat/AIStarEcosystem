-- 段级（单镜头）生成任务。整片出片走 clip_render_job，这张只管「第 N 个镜头单独重生成一次」。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java
-- 两处（见本目录 README.md），已占用到 V32（V31/V32 是 sql，V29/V30 是 java），故本次开 V33。
--
-- 为什么不复用 clip_render_job：那张表一行 = 一条成片，status/stage 的语义是整片流水线的
-- 阶段机；段级任务没有 stage，只有「这一镜跑没跑完」，硬塞进去两边的状态机都会变形。
--
-- 钱的口径直接刻在列上：quoted_credits 是**报价**（下单时算出来冻在这一单上的数），
-- credits 是**实扣**。credits 只在 status 落到 succeeded 的那一刻才从 quoted_credits 抄过来，
-- 失败 / 取消永远停在 0 —— 「成功才扣」不是注释里的承诺，是这两列的差。
CREATE TABLE clip_shot_job (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    external_owner_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    -- 镜头序号（ClipShotPlan.materialize 后的第几镜，从 1 开始），不是句号
    shot_no INT NOT NULL,
    client_request_id VARCHAR(100) NOT NULL,
    model VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'queued',
    progress INT NOT NULL DEFAULT 0,
    quoted_credits INT NOT NULL DEFAULT 0,
    credits INT NOT NULL DEFAULT 0,
    -- 端上算的缓存键。同一镜同指纹再提交直接回产物，不重跑也不重扣。
    fingerprint VARCHAR(128) NULL,
    prompt TEXT NULL,
    -- 产物存我方存储 key，**不存签名 URL**：签名有 TTL，落库等于埋一个几小时后必然 403 的雷。
    artifact_cdn_key VARCHAR(512) NULL,
    artifact_poster_cdn_key VARCHAR(512) NULL,
    artifact_duration_sec DOUBLE NOT NULL DEFAULT 0,
    engine_task_id VARCHAR(128) NULL,
    audio_cdn_key VARCHAR(512) NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    mock BOOLEAN NOT NULL DEFAULT FALSE,
    lease_owner VARCHAR(64) NULL,
    lease_until TIMESTAMP(6) NULL,
    heartbeat_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NULL,
    updated_at TIMESTAMP(6) NULL,
    completed_at TIMESTAMP(6) NULL,
    CONSTRAINT uk_clip_shot_job_request UNIQUE (external_owner_id, client_request_id)
);
CREATE INDEX idx_clip_shot_job_shot ON clip_shot_job (external_owner_id, project_id, shot_no, created_at);
CREATE INDEX idx_clip_shot_job_status_heartbeat ON clip_shot_job (status, heartbeat_at);
