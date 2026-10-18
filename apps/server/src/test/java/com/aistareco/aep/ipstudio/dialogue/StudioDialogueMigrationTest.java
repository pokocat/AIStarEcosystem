package com.aistareco.aep.ipstudio.dialogue;

import db.migration.V60__chat_endpoint_tool_streaming;
import db.migration.V61__studio_dialogue;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import java.sql.SQLException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** V60 / V61 execute on H2 in MySQL mode (the dev database), are idempotent, and enforce the idempotency keys. */
class StudioDialogueMigrationTest {
    @Test void v60AddsNullableCapabilityColumnsAndLeavesExistingEndpointsUnknown() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:v60" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            try (var s = db.createStatement()) {
                s.execute("CREATE TABLE ai_model_providers (id VARCHAR(80) PRIMARY KEY, default_model VARCHAR(100))");
                s.execute("INSERT INTO ai_model_providers VALUES ('a','gpt-4o')");
            }
            Context context = mock(Context.class);
            when(context.getConnection()).thenReturn(db);
            new V60__chat_endpoint_tool_streaming().migrate(context);
            new V60__chat_endpoint_tool_streaming().migrate(context); // re-run is a no-op
            try (var s = db.createStatement(); var r = s.executeQuery("SELECT chat_supports_tools, chat_supports_streaming FROM ai_model_providers")) {
                assertTrue(r.next());
                assertNull(r.getObject(1), "unknown is never guessed from the model name");
                assertNull(r.getObject(2));
            }
        }
    }

    @Test void v61CreatesTheDialogueTablesWithTheirUniqueKeys() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:v61" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            Context context = mock(Context.class);
            when(context.getConnection()).thenReturn(db);
            new V61__studio_dialogue().migrate(context);
            new V61__studio_dialogue().migrate(context);
            try (var s = db.createStatement()) {
                s.execute("INSERT INTO ip_dialogue_thread (id, project_id, owner_user_id, created_at, updated_at) VALUES ('IPT-P','P','u',NOW(),NOW())");
                s.execute("INSERT INTO ip_dialogue_message (id, thread_id, seq, role, text, status, client_message_id, created_at) VALUES ('m1','IPT-P',1,'user','你好','done','c1',NOW())");
                s.execute("INSERT INTO ip_dialogue_message (id, thread_id, seq, role, text, status, created_at) VALUES ('m2','IPT-P',2,'assistant','','streaming',NOW())");
                s.execute("INSERT INTO ip_dialogue_message (id, thread_id, seq, role, text, status, created_at) VALUES ('m3','IPT-P',3,'system','x','done',NOW())");
                assertThrows(SQLException.class, () -> s.execute("INSERT INTO ip_dialogue_message (id, thread_id, seq, role, status, client_message_id, created_at) VALUES ('m4','IPT-P',4,'user','done','c1',NOW())"),
                        "same clientMessageId on a thread is one message");
                assertThrows(SQLException.class, () -> s.execute("INSERT INTO ip_dialogue_message (id, thread_id, seq, role, status, created_at) VALUES ('m5','IPT-P',1,'user','done',NOW())"));
                s.execute("INSERT INTO ip_dialogue_event (id, thread_id, seq, type, data_json, created_at) VALUES ('e1','IPT-P',1,'message.delta','{}',NOW())");
                assertThrows(SQLException.class, () -> s.execute("INSERT INTO ip_dialogue_event (id, thread_id, seq, type, data_json, created_at) VALUES ('e2','IPT-P',1,'turn.done','{}',NOW())"));
                s.execute("INSERT INTO ip_dialogue_steering (id, thread_id, message_id, status, created_at) VALUES ('s1','IPT-P','m1','queued',NOW())");
                assertThrows(SQLException.class, () -> s.execute("INSERT INTO ip_dialogue_steering (id, thread_id, message_id, status, created_at) VALUES ('s2','IPT-P','m1','queued',NOW())"));
                s.execute("INSERT INTO ip_dialogue_thread (id, project_id, owner_user_id, client_request_id, created_at, updated_at) VALUES ('IPT-B1','P','u','br-1',NOW(),NOW())");
                assertThrows(SQLException.class, () -> s.execute("INSERT INTO ip_dialogue_thread (id, project_id, owner_user_id, client_request_id, created_at, updated_at) VALUES ('IPT-B2','P','u','br-1',NOW(),NOW())"));
            }
        }
    }
}
