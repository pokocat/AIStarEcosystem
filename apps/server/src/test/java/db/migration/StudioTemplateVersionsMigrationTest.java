package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplateVersionsMigrationTest {
    @Test void additiveMigrationPreservesLegacyDocsAndEnforcesUniqueVersions() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:template-versions;MODE=MySQL")) {
            try(var s=c.createStatement()) {s.execute("CREATE TABLE ip_demo_template(id VARCHAR(32),doc_json LONGTEXT)");s.execute("INSERT INTO ip_demo_template VALUES('legacy','{legacy}')");s.execute("CREATE TABLE ip_project(id VARCHAR(32),doc_json LONGTEXT)");s.execute("INSERT INTO ip_project VALUES('old','{old}')");}
            Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);var migration=new V44__studio_template_versions();migration.migrate(ctx);migration.migrate(ctx);
            try(var s=c.createStatement()) {
                try(var r=s.executeQuery("SELECT doc_json,visibility,current_version_id FROM ip_demo_template")){assertTrue(r.next());assertEquals("{legacy}",r.getString(1));assertEquals("official",r.getString(2));assertNull(r.getString(3));}
                try(var r=s.executeQuery("SELECT doc_json,template_version_id FROM ip_project")){assertTrue(r.next());assertEquals("{old}",r.getString(1));assertNull(r.getString(2));}
                s.execute("INSERT INTO ip_template_version VALUES('v1','t',1,'name','','{}','{}',CURRENT_TIMESTAMP)");
                assertThrows(SQLException.class,()->s.execute("INSERT INTO ip_template_version VALUES('duplicate','t',1,'name','','{}','{}',CURRENT_TIMESTAMP)"));
                s.execute("INSERT INTO ip_template_version VALUES('v2','t',2,'name','','{}','{}',CURRENT_TIMESTAMP)");
            }
        }
    }
    @Test void freshSchemaCanCreateReleaseTableBeforeHibernate() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:template-fresh;MODE=MySQL")){Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V44__studio_template_versions().migrate(ctx);}
    }
}
