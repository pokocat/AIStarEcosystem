package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Persist chat wire rules on the fixed supplier/model endpoint for every consuming app. */
public class V53__chat_endpoint_capabilities extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        try (var s = context.getConnection().createStatement()) {
            s.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN chat_supports_temperature BOOLEAN NULL");
            s.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN chat_supports_top_p BOOLEAN NULL");
            s.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN chat_supports_response_format BOOLEAN NULL");
            s.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN chat_max_output_tokens INT NULL");
            // Transfer the previously hard-coded behavior. Null on all other endpoints keeps legacy wire behavior.
            String qwen35 = "(LOWER(default_model) LIKE '%qwen3-5%' OR LOWER(default_model) LIKE '%qwen3.5%')";
            String qwen36 = "(LOWER(default_model) LIKE '%qwen3-6%' OR LOWER(default_model) LIKE '%qwen3.6%')";
            s.executeUpdate("UPDATE ai_model_providers SET chat_supports_temperature=FALSE, chat_supports_response_format=FALSE, chat_max_output_tokens=4096 WHERE " + qwen35);
            s.executeUpdate("UPDATE ai_model_providers SET chat_supports_temperature=FALSE, chat_supports_response_format=FALSE WHERE " + qwen36);
        }
    }
}
