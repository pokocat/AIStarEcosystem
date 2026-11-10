package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Nullable: existing endpoints keep their exact provider defaults. Fresh schemas are created by Hibernate. */
public class V77__chat_reasoning_effort extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c = context.getConnection();
        boolean tableExists = false;
        try (var r = c.getMetaData().getTables(c.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (r.next()) if ("ai_model_providers".equalsIgnoreCase(r.getString("TABLE_NAME"))) tableExists = true;
        }
        if (!tableExists) return;
        try (var r = c.getMetaData().getColumns(c.getCatalog(), null, "%", "%")) {
            while (r.next()) if ("ai_model_providers".equalsIgnoreCase(r.getString("TABLE_NAME"))
                    && "chat_reasoning_effort".equalsIgnoreCase(r.getString("COLUMN_NAME"))) return;
        }
        try (var s = c.createStatement()) {
            s.execute("ALTER TABLE ai_model_providers ADD COLUMN chat_reasoning_effort VARCHAR(16) NULL");
        }
    }
}
