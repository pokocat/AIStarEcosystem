package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/** LLM / 多模态端点补充非 token 型计费统计：按次、按秒。 */
public class V12__llm_metered_billing extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V12__llm_metered_billing.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            addColumn(st, "ai_model_providers", "billing_mode VARCHAR(32) NULL");
            addColumn(st, "ai_model_providers", "unit_price_micros BIGINT NOT NULL DEFAULT 0");
            addColumn(st, "ai_model_providers", "total_billable_units BIGINT NOT NULL DEFAULT 0");
            addColumn(st, "ai_model_providers", "total_billable_seconds BIGINT NOT NULL DEFAULT 0");

            addColumn(st, "ai_model_usage_record", "billing_mode VARCHAR(32) NULL");
            addColumn(st, "ai_model_usage_record", "billable_units BIGINT NULL");
            addColumn(st, "ai_model_usage_record", "billable_seconds BIGINT NULL");
            addColumn(st, "ai_model_usage_record", "unit_price_micros BIGINT NULL");
        }
    }

    private static void addColumn(Statement st, String table, String definition) {
        String column = definition.split("\\s+", 2)[0];
        try {
            st.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + definition);
            log.info("[V12-llm-metered] added {}.{}", table, column);
        } catch (Exception e) {
            log.debug("[V12-llm-metered] skip {}.{}: {}", table, column, e.getMessage());
        }
    }
}
