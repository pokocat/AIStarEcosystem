package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class V53ChatEndpointCapabilitiesTest {
    @Test
    void migratesKnownQwenRoutesWithoutChangingOtherEndpoints() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:chat-capabilities;MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            try (var s = db.createStatement()) {
                s.execute("CREATE TABLE ai_model_providers (id VARCHAR(80) PRIMARY KEY, default_model VARCHAR(100))");
                s.execute("INSERT INTO ai_model_providers VALUES ('q35','qwen3-5-9b'),('q36','qwen3-6-35b-a3b'),('other','custom-chat')");
            }
            Context context = mock(Context.class);
            when(context.getConnection()).thenReturn(db);
            new V53__chat_endpoint_capabilities().migrate(context);
            try (var s = db.createStatement(); var rows = s.executeQuery("SELECT id,chat_supports_temperature,chat_supports_top_p,chat_supports_response_format,chat_max_output_tokens FROM ai_model_providers ORDER BY id")) {
                rows.next();
                assertEquals("other", rows.getString(1));
                assertNull(rows.getObject(2));
                assertNull(rows.getObject(3));
                assertNull(rows.getObject(4));
                assertNull(rows.getObject(5));
                rows.next();
                assertEquals("q35", rows.getString(1));
                assertEquals(false, rows.getBoolean(2));
                assertNull(rows.getObject(3));
                assertEquals(false, rows.getBoolean(4));
                assertEquals(4096, rows.getInt(5));
                rows.next();
                assertEquals("q36", rows.getString(1));
                assertEquals(false, rows.getBoolean(2));
                assertNull(rows.getObject(3));
                assertEquals(false, rows.getBoolean(4));
                assertNull(rows.getObject(5));
            }
        }
    }
}
