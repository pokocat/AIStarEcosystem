package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StudioIpAssetRoleMigrationTest {
    @Test void restartPreservesExistingMediaAndSourceWithoutInventingClassification() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:ip-role;MODE=MySQL")) {
            try(var s=c.createStatement()){s.execute("CREATE TABLE dap_look(id VARCHAR(32),source VARCHAR(16),image_key VARCHAR(512))");s.execute("INSERT INTO dap_look VALUES('old','design','owned.png')");}
            Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);var migration=new V45__studio_ip_asset_role();migration.migrate(ctx);migration.migrate(ctx);
            try(var s=c.createStatement();var r=s.executeQuery("SELECT source,image_key,asset_role FROM dap_look")){assertTrue(r.next());assertEquals("design",r.getString(1));assertEquals("owned.png",r.getString(2));assertNull(r.getString(3));}
        }
    }
    @Test void freshSchemaDefersToHibernateWithoutCreatingAnIncompleteTable() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:ip-role-fresh;MODE=MySQL")){Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V45__studio_ip_asset_role().migrate(ctx);}
    }
}
