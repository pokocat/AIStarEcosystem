package db.migration;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublishRetryMigrationTest {
    @Test
    void existingRowsStartAtZeroAndMigrationIsIdempotent() throws Exception {
        try (var c = java.sql.DriverManager.getConnection("jdbc:h2:mem:publish_retry_migration;MODE=MySQL", "sa", "")) {
            var context = mock(org.flywaydb.core.api.migration.Context.class);
            when(context.getConnection()).thenReturn(c);
            var migration = new V38__publish_retry_count();
            migration.migrate(context); // fresh schema: Hibernate will create the table
            try (var s = c.createStatement()) {
                s.execute("CREATE TABLE aep_publish_jobs (id VARCHAR(64) PRIMARY KEY)");
                s.execute("INSERT INTO aep_publish_jobs VALUES ('inflight-before-upgrade')");
            }
            migration.migrate(context);
            migration.migrate(context);
            try (var s = c.createStatement(); var rows = s.executeQuery("SELECT retry_count FROM aep_publish_jobs")) {
                assertTrue(rows.next()); assertEquals(0, rows.getInt(1)); assertFalse(rows.wasNull());
            }
        }
    }
}
