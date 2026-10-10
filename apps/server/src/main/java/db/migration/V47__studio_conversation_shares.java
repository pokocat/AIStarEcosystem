package db.migration;
import org.flywaydb.core.api.migration.*;
/** Additive text sharing; no asset, project or ledger migration. */
public class V47__studio_conversation_shares extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        try(var s=context.getConnection().createStatement()) {
            s.executeUpdate("CREATE TABLE ip_conversation_share (token VARCHAR(32) PRIMARY KEY, owner_user_id VARCHAR(64) NOT NULL, project_id VARCHAR(32) NOT NULL, node_id VARCHAR(128) NOT NULL, snapshot_hash VARCHAR(64) NOT NULL, snapshot_json LONGTEXT NOT NULL, created_at TIMESTAMP(6) NOT NULL, revoked_at TIMESTAMP(6))");
            s.executeUpdate("CREATE INDEX idx_ip_conversation_share_source ON ip_conversation_share(project_id,node_id,revoked_at)");
            s.executeUpdate("CREATE TABLE ip_conversation_copy (id VARCHAR(32) PRIMARY KEY, owner_user_id VARCHAR(64) NOT NULL, client_request_id VARCHAR(128) NOT NULL, token VARCHAR(32) NOT NULL, project_id VARCHAR(32) NOT NULL, CONSTRAINT uk_ip_conversation_copy UNIQUE(owner_user_id,client_request_id))");
        }
    }
}
