package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Nullable preserves the previous unit for existing endpoints without changing customer prices. */
public class V49__supplier_cost_billing_mode extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (var statement = context.getConnection().createStatement()) {
            statement.executeUpdate("ALTER TABLE ai_model_providers ADD COLUMN supplier_billing_mode VARCHAR(32) NULL");
        }
    }
}
