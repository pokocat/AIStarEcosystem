ALTER TABLE ip_run ADD COLUMN client_request_id VARCHAR(64) NULL;
ALTER TABLE ip_run ADD COLUMN input_fingerprint VARCHAR(64) NULL;
ALTER TABLE ip_run MODIFY COLUMN kind VARCHAR(32) NOT NULL;
CREATE UNIQUE INDEX uk_ip_run_project_request ON ip_run(project_id, client_request_id);
