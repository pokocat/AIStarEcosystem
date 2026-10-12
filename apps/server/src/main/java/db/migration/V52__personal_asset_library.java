package db.migration;
import org.flywaydb.core.api.migration.*;
/** Adds directory identities without rewriting existing media, characters or ledger records. */
public class V52__personal_asset_library extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        try(var s=context.getConnection().createStatement()) {
            s.executeUpdate("CREATE TABLE ip_library_record (id VARCHAR(32) PRIMARY KEY, owner_user_id VARCHAR(64) NOT NULL, record_type VARCHAR(16) NOT NULL, payload_json LONGTEXT NOT NULL, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, deleted_at TIMESTAMP(6))");
            s.executeUpdate("CREATE INDEX idx_ip_library_owner_type ON ip_library_record(owner_user_id,record_type)");
        }
    }
}
