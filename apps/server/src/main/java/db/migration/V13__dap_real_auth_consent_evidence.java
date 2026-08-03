package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Statement;

/** 真人授权 v0.106：协议确认快照、七牛核验证据与可版本化凭证。 */
public class V13__dap_real_auth_consent_evidence extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V13__dap_real_auth_consent_evidence.class);

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement st = context.getConnection().createStatement()) {
            createConsentTable(st);
            addColumn(st, "dap_material_group", "consent_id VARCHAR(32) NULL");
            addColumn(st, "dap_license", "consent_id VARCHAR(32) NULL");
            addColumn(st, "dap_license", "agreement_version VARCHAR(64) NULL");
            addColumn(st, "dap_license", "agreement_hash VARCHAR(64) NULL");
            addColumn(st, "dap_license", "consented_at TIMESTAMP NULL");
            addColumn(st, "dap_license", "verification_provider VARCHAR(32) NULL");
            addColumn(st, "dap_license", "verification_reference VARCHAR(96) NULL");
            addColumn(st, "dap_license", "verified_at TIMESTAMP NULL");
            addColumn(st, "dap_license", "certificate_version INT NOT NULL DEFAULT 0");
        }
    }

    private static void createConsentTable(Statement st) {
        try {
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS dap_consent (
                        id VARCHAR(32) NOT NULL,
                        owner_user_id VARCHAR(64) NOT NULL,
                        avatar_id VARCHAR(32) NULL,
                        capture_id VARCHAR(32) NOT NULL,
                        agreement_version VARCHAR(64) NOT NULL,
                        agreement_title VARCHAR(160) NOT NULL,
                        agreement_hash VARCHAR(64) NOT NULL,
                        agreement_text TEXT NOT NULL,
                        scope VARCHAR(512) NOT NULL,
                        period_months INT NOT NULL DEFAULT 24,
                        platforms TEXT NULL,
                        processors TEXT NULL,
                        client_ip VARCHAR(64) NULL,
                        client_user_agent VARCHAR(512) NULL,
                        accepted_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        PRIMARY KEY (id)
                    )
                    """);
            createIndex(st, "idx_dap_consent_owner", "dap_consent", "owner_user_id");
            createIndex(st, "idx_dap_consent_capture", "dap_consent", "capture_id");
            log.info("[V13-dap-consent] ensured dap_consent table");
        } catch (Exception e) {
            log.debug("[V13-dap-consent] skip dap_consent table: {}", e.getMessage());
        }
    }

    private static void addColumn(Statement st, String table, String definition) {
        String column = definition.split("\\s+", 2)[0];
        try {
            st.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + definition);
            log.info("[V13-dap-consent] added {}.{}", table, column);
        } catch (Exception e) {
            log.debug("[V13-dap-consent] skip {}.{}: {}", table, column, e.getMessage());
        }
    }

    private static void createIndex(Statement st, String index, String table, String columns) {
        try {
            st.executeUpdate("CREATE INDEX " + index + " ON " + table + " (" + columns + ")");
        } catch (Exception e) {
            log.debug("[V13-dap-consent] skip index {}: {}", index, e.getMessage());
        }
    }
}
