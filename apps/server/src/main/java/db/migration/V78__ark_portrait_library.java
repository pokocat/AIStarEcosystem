package db.migration;

import org.flywaydb.core.api.migration.*;

/** Official portrait libraries have their own credentials and owner-scoped verification records. */
public class V78__ark_portrait_library extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        boolean library=false, credential=false;
        try(var r=c.getMetaData().getColumns(c.getCatalog(),null,"%","%")) {
            while(r.next())if("video_asset_library".equalsIgnoreCase(r.getString("TABLE_NAME"))) {
                library=true;if("credential_encrypted".equalsIgnoreCase(r.getString("COLUMN_NAME")))credential=true;
            }
        }
        try(var s=c.createStatement()) {
            if(library&&!credential)s.execute("ALTER TABLE video_asset_library ADD COLUMN credential_encrypted TEXT NULL");
            s.execute("""
                CREATE TABLE IF NOT EXISTS video_asset_person (
                    id VARCHAR(64) PRIMARY KEY, owner_user_id VARCHAR(128) NOT NULL, library_id VARCHAR(64) NOT NULL,
                    name VARCHAR(64) NOT NULL, status VARCHAR(32) NOT NULL, group_id VARCHAR(128),
                    token_encrypted TEXT, link_encrypted TEXT, callback_hash VARCHAR(64) NOT NULL,
                    agreement_version VARCHAR(64) NOT NULL, agreement_text TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
                )""");
            s.execute("""
                CREATE TABLE IF NOT EXISTS video_asset_portrait (
                    id VARCHAR(64) PRIMARY KEY, owner_user_id VARCHAR(128) NOT NULL, library_id VARCHAR(64) NOT NULL,
                    source_key VARCHAR(512) NOT NULL, media_type VARCHAR(16) NOT NULL, label VARCHAR(128) NOT NULL,
                    status VARCHAR(32) NOT NULL, placement VARCHAR(16), person_id VARCHAR(64), asset_id VARCHAR(128),
                    declared_by VARCHAR(128), declared_at TIMESTAMP, declaration_text TEXT,
                    error_code VARCHAR(128), created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
                )""");
            s.execute("CREATE INDEX idx_video_portrait_owner ON video_asset_portrait(owner_user_id, library_id)");
            s.execute("CREATE INDEX idx_video_person_owner ON video_asset_person(owner_user_id, library_id)");
        }
    }
}
