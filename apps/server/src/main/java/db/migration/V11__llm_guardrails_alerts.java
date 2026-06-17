package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/** LLM 限速、每日配额、告警阈值与失败原因标准分类。 */
public class V11__llm_guardrails_alerts extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V11__llm_guardrails_alerts.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            addColumn(st, "ai_model_providers", "daily_token_quota BIGINT NULL");
            addColumn(st, "ai_model_providers", "daily_cost_quota_micros BIGINT NULL");
            addColumn(st, "ai_model_providers", "alert_failure_rate_pct INT NULL");
            addColumn(st, "ai_model_usage_record", "error_category VARCHAR(32) NULL");
            createIndex(st, "idx_aiusage_error_category", "ai_model_usage_record", "error_category");
        }
    }

    private static void addColumn(Statement st, String table, String definition) {
        String column = definition.split("\\s+", 2)[0];
        try {
            st.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + definition);
            log.info("[V11-llm-guardrails] added {}.{}", table, column);
        } catch (Exception e) {
            log.debug("[V11-llm-guardrails] skip {}.{}: {}", table, column, e.getMessage());
        }
    }

    private static void createIndex(Statement st, String index, String table, String columns) {
        try {
            st.executeUpdate("CREATE INDEX " + index + " ON " + table + " (" + columns + ")");
            log.info("[V11-llm-guardrails] added {}", index);
        } catch (Exception e) {
            log.debug("[V11-llm-guardrails] skip {}: {}", index, e.getMessage());
        }
    }
}
