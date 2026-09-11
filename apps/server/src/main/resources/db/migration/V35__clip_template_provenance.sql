-- 模板的出处：这一套是谁、从哪条草稿存的。
--
-- V34 同批上线的「把草稿存成模板」照搬了 ip studio 的 publish-as-demo，但漏了它的两列
-- （ip_demo_template.source_project_id / created_by）。少这两列的后果不是不好看：
-- 模板是**超管一键推给全平台每个用户**的内容，出了问题（分段错了、素材没剥干净、
-- 文案要改）第一件事就是回去看它从哪条草稿来的、谁存的。没有这两列只能靠人回忆。
--
-- 两列都可空：V35 之前存在的模板（线上那 3 条官方模板）是直接写库建的，没有来源草稿，
-- 不许硬塞一个值假装它有 —— 与 credit_ledger.product_code 同一个道理。
--
-- ⚠️ **一列一条 ALTER，不要合并成一条多子句的。**
-- 合并写法（`ALTER TABLE t ADD COLUMN a …, ADD COLUMN b …`）MySQL 收，H2(MODE=MySQL) 不收，
-- 报 42000。本文件第一版就是那么写的：生产 MySQL 跑过了，本地 H2 全线起不来 —— dev 用的是
-- 文件库（application-dev.yml），停在 V34 的旧库和全新库都会卡在这里，Flyway 在 Hibernate
-- 之前失败，服务直接起不来。同仓 V16__add_clip_asset_dimensions.sql 本来就是分两条写的。
-- 提交时只跑了 Clip*，而这条门禁在 MigrationSyntaxTest（com.aistareco.aep.migration 包下），
-- 没被带到。
ALTER TABLE clip_template ADD COLUMN source_project_id VARCHAR(64) NULL COMMENT '存成这套模板的那条草稿；NULL=不是从草稿存的';
ALTER TABLE clip_template ADD COLUMN created_by VARCHAR(128) NULL COMMENT '执行存模板的运营（externalOwnerId）；NULL=本列上线前建的';

-- 按来源草稿反查用。不做唯一索引：同一条草稿可以存成多套模板（改几个字存一版）。
CREATE INDEX idx_clip_template_source ON clip_template (source_project_id);
