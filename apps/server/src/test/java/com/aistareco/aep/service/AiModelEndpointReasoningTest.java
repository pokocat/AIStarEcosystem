package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAiModelEndpointUpsertDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiModelEndpointReasoningTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AiModelEndpointRepository repo = mock(AiModelEndpointRepository.class);
    private final AiModelEndpointAdminService service = new AiModelEndpointAdminService(repo, null, null);

    @Test void adminCanSetKeepClearAndRebindEffort() throws Exception {
        var ep = AiModelEndpoint.builder().id("chat").name("chat").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://vendor.example/v1").model("sonnet").build();
        when(repo.findById("chat")).thenReturn(Optional.of(ep));
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        assertEquals("low", update("{\"chatReasoningEffort\":\"low\"}").chatReasoningEffort());
        update("{\"name\":\"sun5.5\"}");
        assertEquals("low", ep.getChatReasoningEffort());
        update("{\"chatReasoningEffort\":\"\"}");
        assertNull(ep.getChatReasoningEffort());
        update("{\"chatReasoningEffort\":\"low\"}");
        update("{\"model\":\"another-model\"}");
        assertNull(ep.getChatReasoningEffort(), "A model switch needs an explicit new reasoning declaration");
        update("{\"model\":\"sonnet\",\"chatReasoningEffort\":\"low\"}");
        assertEquals("low", ep.getChatReasoningEffort());
        update("{\"baseUrl\":\"https://other.example/v1\"}");
        assertNull(ep.getChatReasoningEffort());
        var error = assertThrows(BusinessException.class, () -> update("{\"chatReasoningEffort\":\"invalid\"}"));
        assertEquals("AI_REASONING_EFFORT_INVALID", error.getCode());
    }

    @Test void creationValidatesTheSetting() throws Exception {
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        String body = "{\"name\":\"sonnet\",\"baseUrl\":\"https://vendor.example/v1\",\"apiKey\":\"test\",\"model\":\"sonnet\",\"chatReasoningEffort\":\"%s\"}";
        assertEquals("low", service.create(mapper.readValue(body.formatted("low"), AdminAiModelEndpointUpsertDto.class)).chatReasoningEffort());
        assertThrows(BusinessException.class, () -> service.create(mapper.readValue(body.formatted("invalid"), AdminAiModelEndpointUpsertDto.class)));
    }

    @Test void migrationIsNullableAndCanRunOnFreshAndExistingSchemas() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:reasoning-migration", "sa", "")) {
            var context = mock(org.flywaydb.core.api.migration.Context.class);
            when(context.getConnection()).thenReturn(c);
            var migration = new db.migration.V77__chat_reasoning_effort();
            migration.migrate(context);
            try (var s = c.createStatement()) {
                s.execute("CREATE TABLE ai_model_providers (id VARCHAR(64) PRIMARY KEY)");
                s.execute("INSERT INTO ai_model_providers (id) VALUES ('existing')");
                migration.migrate(context);
                migration.migrate(context);
                try (var r = s.executeQuery("SELECT chat_reasoning_effort FROM ai_model_providers WHERE id='existing'")) {
                    assertTrue(r.next()); assertNull(r.getString(1));
                }
            }
        }
    }

    private com.aistareco.aep.dto.AiModelEndpointDto update(String json) throws Exception {
        return service.update("chat", mapper.readValue(json, AdminAiModelEndpointUpsertDto.class));
    }
}
