package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.zip.CRC32;

/** Existing production ledgers are altered; fresh development ledgers are created later by Hibernate. */
public class V67__model_scoped_credits extends BaseJavaMigration {
    private static final String SCHEMA="db/schema/model-scoped-credits.sql";
    @Override public Integer getChecksum() {
        try(var input=new ClassPathResource(SCHEMA).getInputStream()) {
            var checksum=new CRC32();checksum.update(input.readAllBytes());
            checksum.update("ledger-grant-id-index-entry-type-v2".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return (int)checksum.getValue();
        } catch(java.io.IOException e){throw new IllegalStateException("Missing model billing migration schema",e);}
    }
    @Override public void migrate(Context context) throws Exception {
        Connection connection=context.getConnection();
        ScriptUtils.executeSqlScript(connection,new ClassPathResource(SCHEMA));
        if(!table(connection,"aep_ledger_entries"))return;
        try(var statement=connection.createStatement()) {
            statement.execute("ALTER TABLE aep_ledger_entries ADD COLUMN grant_id VARCHAR(64)");
            statement.execute("CREATE INDEX idx_ledger_scoped_grant ON aep_ledger_entries(grant_id,created_at)");
            // Existing MySQL schemas may use a Hibernate native enum with only the old entry types.
            if(connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT).contains("mysql"))
                statement.execute("ALTER TABLE aep_ledger_entries MODIFY COLUMN entry_type VARCHAR(255)");
        }
    }
    private static boolean table(Connection connection,String name)throws SQLException {
        for(String candidate:List.of(name,name.toUpperCase(Locale.ROOT)))
            try(var rows=connection.getMetaData().getTables(connection.getCatalog(),null,candidate,new String[]{"TABLE"})) {
                if(rows.next())return true;
            }
        return false;
    }
}
