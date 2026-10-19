package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.util.List;

/**
 * Studio plan execution orchestration table (docs/ip-studio-conversational-video-recreation-plan.md §三处真值与新执行表).
 * New table only: no existing row, price, hold or ledger entry changes. Runs on H2 (MODE=MySQL) and MySQL.
 * V60/V61 are reserved by the dialogue thread migrations.
 */
public class V62__studio_plan_execution extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        for(String table:List.of("ip_plan_execution","IP_PLAN_EXECUTION")) {
            try(var tables=c.getMetaData().getTables(c.getCatalog(),null,table,null)) {if(tables.next())return;}
        }
        try(var s=c.createStatement()) {
            s.executeUpdate("CREATE TABLE ip_plan_execution ("
                    + "id VARCHAR(32) NOT NULL PRIMARY KEY, project_id VARCHAR(32) NOT NULL, owner_user_id VARCHAR(64) NOT NULL, "
                    + "thread_id VARCHAR(64) NULL, skill_key VARCHAR(64) NOT NULL, skill_version INT NOT NULL, stage VARCHAR(16) NOT NULL, "
                    + "plan_run_id VARCHAR(32) NOT NULL, plan_revision INT NOT NULL, plan_fingerprint VARCHAR(64) NOT NULL, "
                    + "status VARCHAR(16) NOT NULL, steps_json LONGTEXT NOT NULL, budget_json LONGTEXT NOT NULL, "
                    + "spent BIGINT NOT NULL DEFAULT 0, in_flight BIGINT NOT NULL DEFAULT 0, billing_json TEXT NOT NULL, "
                    + "lease_owner VARCHAR(64) NULL, lease_until DATETIME(6) NULL, lease_version BIGINT NOT NULL DEFAULT 0, "
                    + "client_request_id VARCHAR(64) NOT NULL, started_at DATETIME(6) NULL, deadline_at DATETIME(6) NULL, "
                    + "created_at DATETIME(6) NULL, updated_at DATETIME(6) NULL, finished_at DATETIME(6) NULL)");
            s.executeUpdate("CREATE UNIQUE INDEX uk_ip_plan_execution_request ON ip_plan_execution(owner_user_id, client_request_id)");
            s.executeUpdate("CREATE INDEX idx_ip_plan_execution_project ON ip_plan_execution(project_id, status)");
        }
    }
}
