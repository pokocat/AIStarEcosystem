-- ─────────────────────────────────────────────────────────────────────────────
-- 应用专用账号 — 最小权限原则
--
-- 执行方式（用 RDS 主账号）：
--   mysql -h <RDS_HOST> -P 3306 -u <RDS_ROOT> -p < infra/rds/01_create_app_user.sql
--
-- 注意：RDS 的 host 通配符建议用阿里云 VPC 内网 CIDR（如 '172.16.%')
--      而非 '%'，避免公网爆破。
--
-- 替换占位符：
--   <APP_PASSWORD>          → 高熵随机密码（≥16 字符，含大小写 + 数字 + 符号）
--   <VPC_CIDR_OR_PERCENT>   → 内网 CIDR 形如 '172.16.%'，或 ECS 固定 IP，或退化 '%'
-- ─────────────────────────────────────────────────────────────────────────────

-- 创建应用账号
CREATE USER IF NOT EXISTS 'aistareco_app'@'<VPC_CIDR_OR_PERCENT>'
  IDENTIFIED BY '<APP_PASSWORD>';

-- 授权：aistareco 库内所有表的 CRUD + DDL（Hibernate ddl-auto 需要 ALTER 权限）
-- Flyway baseline 上线后可以撤回 DDL，只留 DML + CREATE TEMPORARY TABLE
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES,
      CREATE TEMPORARY TABLES, EXECUTE
  ON aistareco.*
  TO 'aistareco_app'@'<VPC_CIDR_OR_PERCENT>';

-- Flyway 需要 schema_history 表（CREATE 已涵盖）；schema 不变后可降级为只读 DDL：
-- REVOKE CREATE, ALTER, DROP ON aistareco.* FROM 'aistareco_app'@'<VPC_CIDR_OR_PERCENT>';

FLUSH PRIVILEGES;

-- 验证
SHOW GRANTS FOR 'aistareco_app'@'<VPC_CIDR_OR_PERCENT>';
