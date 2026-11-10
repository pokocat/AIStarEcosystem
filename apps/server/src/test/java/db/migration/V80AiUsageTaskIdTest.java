package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** V80：表由 Hibernate 建，空库跳过；已有表加 task_id 和索引，重复执行不报错。 */
class V80AiUsageTaskIdTest {
    private static Context context(Connection c) {
        Context ctx = mock(Context.class);
        when(ctx.getConnection()).thenReturn(c);
        return ctx;
    }

    @Test
    void skipsWhenTheTableIsNotThereYet() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:v80empty;MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            assertDoesNotThrow(() -> new V80__ai_usage_task_id().migrate(context(c)));
        }
    }

    @Test
    void addsTheColumnAndIndexOnceAndKeepsExistingRows() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:v80;MODE=MySQL;DB_CLOSE_DELAY=-1"); var s = c.createStatement()) {
            s.execute("create table ai_model_usage_record (id varchar(64) primary key, request_id varchar(96))");
            s.execute("insert into ai_model_usage_record values ('aiu-1', 'aic-1')");

            new V80__ai_usage_task_id().migrate(context(c));
            new V80__ai_usage_task_id().migrate(context(c));

            try (var r = s.executeQuery("select id, task_id from ai_model_usage_record")) {
                assertTrue(r.next());
                assertEquals("aiu-1", r.getString(1));
                assertNull(r.getString(2));
            }
            s.execute("update ai_model_usage_record set task_id='IPR-1' where id='aiu-1'");
            boolean indexed = false;
            try (var r = c.getMetaData().getIndexInfo(c.getCatalog(), null, "AI_MODEL_USAGE_RECORD", false, true)) {
                while (r.next()) if ("idx_aiusage_task".equalsIgnoreCase(r.getString("INDEX_NAME"))) indexed = true;
            }
            assertTrue(indexed);
        }
    }
}
