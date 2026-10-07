package db.migration;
import org.flywaydb.core.api.migration.*;
public class V39__ip_canvas_recovery extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        try(var s=c.createStatement()) {
            s.executeUpdate("CREATE TABLE IF NOT EXISTS ip_project_revision (id VARCHAR(32) PRIMARY KEY, project_id VARCHAR(32) NOT NULL, name VARCHAR(128) NOT NULL, doc_json LONGTEXT NOT NULL, created_at DATETIME(6))");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS ip_saved_asset (id VARCHAR(32) PRIMARY KEY, owner_user_id VARCHAR(64) NOT NULL, payload_json LONGTEXT NOT NULL, created_at DATETIME(6), deleted_at DATETIME(6))");
            s.executeUpdate("CREATE INDEX idx_ip_revision_project ON ip_project_revision(project_id, created_at)");
            s.executeUpdate("CREATE INDEX idx_ip_saved_asset_owner ON ip_saved_asset(owner_user_id, deleted_at)");
            // V27's TEXT cannot hold the existing 2MB document limit on MySQL. Never edit V27.
            if(c.getMetaData().getDatabaseProductName().equalsIgnoreCase("MySQL"))
                s.executeUpdate("ALTER TABLE ip_project MODIFY COLUMN doc_json LONGTEXT NOT NULL");
        }
    }
}
