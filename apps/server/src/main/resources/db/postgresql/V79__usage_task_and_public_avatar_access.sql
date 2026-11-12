-- Mirror the source's MySQL V80/V81 columns without replaying data seeds.
ALTER TABLE ai_model_usage_record ADD COLUMN task_id varchar(64) COLLATE "C";
CREATE INDEX idx_aiusage_task ON ai_model_usage_record(task_id);
ALTER TABLE dap_public_avatar ADD COLUMN access varchar(16);
-- Source access values, including license/free and legacy NULL, are copied unchanged.
