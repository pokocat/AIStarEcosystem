package db.migration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class V74EnterpriseMemberBillingDefaultTest {
    @Test void existingMembersStartAskingAndTheMigrationRunsOnce() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:v74-default;MODE=MySQL")) {
            try(var s=c.createStatement()) {
                s.execute("CREATE TABLE aep_enterprise_members(id VARCHAR(64) PRIMARY KEY,status VARCHAR(16) NOT NULL,version BIGINT NOT NULL)");
                s.execute("INSERT INTO aep_enterprise_members VALUES('m1','active',3)");
            }
            Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);
            new V74__enterprise_member_billing_default().migrate(ctx);
            // A Hibernate-updated dev schema may already have the column: running again changes nothing.
            new V74__enterprise_member_billing_default().migrate(ctx);
            try(var s=c.createStatement();var r=s.executeQuery("SELECT billing_default,version FROM aep_enterprise_members WHERE id='m1'")) {
                assertTrue(r.next());assertNull(r.getString(1));assertEquals(3,r.getLong(2));
            }
        }
    }
    @Test void freshSchemaLeavesTheTableToHibernate() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:h2:mem:v74-fresh;MODE=MySQL")){Context ctx=mock(Context.class);when(ctx.getConnection()).thenReturn(c);new V74__enterprise_member_billing_default().migrate(ctx);}
    }
}
