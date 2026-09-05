-- 统一账号中心 P2（v0.149）：子产品「开通」成为后端权益真值。
-- 真源 docs/unified-identity-plan.md §12.2。
--
-- 此前「能进哪些子产品」只有 aep_users.platforms 这个 CSV 列，且空 CSV 被当作「全集」，
-- 后端 /api/me/** 只查登录态、不查开通 —— 权益无处记账、无有效期、无来源可追。
-- 这里把它升级成两张表：
--   product_enrollment  当前状态（一个账号 × 一个子产品 一行，UNIQUE 保证幂等 upsert）
--   entitlement_grant   不可变的授权凭据（激活码 / 试用 / 运营发放），
--                       UNIQUE(source, source_reference, product) 是「同一把激活码对同一个子产品
--                       只能兑一次」的硬约束。带 product 是因为一把「全站秘钥」会同时开通多个
--                       子产品：每个产品一行，日后按产品退权 / 对账才有凭据可依。
--
-- 建新表用 .sql（不涉及 ddl-auto 已建的表），H2(MODE=MySQL) 与 MySQL 8 通用。
CREATE TABLE product_enrollment (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    product VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    source VARCHAR(16) NOT NULL,
    activated_at DATETIME(6) NULL,
    valid_until DATETIME(6) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    CONSTRAINT uk_product_enrollment_user_product UNIQUE (user_id, product)
);

CREATE TABLE entitlement_grant (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    product VARCHAR(32) NOT NULL,
    source VARCHAR(16) NOT NULL,
    source_reference VARCHAR(128) NOT NULL,
    granted_at DATETIME(6) NULL,
    valid_until DATETIME(6) NULL,
    status VARCHAR(16) NOT NULL,
    CONSTRAINT uk_entitlement_grant_source_ref UNIQUE (source, source_reference, product)
);
CREATE INDEX idx_entitlement_grant_user ON entitlement_grant(user_id);
