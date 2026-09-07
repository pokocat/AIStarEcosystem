-- AI 数字名片（apps/web-aiavatar 下 /card 域，v0.153）—— 名片文档 + 短链。
--
-- 编号说明：Flyway 编号横跨 resources/db/migration/*.sql 与 src/main/java/db/migration/*.java
-- 两处（见本目录 README.md）。本次核过线上 flyway_schema_history 最大值 = 27，故开 V28。
-- 已执行的迁移一律不改。
--
-- 全新表，无 ddl-auto 历史形态，所以用 .sql 而不是 Java 迁移。
-- 语法保持 H2 (MODE=MySQL) 与 MySQL 双通：LONGTEXT / DATETIME(6) 两边都可用，
-- 不用 MySQL 专有的 ENGINE / CHARSET 子句。
CREATE TABLE card_profile (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    -- 短链。名片的对外身份，进 URL：/card/p/<slug>。
    -- 全局唯一；`demo` 是前端保留短链，不允许被真实名片占用（服务层拦）。
    slug VARCHAR(64) NOT NULL,
    -- 登记号 BC-xxxx，展示用，与 slug 分离：换短链不换登记号。
    reg_no VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    -- 名片引用的数字人形象（DapAvatar.id）。名片**只存引用不存图**：
    -- 形象改了名片自动跟着变。具体每屏用哪个造型存在 payload 的 dapDisplayRef 里。
    avatar_id VARCHAR(32) NULL,
    -- 名片文档整存整取。**只存 cdnKey 与 dapDisplayRef，绝不存签名 URL**
    -- —— 签名有 TTL，存下来一小时后全是裂图（§4.7.7）。出 wire 时再签。
    payload_json LONGTEXT NOT NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL
);
-- 公开读的唯一入口是按 slug 查，且要能挡住软删与未发布，所以索引带上这两列。
CREATE UNIQUE INDEX uk_card_profile_slug ON card_profile(slug);
CREATE INDEX idx_card_profile_owner ON card_profile(owner_user_id, deleted_at);
CREATE INDEX idx_card_profile_avatar ON card_profile(avatar_id);
