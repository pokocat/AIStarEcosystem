-- 全局示例 IP 工作流（v0.182）。
--
-- 内置模板（resources/ipstudio/templates/*.json）是**空工作流** —— 用户得自己拖照片、
-- 自己跑一遍才看得到效果。示例模板是另一回事：素材和成图都已经在里面，新用户一进来
-- 就能看见这条链最终长什么样。它由运营从一个真实项目「存为全局示例」生成，所以只能落库，
-- 不能像内置模板那样躺在 classpath 里（classpath 是只读的）。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java
-- 两处（见本目录 README.md）。线上 flyway_schema_history 最大值 = 30，故开 V31。
--
-- 全新表，无 ddl-auto 历史形态，用 .sql；语法保持 H2 (MODE=MySQL) 与 MySQL 双通。
CREATE TABLE ip_demo_template (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    summary VARCHAR(1024) NULL,
    -- 画布文档。里面的素材键全部指向 ipstudio/demo/<id>/…（平台自有的示例素材，
    -- 所有人可读），**不是**原项目那份属于某个用户的 key —— 否则换个人打开就是一片空白，
    -- 而且原作者一删账号示例就烂了。
    doc_json LONGTEXT NOT NULL,
    -- 列表封面（示例素材里的一张图）。存 key，URL 出 wire 现签（§4.7.4）。
    cover_key VARCHAR(512) NULL,
    -- 下线一个示例不删数据：改这一列即可，随时能再打开。
    -- BOOLEAN 而不是 TINYINT(1)：H2 不吃显示宽度（`TINYINT(1)` 直接语法错，
    -- 全新 dev 库起不来）；MySQL 收 BOOLEAN 并自己存成 TINYINT(1)。
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    source_project_id VARCHAR(32) NULL,
    created_by VARCHAR(64) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL
);
CREATE INDEX idx_ip_demo_enabled ON ip_demo_template(enabled, sort_order);
