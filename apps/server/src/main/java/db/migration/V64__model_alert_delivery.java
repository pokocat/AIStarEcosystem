package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Notification delivery receipts only; never changes task state, wallet or model requests. */
public class V64__model_alert_delivery extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        try(var statement=context.getConnection().createStatement()) {
            statement.executeUpdate("CREATE TABLE IF NOT EXISTS model_alert_delivery ("
                + "id VARCHAR(36) NOT NULL PRIMARY KEY, task_id VARCHAR(128) NOT NULL, error_code VARCHAR(64) NOT NULL, "
                + "log_id VARCHAR(32) NOT NULL, message_text TEXT NOT NULL, state VARCHAR(16) NOT NULL, "
                + "message_id VARCHAR(128) NULL, attempts INT NOT NULL DEFAULT 0, last_error VARCHAR(128) NULL, "
                + "created_at DATETIME(6) NOT NULL, next_attempt_at DATETIME(6) NOT NULL, sent_at DATETIME(6) NULL)");
            statement.executeUpdate("CREATE INDEX idx_model_alert_due ON model_alert_delivery(state, next_attempt_at)");
        }
    }
}
