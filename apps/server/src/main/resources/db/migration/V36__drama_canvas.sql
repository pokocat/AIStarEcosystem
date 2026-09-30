-- 短剧画布（web-drama /canvas，v0.198，设计真源 docs/drama-canvas-plan.md §3.1）
-- 两张表：画布文档 drama_canvas + 生成运行记录 drama_canvas_run。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java 两处
-- （见本目录 README.md）。写这条时两处最大都是 V35，故开 V36。
-- ** 部署前必须在线上基线核对 flyway_schema_history 的最大 version **（V20 撞号事故）：
--   SELECT version, script FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5
-- 撞了就改号；已执行的迁移一律不改。
--
-- 两张都是全新表、没有 ddl-auto 先建出来的历史形态，所以用 .sql（照 V27__ip_studio.sql）。
-- 语法保持 H2 (MODE=MySQL) 与 MySQL 双通：不写 ENGINE / CHARSET / COMMENT，不写 TINYINT(1)。
-- 列名与实体 DramaCanvas / DramaCanvasRun 一一对应（实体上的唯一索引同名声明，全新库 ddl-auto 也会有）。

CREATE TABLE drama_canvas (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    -- 9:16 或 16:9
    ratio VARCHAR(8) NOT NULL,
    -- DramaCanvasDoc 整存整取，只存资产 key，url 出 wire 时派生（AGENTS.md 4.7.4 / 4.7.7）。上限 4MB。
    doc_json LONGTEXT NOT NULL,
    -- sha256(规范化 JSON + NUL + 标题) 前 16 位 hex，只改标题也换版本
    doc_version VARCHAR(16) NOT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL
);
CREATE INDEX idx_drama_canvas_owner ON drama_canvas(owner_user_id, deleted_at, updated_at);

CREATE TABLE drama_canvas_run (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    canvas_id VARCHAR(32) NOT NULL,
    owner_user_id VARCHAR(64) NOT NULL,
    -- script | extract | image | storyboard | video | assemble
    kind VARCHAR(16) NOT NULL,
    -- script:setting / look:<id> / frame:<no>:<segmentId> / video:<no>:<segmentId> 等（drama-canvas.ts DramaCanvasRunTarget）
    target VARCHAR(128) NOT NULL,
    -- queued | running | succeeded | failed | canceled
    status VARCHAR(16) NOT NULL,
    -- 这次冻结 / 扣掉的积分（失败退回后仍保留原值，status 说明结果）
    cost BIGINT NOT NULL DEFAULT 0,
    -- 幂等键（前端生成）
    client_request_id VARCHAR(80) NULL,
    -- 出视频时的 MaterialVideoJob id
    job_id VARCHAR(64) NULL,
    -- 输入快照（单价快照、实际提示词、参考 key），只存 key
    input_json LONGTEXT NULL,
    -- DramaCanvasRunResult，只存 key。签名 URL 有 TTL，落库就是埋雷
    result_json LONGTEXT NULL,
    -- 参考图实际送到模型的情况 {requested, applied, notes}
    refs_json TEXT NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL
);
-- 幂等：同一个 (owner, clientRequestId) 只能有一行（重试 / 双击 / 两个标签页都回原记录，不重复扣费）。
CREATE UNIQUE INDEX uk_drama_canvas_run_owner_req ON drama_canvas_run(owner_user_id, client_request_id);
CREATE INDEX idx_drama_canvas_run_canvas ON drama_canvas_run(canvas_id, created_at);
CREATE INDEX idx_drama_canvas_run_job ON drama_canvas_run(job_id);
-- 扫僵死 / 在途运行
CREATE INDEX idx_drama_canvas_run_status ON drama_canvas_run(status, updated_at);
