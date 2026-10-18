package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;

/**
 * Chat endpoint capability flags for native function calling and real vendor streaming
 * (docs/ip-studio-conversational-video-recreation-plan.md §一轮为有界agent循环).
 *
 * <p>Both columns stay NULL on every existing endpoint. NULL means "unknown" and is treated as NOT supported:
 * no capability is inferred from the model name. Admins declare them explicitly per endpoint.
 */
public class V60__chat_endpoint_tool_streaming extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        if (!table(c, "ai_model_providers")) return; // Fresh schema: Hibernate creates the entity columns.
        add(c, "ai_model_providers", "chat_supports_tools", "BOOLEAN NULL");
        add(c, "ai_model_providers", "chat_supports_streaming", "BOOLEAN NULL");
    }
    private static boolean table(Connection c, String table) throws SQLException {
        for (String n : List.of(table, table.toUpperCase(Locale.ROOT)))
            try (var r = c.getMetaData().getTables(c.getCatalog(), null, n, new String[]{"TABLE"})) { if (r.next()) return true; }
        return false;
    }
    private static boolean column(Connection c, String t, String col) throws SQLException {
        for (String n : List.of(t, t.toUpperCase(Locale.ROOT)))
            try (var r = c.getMetaData().getColumns(c.getCatalog(), null, n, null)) {
                while (r.next()) if (col.equalsIgnoreCase(r.getString("COLUMN_NAME"))) return true;
            }
        return false;
    }
    private static void add(Connection c, String t, String col, String type) throws SQLException {
        if (!column(c, t, col)) try (var s = c.createStatement()) { s.execute("ALTER TABLE " + t + " ADD COLUMN " + col + " " + type); }
    }
}
