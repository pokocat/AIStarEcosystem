package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioVideoEffectsMigrationTest {
    @Test void additiveMigrationIsRestartSafeAndScopesActivityToOwner()throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:video-effects;MODE=MySQL")) {
            try(var s=c.createStatement()){s.execute("CREATE TABLE ip_project(id VARCHAR(32),doc_json LONGTEXT)");s.execute("INSERT INTO ip_project VALUES('old','{keep}')");}
            var ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);var migration=new V46__studio_video_effects();migration.migrate(ctx);migration.migrate(ctx);
            try(var s=c.createStatement()) {
                try(var r=s.executeQuery("SELECT COUNT(*) FROM ip_video_effect")){assertTrue(r.next());assertEquals(3,r.getInt(1));}
                try(var r=s.executeQuery("SELECT doc_json FROM ip_project")){assertTrue(r.next());assertEquals("{keep}",r.getString(1));}
                s.execute("INSERT INTO ip_video_effect_activity VALUES('a','owner','effect',TRUE,CURRENT_TIMESTAMP)");
                assertThrows(SQLException.class,()->s.execute("INSERT INTO ip_video_effect_activity VALUES('dup','owner','effect',FALSE,NULL)"));
                s.execute("INSERT INTO ip_video_effect_activity VALUES('b','stranger','effect',FALSE,NULL)");
            }
        }
    }
}
