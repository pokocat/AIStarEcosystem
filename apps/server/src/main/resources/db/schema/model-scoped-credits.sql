-- Customer prices, discounts and restricted grants. Existing wallet balances are untouched.
CREATE TABLE aep_model_prices (
    id VARCHAR(64) PRIMARY KEY,
    target_key VARCHAR(64) NOT NULL,
    target_json TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    unit_price DECIMAL(25,9) NOT NULL,
    output_unit_price DECIMAL(25,9),
    active BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    updated_by VARCHAR(64), updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_model_price_target UNIQUE (target_key),
    CONSTRAINT ck_model_price_nonnegative CHECK (unit_price >= 0 AND (output_unit_price IS NULL OR output_unit_price >= 0))
);
CREATE TABLE aep_model_discounts (
    id VARCHAR(64) PRIMARY KEY,
    target_key VARCHAR(64) NOT NULL,
    target_json TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    audience VARCHAR(16) NOT NULL, audience_id VARCHAR(64),
    factor DECIMAL(10,6) NOT NULL,
    allow_grants BOOLEAN NOT NULL, active BOOLEAN NOT NULL,
    starts_at TIMESTAMP(6) NOT NULL, expires_at TIMESTAMP(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    updated_by VARCHAR(64), updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT ck_model_discount_factor CHECK (factor > 0 AND factor <= 1),
    CONSTRAINT ck_model_discount_window CHECK (expires_at > starts_at)
);
CREATE INDEX idx_model_discount_target ON aep_model_discounts(target_key,active);
CREATE TABLE aep_credit_campaigns (
    id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL,
    targets_json TEXT NOT NULL, resource_unit VARCHAR(16) NOT NULL,
    total_issue_limit BIGINT NOT NULL, per_wallet_issue_limit BIGINT NOT NULL,
    issued BIGINT NOT NULL DEFAULT 0,
    resource_limit DECIMAL(25,9) NOT NULL,
    resource_reserved DECIMAL(25,9) NOT NULL DEFAULT 0,
    resource_used DECIMAL(25,9) NOT NULL DEFAULT 0,
    per_wallet_daily_resource_limit DECIMAL(25,9) NOT NULL,
    max_concurrent_per_wallet INT NOT NULL,
    active BOOLEAN NOT NULL, starts_at TIMESTAMP(6) NOT NULL, expires_at TIMESTAMP(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0, updated_by VARCHAR(64), updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT ck_campaign_issue CHECK (issued >= 0 AND total_issue_limit >= issued AND per_wallet_issue_limit > 0),
    CONSTRAINT ck_campaign_resource CHECK (resource_reserved >= 0 AND resource_used >= 0 AND resource_limit >= resource_reserved + resource_used),
    CONSTRAINT ck_campaign_limits CHECK (per_wallet_daily_resource_limit > 0 AND max_concurrent_per_wallet > 0),
    CONSTRAINT ck_campaign_window CHECK (expires_at > starts_at)
);
CREATE TABLE aep_credit_grants (
    id VARCHAR(64) PRIMARY KEY, wallet_id VARCHAR(64) NOT NULL, campaign_id VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL, available BIGINT NOT NULL, frozen BIGINT NOT NULL DEFAULT 0,
    spent BIGINT NOT NULL DEFAULT 0, expired BIGINT NOT NULL DEFAULT 0,
    source VARCHAR(64) NOT NULL, source_reference VARCHAR(128) NOT NULL,
    reason VARCHAR(512) NOT NULL, created_by VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL, created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_scoped_grant_source UNIQUE (source,source_reference),
    CONSTRAINT fk_scoped_grant_campaign FOREIGN KEY (campaign_id) REFERENCES aep_credit_campaigns(id),
    CONSTRAINT ck_scoped_grant_balance CHECK (available >= 0 AND frozen >= 0 AND spent >= 0 AND expired >= 0 AND amount = available + frozen + spent + expired)
);
CREATE INDEX idx_scoped_grant_wallet ON aep_credit_grants(wallet_id,expires_at,id);
CREATE TABLE aep_credit_grant_holds (
    id VARCHAR(64) PRIMARY KEY, hold_id VARCHAR(64) NOT NULL, grant_id VARCHAR(64) NOT NULL,
    original_amount BIGINT NOT NULL, frozen BIGINT NOT NULL,
    consumed BIGINT NOT NULL DEFAULT 0, released BIGINT NOT NULL DEFAULT 0, allocation_order INT NOT NULL,
    CONSTRAINT uk_scoped_grant_hold UNIQUE (hold_id,grant_id),
    CONSTRAINT fk_scoped_hold_grant FOREIGN KEY (grant_id) REFERENCES aep_credit_grants(id),
    CONSTRAINT ck_scoped_hold_balance CHECK (frozen >= 0 AND consumed >= 0 AND released >= 0 AND original_amount = frozen + consumed + released)
);
CREATE TABLE aep_credit_resource_reservations (
    id VARCHAR(64) PRIMARY KEY, hold_id VARCHAR(64) NOT NULL,
    campaign_id VARCHAR(64) NOT NULL, wallet_id VARCHAR(64) NOT NULL,
    original_units DECIMAL(25,9) NOT NULL, reserved DECIMAL(25,9) NOT NULL,
    used DECIMAL(25,9) NOT NULL DEFAULT 0, released DECIMAL(25,9) NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL, dispatched_at TIMESTAMP(6), completed_at TIMESTAMP(6),
    CONSTRAINT uk_scoped_resource_hold UNIQUE (hold_id,campaign_id),
    CONSTRAINT fk_scoped_resource_campaign FOREIGN KEY (campaign_id) REFERENCES aep_credit_campaigns(id),
    CONSTRAINT ck_scoped_resource_balance CHECK (reserved >= 0 AND used >= 0 AND released >= 0 AND original_units = reserved + used + released)
);
CREATE INDEX idx_scoped_resource_daily ON aep_credit_resource_reservations(campaign_id,wallet_id,created_at);
CREATE TABLE aep_model_charges (
    hold_id VARCHAR(64) PRIMARY KEY,
    target_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    base_credits BIGINT NOT NULL, standard_credits BIGINT NOT NULL, payable_credits BIGINT NOT NULL,
    scoped_credits BIGINT NOT NULL, wallet_credits BIGINT NOT NULL,
    settled_base_credits BIGINT NOT NULL DEFAULT 0,
    settled_payable_credits BIGINT NOT NULL DEFAULT 0,
    settled_scoped_credits BIGINT NOT NULL DEFAULT 0,
    settled_wallet_credits BIGINT NOT NULL DEFAULT 0,
    settled_quantity DECIMAL(25,9) NOT NULL DEFAULT 0,
    settled_output_quantity DECIMAL(25,9) NOT NULL DEFAULT 0,
    free_only BOOLEAN NOT NULL, created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT ck_model_charge_split CHECK (payable_credits = scoped_credits + wallet_credits AND scoped_credits >= 0 AND wallet_credits >= 0),
    CONSTRAINT ck_model_charge_settlement CHECK (settled_payable_credits = settled_scoped_credits + settled_wallet_credits AND settled_payable_credits <= payable_credits AND settled_base_credits <= base_credits)
);
