package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

public class V85__dap_public_avatar_three_view extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        try (var tables = connection.getMetaData().getTables(connection.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (tables.next()) {
                if (!"dap_public_avatar".equalsIgnoreCase(tables.getString("TABLE_NAME"))) continue;
                try (var statement = connection.createStatement()) {
                    try (var columns = connection.getMetaData().getColumns(tables.getString("TABLE_CAT"),
                            tables.getString("TABLE_SCHEM"), tables.getString("TABLE_NAME"), "%")) {
                        while (columns.next()) {
                            if ("three_view_key".equalsIgnoreCase(columns.getString("COLUMN_NAME"))) return;
                        }
                    }
                    statement.execute("ALTER TABLE dap_public_avatar ADD COLUMN three_view_key VARCHAR(512)");
                }
                return;
            }
        }
        // Hibernate creates the table with the new column on fresh H2/MySQL databases.
    }
}
