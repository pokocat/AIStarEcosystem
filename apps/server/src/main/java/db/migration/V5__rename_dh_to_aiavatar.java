package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Locale;

/**
 * Hard rename the old Digital Human tables to AiAvatar tables.
 *
 * Fresh dev databases do not have the old tables because Flyway runs before
 * Hibernate auto-creates entities, so missing source tables are skipped.
 */
public class V5__rename_dh_to_aiavatar extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V5__rename_dh_to_aiavatar.class);

    private static final String[][] TABLES = {
            {"dh_avatar", "aiavatar_avatar"},
            {"dh_avatar_version", "aiavatar_avatar_version"},
            {"dh_asset", "aiavatar_asset"},
            {"dh_source_material", "aiavatar_source_material"},
            {"dh_license_grant", "aiavatar_license_grant"},
            {"dh_template", "aiavatar_template"},
            {"dh_job", "aiavatar_job"},
            {"dh_refine_edit", "aiavatar_refine_edit"}
    };

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        for (String[] pair : TABLES) {
            renameIfNeeded(connection, pair[0], pair[1]);
        }
    }

    private void renameIfNeeded(Connection connection, String oldName, String newName) throws Exception {
        if (!tableExists(connection, oldName)) {
            log.debug("[V5-aiavatar-rename] skip {}, source table missing", oldName);
            return;
        }
        if (tableExists(connection, newName)) {
            log.info("[V5-aiavatar-rename] skip {} -> {}, target table already exists", oldName, newName);
            return;
        }

        try (Statement st = connection.createStatement()) {
            try {
                st.executeUpdate("ALTER TABLE " + oldName + " RENAME TO " + newName);
            } catch (Exception alterError) {
                st.executeUpdate("RENAME TABLE " + oldName + " TO " + newName);
            }
        }
        log.info("[V5-aiavatar-rename] renamed {} -> {}", oldName, newName);
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        DatabaseMetaData meta = connection.getMetaData();
        String[] candidates = {tableName, tableName.toUpperCase(Locale.ROOT)};
        for (String candidate : candidates) {
            try (ResultSet rs = meta.getTables(connection.getCatalog(), null, candidate, new String[]{"TABLE"})) {
                if (rs.next()) return true;
            }
            try (ResultSet rs = meta.getTables(null, null, candidate, new String[]{"TABLE"})) {
                if (rs.next()) return true;
            }
        }
        return false;
    }
}
