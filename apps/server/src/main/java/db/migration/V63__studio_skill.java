package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.util.List;

/**
 * Studio skill registry with immutable versions (S3, docs/ip-studio-conversational-video-recreation-plan.md §第三阶段 S3).
 * New tables only: no existing row, price, hold or ledger entry changes. The repository skill files are seeded into these
 * tables at startup by {@code StudioSkillCatalog}, not here. Runs on H2 (MODE=MySQL) and MySQL.
 *
 * <ul>
 *   <li>{@code ip_skill}: one row per skill — runtime status (active | draft | withdrawn) and the version in effect.</li>
 *   <li>{@code ip_skill_version}: immutable content (front matter as JSON + Markdown body), source seed | admin | rollback |
 *       distilled, status published | draft; {@code UNIQUE(skill_key, version)}.</li>
 * </ul>
 * Column {@code skill_key} (not {@code key}): KEY is a reserved word in MySQL.
 */
public class V63__studio_skill extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c = context.getConnection();
        try (var s = c.createStatement()) {
            if (!exists(c, "ip_skill")) {
                s.executeUpdate("CREATE TABLE ip_skill ("
                        + "skill_key VARCHAR(64) NOT NULL PRIMARY KEY, name VARCHAR(64) NOT NULL, status VARCHAR(16) NOT NULL, "
                        + "current_version INT NOT NULL, summary VARCHAR(500) NULL, updated_by VARCHAR(64) NULL, seed_file VARCHAR(128) NULL, "
                        + "created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL)");
            }
            if (!exists(c, "ip_skill_version")) {
                s.executeUpdate("CREATE TABLE ip_skill_version ("
                        + "id VARCHAR(32) NOT NULL PRIMARY KEY, skill_key VARCHAR(64) NOT NULL, version INT NOT NULL, "
                        + "frontmatter_json TEXT NOT NULL, body_md LONGTEXT NOT NULL, content_digest VARCHAR(64) NOT NULL, "
                        + "source VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL, author VARCHAR(64) NOT NULL, note TEXT NULL, "
                        + "base_version INT NULL, source_project_id VARCHAR(32) NULL, source_execution_id VARCHAR(64) NULL, "
                        + "source_run_id VARCHAR(32) NULL, created_at DATETIME(6) NOT NULL, published_at DATETIME(6) NULL)");
                s.executeUpdate("CREATE UNIQUE INDEX uk_ip_skill_version ON ip_skill_version(skill_key, version)");
                s.executeUpdate("CREATE INDEX idx_ip_skill_version_status ON ip_skill_version(skill_key, status)");
            }
        }
    }

    private static boolean exists(java.sql.Connection c, String table) throws java.sql.SQLException {
        for (String name : List.of(table, table.toUpperCase())) {
            try (var tables = c.getMetaData().getTables(c.getCatalog(), null, name, null)) { if (tables.next()) return true; }
        }
        return false;
    }
}
