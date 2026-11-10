-- 模型用量记录记下是哪个任务发起的调用（IpRun / DapJob 的 id），账号「任务历史」据此给文字任务打开「查看原文」。
-- 旧记录没有任务编号，仍可在任务历史的「全部原文」里查看。
ALTER TABLE ai_model_usage_record ADD COLUMN task_id VARCHAR(64) NULL;
CREATE INDEX idx_aiusage_task ON ai_model_usage_record (task_id);
