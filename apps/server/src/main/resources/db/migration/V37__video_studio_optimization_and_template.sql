-- 视频生成区（web-celebrity「AI 创作 → 视频生成」，v0.198）：智能优化记录 + 模板（docs/video-studio-plan.md §9 / §10）。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java 两处（见本目录 README.md）。
-- 主干最新是 V35，另一个尚未合并的分支（feat/drama-xyq-flow）已占 V36，故本次开 V37。
-- 谁后合并谁再核对一次线上 flyway_schema_history 的最大编号。已执行的迁移一律不改。
--
-- 两张都是全新表（没有 ddl-auto 先建出来的历史形态），所以用 .sql。语法保持 H2 (MODE=MySQL) 与 MySQL 双通：
-- 不写 ENGINE / CHARSET / 表级 COMMENT，一条语句只做一件事。唯一键写成 CREATE UNIQUE INDEX，
-- 两边的索引名一致，实体上同名的 @Index(unique = true) 认得出来，ddl-auto=update 不会再补一遍。

CREATE TABLE video_studio_prompt_optimization (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    -- 前端每点一次「优化」生成的防重复串（8 到 128 个可见 ASCII）。同一用户同一串只有一条记录、只冻结一次。
    client_request_id VARCHAR(128) NOT NULL,
    -- 本区模型列表里选中的端点。合成的默认项没有候选行，记 NULL，worker 按默认端点调。
    endpoint_id VARCHAR(64) NULL,
    -- queued / running / succeeded / failed
    status VARCHAR(16) NOT NULL DEFAULT 'queued',
    -- 校验通过的请求快照：模式、清晰度、比例、秒数、素材 key 与类型、模板 id。worker 只认这一份。
    spec_json LONGTEXT NOT NULL,
    original_prompt LONGTEXT NOT NULL,
    optimized_prompt LONGTEXT NULL,
    -- 厂商返回的 optimizationId，只用于排查（生成时仍然传最终文本，不传这个 id）。
    vendor_optimization_id VARCHAR(128) NULL,
    error_message TEXT NULL,
    -- 进行中 = 冻结额，成功 = 扣除额，失败 = 已退回的额度。0 = 不收费。
    credits_held BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL
);
CREATE UNIQUE INDEX uk_vs_opt_owner_request ON video_studio_prompt_optimization (owner_user_id, client_request_id);
-- 兜底回收每 5 分钟按「状态 + 最后更新时间」扫一次卡在半路的记录。
CREATE INDEX idx_vs_opt_status_updated ON video_studio_prompt_optimization (status, updated_at);

CREATE TABLE video_studio_template (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    -- official（运营发布，所有人可见）/ private（只有自己）
    scope VARCHAR(16) NOT NULL,
    -- active / withdrawn（删除与撤回都是软删）
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    title VARCHAR(64) NOT NULL,
    description VARCHAR(400) NULL,
    source_job_id VARCHAR(64) NOT NULL,
    -- 复刻配方：模式、最终提示词、规格、种子、模型、素材（role / mediaType / key / label）。不拷运行痕迹。
    recipe_json LONGTEXT NOT NULL,
    -- 原作成片与封面的存储 key，不存签名地址（签名有时效），出 wire 时现签。
    preview_video_key VARCHAR(512) NULL,
    preview_thumbnail_key VARCHAR(512) NULL,
    use_count INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL
);
CREATE INDEX idx_vs_template_scope ON video_studio_template (scope, status, created_at);
CREATE INDEX idx_vs_template_owner ON video_studio_template (owner_user_id, status, created_at);
