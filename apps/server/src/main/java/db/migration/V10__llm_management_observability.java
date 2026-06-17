package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/**
 * LLM 管理端增强：端点默认参数/别名、usage 请求追踪与质量标注、Prompt 版本快照。
 *
 * Java migration 兼容空库首次启动：核心业务表可能还没由 Hibernate ddl-auto 创建出来，
 * 所以 ALTER 独立 try/catch；表不存在、列已存在、索引已存在都跳过。
 */
public class V10__llm_management_observability extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V10__llm_management_observability.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            addColumn(st, "ai_model_providers", "model_alias VARCHAR(80) NULL");
            addColumn(st, "ai_model_providers", "default_temperature DOUBLE NULL");
            addColumn(st, "ai_model_providers", "default_max_tokens INT NULL");
            addColumn(st, "ai_model_providers", "default_top_p DOUBLE NULL");
            addColumn(st, "ai_model_providers", "rpm_limit INT NULL");
            addColumn(st, "ai_model_providers", "tpm_limit INT NULL");

            addColumn(st, "ai_model_usage_record", "request_body_json LONGTEXT NULL");
            addColumn(st, "ai_model_usage_record", "response_body_json LONGTEXT NULL");
            addColumn(st, "ai_model_usage_record", "cost_micros BIGINT NULL");
            addColumn(st, "ai_model_usage_record", "replay_of_record_id VARCHAR(255) NULL");
            addColumn(st, "ai_model_usage_record", "quality_score INT NULL");
            addColumn(st, "ai_model_usage_record", "quality_label VARCHAR(255) NULL");
            addColumn(st, "ai_model_usage_record", "quality_note VARCHAR(512) NULL");

            createPromptVersionTable(st);
            createIndex(st, "idx_prompt_version_key", "prompt_template_version", "prompt_key");
            createIndex(st, "idx_prompt_version_key_version", "prompt_template_version", "prompt_key, version");
        }
    }

    private static void addColumn(Statement st, String table, String definition) {
        String column = definition.split("\\s+", 2)[0];
        try {
            st.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + definition);
            log.info("[V10-llm-management] added {}.{}", table, column);
        } catch (Exception e) {
            log.debug("[V10-llm-management] skip {}.{}: {}", table, column, e.getMessage());
        }
    }

    private static void createPromptVersionTable(Statement st) {
        try {
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS prompt_template_version (
                        id VARCHAR(255) NOT NULL,
                        prompt_key VARCHAR(64) NOT NULL,
                        version INT NOT NULL,
                        system_prompt LONGTEXT NULL,
                        user_template LONGTEXT NULL,
                        params_json TEXT NULL,
                        enabled BOOLEAN NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        created_by VARCHAR(255) NULL,
                        change_note VARCHAR(256) NULL,
                        PRIMARY KEY (id)
                    )
                    """);
            log.info("[V10-llm-management] ensured prompt_template_version table");
        } catch (Exception e) {
            log.debug("[V10-llm-management] skip prompt_template_version table: {}", e.getMessage());
        }
    }

    private static void createIndex(Statement st, String index, String table, String columns) {
        try {
            st.executeUpdate("CREATE INDEX " + index + " ON " + table + " (" + columns + ")");
            log.info("[V10-llm-management] added {}", index);
        } catch (Exception e) {
            log.debug("[V10-llm-management] skip {}: {}", index, e.getMessage());
        }
    }
}
