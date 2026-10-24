-- AI 导演台（docs/ai-director-plan.md v1.1）：服务端拥有的导演作品。
-- content_json 是作品的结构化内容（剧本、分集、资产使用、片段与采用指针），只存存储 key，签名地址出 wire 时派生。
CREATE TABLE director_work (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    owner_user_id VARCHAR(64) NOT NULL,
    title VARCHAR(120) NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0,
    content_json LONGTEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL
);
CREATE INDEX idx_director_work_owner ON director_work(owner_user_id, updated_at);
CREATE INDEX idx_director_work_active ON director_work(active);

-- 原生生成任务的宿主类型：NULL = 画布（ip_project），director = 导演作品（project_id 存作品 id）。
ALTER TABLE ip_run ADD COLUMN host_type VARCHAR(16) NULL;
