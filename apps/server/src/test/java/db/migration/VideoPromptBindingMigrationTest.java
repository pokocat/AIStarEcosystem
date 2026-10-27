package db.migration;

import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VideoPromptBindingMigrationTest {
    @Test void initializesQwenOnceAndPreservesLaterAdminRebinding() throws Exception {
        assertEquals("69.1",new V69_1__video_prompt_binding().getVersion().toString());
        try(var c=DriverManager.getConnection("jdbc:h2:mem:video-prompt;DB_CLOSE_DELAY=-1")) {
            try(var s=c.createStatement()) {
                s.execute("CREATE TABLE ai_model_providers(id VARCHAR PRIMARY KEY,enabled BOOLEAN)");
                s.execute("CREATE TABLE ai_app_binding(purpose VARCHAR PRIMARY KEY,endpoint_id VARCHAR,updated_at TIMESTAMP)");
                s.execute("CREATE TABLE ai_app_endpoint_candidate(id VARCHAR PRIMARY KEY,purpose VARCHAR,endpoint_id VARCHAR,sort_order INT,enabled BOOLEAN,created_at TIMESTAMP,updated_at TIMESTAMP)");
                s.execute("INSERT INTO ai_model_providers VALUES('ai-studio-jusuan-qwen38',TRUE),('other',TRUE)");
            }
            var context=mock(Context.class);when(context.getConnection()).thenReturn(c);
            var migration=new V69_1__video_prompt_binding();migration.migrate(context);migration.migrate(context);
            try(var s=c.createStatement();var r=s.executeQuery("SELECT b.endpoint_id,COUNT(c.id) FROM ai_app_binding b JOIN ai_app_endpoint_candidate c ON b.purpose=c.purpose AND b.endpoint_id=c.endpoint_id GROUP BY b.endpoint_id")) {
                assertTrue(r.next());assertEquals("ai-studio-jusuan-qwen38",r.getString(1));assertEquals(1,r.getInt(2));assertFalse(r.next());
            }
            try(var s=c.createStatement()){s.execute("UPDATE ai_app_binding SET endpoint_id='other'");}
            migration.migrate(context);
            try(var s=c.createStatement();var r=s.executeQuery("SELECT endpoint_id FROM ai_app_binding")) {
                assertTrue(r.next());assertEquals("other",r.getString(1));
            }
        }
    }
}
