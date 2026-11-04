package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class V73EnterprisePolicyDefaultsTest {
    @Test void onlyNeverEditedPoliciesGetTheNewInFlightLimit() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:v73-policy;MODE=MySQL")) {
            try(var s=c.createStatement()) {
                s.execute("CREATE TABLE aep_enterprise_policies(enterprise_id VARCHAR(64) PRIMARY KEY,allowed_endpoint_ids_json LONGTEXT NOT NULL,max_active_jobs INT NOT NULL,version BIGINT NOT NULL)");
                s.execute("INSERT INTO aep_enterprise_policies VALUES('created','[]',1,0)");
                // The owner chose one task at a time, and another owner restricted models: both are their own settings.
                s.execute("INSERT INTO aep_enterprise_policies VALUES('owner-chose-one','[]',1,2)");
                s.execute("INSERT INTO aep_enterprise_policies VALUES('owner-chose-models','[\"image\"]',3,1)");
            }
            Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V73__enterprise_policy_defaults().migrate(ctx);
            assertEquals("10/1/[]",row(c,"created"));
            assertEquals("1/2/[]",row(c,"owner-chose-one"));
            assertEquals("3/1/[\"image\"]",row(c,"owner-chose-models"));
            new V73__enterprise_policy_defaults().migrate(ctx);
            assertEquals("10/1/[]",row(c,"created"));
        }
    }
    @Test void freshSchemaLeavesTheTableToHibernate() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:v73-fresh;MODE=MySQL")){Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V73__enterprise_policy_defaults().migrate(ctx);}
    }
    private static String row(Connection c,String id) throws Exception {
        try(var s=c.prepareStatement("SELECT max_active_jobs,version,allowed_endpoint_ids_json FROM aep_enterprise_policies WHERE enterprise_id=?")) {
            s.setString(1,id);try(var r=s.executeQuery()){assertTrue(r.next());return r.getInt(1)+"/"+r.getLong(2)+"/"+r.getString(3);}
        }
    }
}
