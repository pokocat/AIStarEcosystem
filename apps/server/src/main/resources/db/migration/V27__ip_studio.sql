-- AI IP 工作台（apps/web-ipstudio，v0.151）—— 画布项目 + 节点运行。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java 两处
-- （见本目录 README.md）。V24（java）、V25、V26（sql）已占用，故本次开 V27。已执行的迁移一律不改。
--
-- 两张表都是**全新表**，且没有任何 ddl-auto 先建出来的历史形态，所以用 .sql 而不是 Java 迁移。
-- 语法保持 H2 (MODE=MySQL) 与 MySQL 双通：LONGTEXT / DATETIME(6) 在两边都可用，
-- 不用 MySQL 专有的 ENGINE / CHARSET 子句。
CREATE TABLE ip_project (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    template_id VARCHAR(64) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    -- IpProjectDoc（nodes/edges/viewport）整存整取。客户端拥有、服务端逐字保存：
    -- 运行结果与发布结果一律另存（ip_run / dap_*），否则前端 1.2s 防抖 PUT 与异步 worker
    -- 会互相覆盖（v0.101「只 upsert 实体表、不重写 payloadJson」同一条教训）。
    doc_json LONGTEXT NOT NULL,
    -- 主形象选中图的 storage key。真值是 key，coverUrl 出 wire 时才签名派生（§4.7.4）。
    cover_key VARCHAR(512) NULL,
    published_avatar_id VARCHAR(32) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL
);
CREATE INDEX idx_ip_project_owner ON ip_project(owner_user_id, deleted_at);

CREATE TABLE ip_run (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    project_id VARCHAR(32) NOT NULL,
    owner_user_id VARCHAR(64) NOT NULL,
    node_id VARCHAR(64) NOT NULL,
    -- identity | generate
    kind VARCHAR(16) NOT NULL,
    -- running | done | failed（wire 三态，与 dap_job 一致）
    status VARCHAR(16) NOT NULL,
    stage VARCHAR(64) NULL,
    pct INT NOT NULL DEFAULT 0,
    -- 真实账本值：running=冻结额 / done=已 commit 之和 / failed=已 commit 的部分（可能为 0）
    cost BIGINT NOT NULL DEFAULT 0,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    -- IpRunInputs：实际英文提示词 + 参考图生效回报 + size/count；
    -- _exec 段是服务端执行参数（含 storage key），出 wire 时剥掉。
    input_json LONGTEXT NULL,
    -- IpRunOutput：identity 的 text/promptEn；generate 的 candidates[{key}]。
    -- **只存 key，不存签名 URL** —— 签名有 TTL，落库就是埋一个几小时后必然 403 的雷。
    output_json LONGTEXT NULL,
    cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NULL,
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    heartbeat_at DATETIME(6) NULL
);
-- 同节点重跑不删旧行（用户可能仍在用旧运行里选中的候选图），故按 (project,node,created) 取最新。
CREATE INDEX idx_ip_run_project_node ON ip_run(project_id, node_id, created_at);
-- IpRunReaper 扫僵死运行。
CREATE INDEX idx_ip_run_status ON ip_run(status, heartbeat_at);
