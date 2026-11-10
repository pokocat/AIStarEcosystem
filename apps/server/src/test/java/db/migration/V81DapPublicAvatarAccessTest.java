package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** V81：空库跳过；已有官方形象补 access=license（不默认放行），重复执行不报错。 */
class V81DapPublicAvatarAccessTest {
    private static Context context(Connection c) {
        Context ctx = mock(Context.class);
        when(ctx.getConnection()).thenReturn(c);
        return ctx;
    }

    @Test
    void skipsWhenTheTableIsNotThereYet() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:v81empty;MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            assertDoesNotThrow(() -> new V81__dap_public_avatar_access().migrate(context(c)));
        }
    }

    @Test
    void existingRowsNeedALicense() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:v81;MODE=MySQL;DB_CLOSE_DELAY=-1"); var s = c.createStatement()) {
            s.execute("create table dap_public_avatar (id varchar(32) primary key, name varchar(128))");
            s.execute("insert into dap_public_avatar values ('PA-abc', '运营上架')");

            new V81__dap_public_avatar_access().migrate(context(c));
            new V81__dap_public_avatar_access().migrate(context(c));

            try (var r = s.executeQuery("select access from dap_public_avatar where id='PA-abc'")) {
                assertTrue(r.next());
                assertEquals("license", r.getString(1));
            }
        }
    }
}
