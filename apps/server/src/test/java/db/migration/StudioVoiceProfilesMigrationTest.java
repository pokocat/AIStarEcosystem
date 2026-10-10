package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioVoiceProfilesMigrationTest {
    @Test void keepsLegacySamplesAndEnforcesSourceUniqueness() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:voice-profiles")) {
            try(var s=c.createStatement()) {
                s.execute("CREATE TABLE dap_avatar(id VARCHAR(32),voice_name VARCHAR(64))");s.execute("CREATE TABLE dap_voice(id VARCHAR(32),avatar_id VARCHAR(32),kind VARCHAR(8))");
                s.execute("INSERT INTO dap_voice VALUES('legacy-1','a','clone'),('legacy-2','a','clone')");s.execute("INSERT INTO dap_avatar VALUES('a','legacy name')");
            }
            Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);var migration=new V43__studio_voice_profiles();migration.migrate(ctx);migration.migrate(ctx);
            try(var s=c.createStatement()) {
                try(var r=s.executeQuery("SELECT profile_version,kind FROM dap_voice WHERE id='legacy-1'")){assertTrue(r.next());assertNull(r.getObject(1));assertEquals("clone",r.getString(2));}
                s.execute("INSERT INTO dap_voice(id,avatar_id,kind,profile_version,source_run_id) VALUES('v1','a','preset',1,'r')");
                assertThrows(SQLException.class,()->s.execute("INSERT INTO dap_voice(id,avatar_id,kind,profile_version,source_run_id) VALUES('v2','a','preset',2,'r')"));
                s.execute("INSERT INTO dap_voice(id,avatar_id,kind,profile_version,source_run_id) VALUES('v3','b','preset',1,'r')");
                try(var r=s.executeQuery("SELECT voice_name,voice_id FROM dap_avatar")){assertTrue(r.next());assertEquals("legacy name",r.getString(1));assertNull(r.getString(2));}
            }
        }
    }
    @Test void freshDatabaseCanBeCreatedByHibernateAfterMigration() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:voice-fresh")){Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V43__studio_voice_profiles().migrate(ctx);}
    }
}
