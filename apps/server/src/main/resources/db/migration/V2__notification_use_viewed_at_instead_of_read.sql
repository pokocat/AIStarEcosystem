-- ─────────────────────────────────────────────────────────────────────────────
-- V2__notification_use_viewed_at_instead_of_read.sql
--
-- 把 Notification.read (boolean) 升级为 Notification.viewedAt (Instant)：
--   viewed_at IS NULL    → 未读
--   viewed_at IS NOT NULL → 已读 + 何时被读（事件模型替代贫血 boolean）
--
-- 动机：
--   1) "read" 是 MySQL 8 / MariaDB 保留字，裸列名让 Hibernate DDL 失败
--      （加反引号是 hack，污染所有后续 native query）
--   2) boolean 是「贫血模型」—— 丢了「何时」「谁标的」等审计能力
--   3) viewedAt: Instant 可空，自带审计 + 排序能力 + 一旦被读不可逆的事件语义
--
-- 兼容性（IF EXISTS / IF NOT EXISTS）：
--   - read 列已存在（H2 dev 文件库 / 部分测试 mariadb）：DROP 它；已读/未读状态
--     在迁移点重置为「全部未读」（dev 测试数据可丢；生产此前 read 列从未成功建出
--     所以无数据丢失风险）
--   - read 列从未建出（v0.34 mysql 首启因 DDL 撞保留字失败）：DROP IF EXISTS 静默跳过
--   - ADD COLUMN IF NOT EXISTS + DROP COLUMN IF EXISTS 在 MySQL 8.0.29+ 和
--     H2 2.x 都支持，跨方言兼容
--
-- 显式取舍：不做 read=true → viewed_at=created_at 的数据迁移。原因：
--   1) 生产层 read 从未建出
--   2) dev / 测试数据无审计价值
--   3) 用 dynamic SQL 兼容「read 列可能不存在」需要 MySQL 专属 PREPARE/EXECUTE
--      语法，与 H2 不兼容；为开发数据写跨方言 conditional migration 成本不划算
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE aep_notifications ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP(6) NULL;
ALTER TABLE aep_notifications DROP COLUMN IF EXISTS `read`;
