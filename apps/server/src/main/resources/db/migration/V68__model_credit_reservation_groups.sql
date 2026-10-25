ALTER TABLE aep_model_charges ADD COLUMN parent_hold_id VARCHAR(64);
CREATE INDEX idx_model_charge_parent ON aep_model_charges(parent_hold_id);
