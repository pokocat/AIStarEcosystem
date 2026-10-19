package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioLipSyncPurposeMigrationTest {
    @Test void persistentEnumUpgradeKeepsExistingBindingsAndAcceptsAudio() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:lip-sync-purpose;DB_CLOSE_DELAY=-1")) {
            try(var s=c.createStatement()) {
                s.execute("CREATE TABLE ai_app_binding(purpose ENUM('DAP_IMAGE','DAP_VIDEO','DAP_AUDIO') PRIMARY KEY,endpoint_id VARCHAR(60))");
                s.execute("CREATE TABLE ai_app_endpoint_candidate(purpose ENUM('DAP_IMAGE','DAP_VIDEO','DAP_AUDIO'),endpoint_id VARCHAR(60))");
                s.execute("INSERT INTO ai_app_binding VALUES('DAP_VIDEO','existing-video')");
            }
            Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);
            var migration=new V42__studio_lip_sync_purpose();migration.migrate(ctx);migration.migrate(ctx);
            try(var s=c.createStatement()) {
                s.execute("INSERT INTO ai_app_binding VALUES('DAP_LIP_SYNC','new-lips')");
                s.execute("INSERT INTO ai_app_endpoint_candidate VALUES('DAP_LIP_SYNC','new-lips')");
                try(var rows=s.executeQuery("SELECT endpoint_id FROM ai_app_binding WHERE purpose='DAP_VIDEO'")){assertTrue(rows.next());assertEquals("existing-video",rows.getString(1));}
            }
        }
    }
}
