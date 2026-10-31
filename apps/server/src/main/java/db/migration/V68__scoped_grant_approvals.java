package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.util.List;
import java.util.Locale;

/** Extend existing operations approvals; fresh development tables are created later by Hibernate. */
public class V68__scoped_grant_approvals extends BaseJavaMigration {
    @Override public Integer getChecksum() { return 670001; }
    @Override public void migrate(Context context) throws Exception {
        var connection=context.getConnection();
        boolean exists=false;
        for(String name:List.of("credit_adjustment_request","CREDIT_ADJUSTMENT_REQUEST")) {
            try(var tables=connection.getMetaData().getTables(connection.getCatalog(),null,name,new String[]{"TABLE"})) {
                if(tables.next())exists=true;
            }
        }
        if(!exists)return;
        boolean mysql=connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT).contains("mysql");
        try(var statement=connection.createStatement()) {
            statement.execute("ALTER TABLE credit_adjustment_request ADD COLUMN wallet_id VARCHAR(255)");
            statement.execute("ALTER TABLE credit_adjustment_request ADD COLUMN expires_at "+(mysql?"DATETIME(6)":"TIMESTAMP(6)"));
            statement.execute("ALTER TABLE credit_adjustment_request ADD COLUMN grant_id VARCHAR(64)");
            // MySQL Hibernate-created tables may have native ENUM('COMPENSATE','GRANT').
            if(mysql)
                statement.execute("ALTER TABLE credit_adjustment_request MODIFY COLUMN type VARCHAR(16) NOT NULL");
        }
    }
}
