package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;

/**
 * Studio conversational threads (S1): threads, raw messages, the replayable event projection and the steering queue.
 *
 * <p>These tables hold conversation content and pointers only. Task state, plan execution and money stay in
 * {@code ip_run} / native jobs / the ledger; nothing here is a second source of truth for them.
 * Works on H2 (MySQL mode) and MySQL; idempotent so a partially applied schema can be re-run.
 */
public class V61__studio_dialogue extends BaseJavaMigration {
    static final List<String> TABLES = List.of(
        "CREATE TABLE IF NOT EXISTS ip_dialogue_thread (id VARCHAR(32) PRIMARY KEY, project_id VARCHAR(32) NOT NULL, owner_user_id VARCHAR(64) NOT NULL, "
            + "parent_thread_id VARCHAR(32) NULL, branch_from_message_id VARCHAR(32) NULL, client_request_id VARCHAR(64) NULL, title VARCHAR(128) NULL, "
            + "skill_key VARCHAR(64) NULL, skill_version INT NULL, stage VARCHAR(16) NULL, last_seq BIGINT NOT NULL DEFAULT 0, message_seq BIGINT NOT NULL DEFAULT 0, "
            + "event_floor_seq BIGINT NOT NULL DEFAULT 0, plan_revision INT NOT NULL DEFAULT 0, active_turn_id VARCHAR(32) NULL, active_run_id VARCHAR(32) NULL, "
            + "active_execution_id VARCHAR(64) NULL, last_control_id VARCHAR(64) NULL, history_summary LONGTEXT NULL, history_summary_seq BIGINT NOT NULL DEFAULT 0, "
            + "last_opened_at TIMESTAMP(6) NULL, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, "
            + "CONSTRAINT uk_ip_dialogue_thread_project UNIQUE(project_id,id), CONSTRAINT uk_ip_dialogue_thread_branch UNIQUE(owner_user_id,client_request_id))",
        "CREATE TABLE IF NOT EXISTS ip_dialogue_message (id VARCHAR(32) PRIMARY KEY, thread_id VARCHAR(32) NOT NULL, seq BIGINT NOT NULL, turn_id VARCHAR(32) NULL, "
            + "run_id VARCHAR(32) NULL, role VARCHAR(16) NOT NULL, text LONGTEXT NULL, blocks_json LONGTEXT NULL, pinned_node_ids_json LONGTEXT NULL, "
            + "attachment_node_ids_json LONGTEXT NULL, client_message_id VARCHAR(64) NULL, request_json LONGTEXT NULL, billing_json LONGTEXT NULL, "
            + "settling BOOLEAN NOT NULL DEFAULT FALSE, status VARCHAR(16) NOT NULL, legacy_node_id VARCHAR(64) NULL, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NULL, "
            + "CONSTRAINT uk_ip_dialogue_message_seq UNIQUE(thread_id,seq), CONSTRAINT uk_ip_dialogue_message_client UNIQUE(thread_id,client_message_id))",
        "CREATE TABLE IF NOT EXISTS ip_dialogue_event (id VARCHAR(32) PRIMARY KEY, thread_id VARCHAR(32) NOT NULL, seq BIGINT NOT NULL, turn_id VARCHAR(32) NULL, "
            + "run_id VARCHAR(32) NULL, execution_id VARCHAR(64) NULL, type VARCHAR(32) NOT NULL, data_json LONGTEXT NOT NULL, created_at TIMESTAMP(6) NOT NULL, "
            + "CONSTRAINT uk_ip_dialogue_event_seq UNIQUE(thread_id,seq))",
        "CREATE TABLE IF NOT EXISTS ip_dialogue_steering (id VARCHAR(32) PRIMARY KEY, thread_id VARCHAR(32) NOT NULL, message_id VARCHAR(32) NOT NULL, "
            + "turn_id VARCHAR(32) NULL, execution_id VARCHAR(64) NULL, status VARCHAR(16) NOT NULL, created_at TIMESTAMP(6) NOT NULL, applied_at TIMESTAMP(6) NULL, "
            + "CONSTRAINT uk_ip_dialogue_steering_message UNIQUE(message_id))");

    @Override public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        for (String ddl : TABLES) try (var s = c.createStatement()) { s.execute(ddl); }
        index(c, "ip_dialogue_thread", "idx_ip_dialogue_thread_open", "project_id,owner_user_id,last_opened_at", false);
        index(c, "ip_dialogue_thread", "idx_ip_dialogue_thread_active", "active_run_id", false);
        index(c, "ip_dialogue_event", "idx_ip_dialogue_event_created", "thread_id,created_at", false);
        index(c, "ip_dialogue_steering", "idx_ip_dialogue_steering_queue", "thread_id,status,created_at", false);
    }
    private static void index(Connection c, String t, String name, String columns, boolean unique) throws SQLException {
        for (String n : List.of(t, t.toUpperCase(Locale.ROOT)))
            try (var r = c.getMetaData().getIndexInfo(c.getCatalog(), null, n, false, false)) {
                while (r.next()) if (name.equalsIgnoreCase(r.getString("INDEX_NAME"))) return;
            }
        try (var s = c.createStatement()) { s.execute("CREATE " + (unique ? "UNIQUE " : "") + "INDEX " + name + " ON " + t + "(" + columns + ")"); }
    }
}
