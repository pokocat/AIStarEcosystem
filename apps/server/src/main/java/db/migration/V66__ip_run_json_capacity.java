package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.util.ArrayList;
import java.util.List;

/** Restore V27's LONGTEXT contract after the old entity mapping narrowed it to TEXT. */
public class V66__ip_run_json_capacity extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        // H2 TEXT has no MySQL 64 KiB byte limit; new schemas already use V27's LONGTEXT.
        if (!"MySQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) return;
        var changes = new ArrayList<String>();
        for (String column : List.of("input_json", "output_json")) {
            try (var columns = connection.getMetaData().getColumns(connection.getCatalog(), null, "ip_run", column)) {
                if (!columns.next()) throw new IllegalStateException("Missing ip_run." + column);
                if (!"LONGTEXT".equalsIgnoreCase(columns.getString("TYPE_NAME"))) {
                    changes.add("MODIFY COLUMN " + column + " LONGTEXT NULL");
                }
            }
        }
        // Skip production's already-applied emergency expansion; never rewrite Flyway history.
        if (!changes.isEmpty()) {
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("ALTER TABLE ip_run " + String.join(", ", changes));
            }
        }
    }
}
