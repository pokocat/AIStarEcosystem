-- ─────────────────────────────────────────────────────────────────────────────
-- 阿里云 RDS MySQL 8.0 — 建库脚本（首次部署或迁移到新 RDS 时执行）
--
-- 执行方式（用 RDS 主账号）：
--   mysql -h <RDS_HOST> -P 3306 -u <RDS_ROOT> -p < infra/rds/00_create_database.sql
--
-- 注意：字符集必须 utf8mb4 + utf8mb4_unicode_ci，与 application-mysql.yml 的
--      connectionCollation 参数对齐，否则中文文案 / emoji 排序会出错。
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS aistareco
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 验证
SHOW DATABASES LIKE 'aistareco';
SHOW VARIABLES LIKE 'character_set_database';
SHOW VARIABLES LIKE 'collation_database';
