package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AiModelTokenUsageTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void acceptsReportedImageAndChatTokenNamesWithoutInventingMissingUsage() throws Exception {
        assertEquals(new AiModelTokenUsage(10L, 20L, 30L), AiModelTokenUsage.from(mapper.readTree(
                "{\"usage\":{\"input_tokens\":10,\"output_tokens\":20,\"total_tokens\":30}}")));
        assertEquals(new AiModelTokenUsage(10L, 20L, 30L), AiModelTokenUsage.from(mapper.readTree(
                "{\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":20}}")));
        assertEquals(new AiModelTokenUsage(null, null, null), AiModelTokenUsage.from(mapper.readTree("{}")));
        assertEquals(new AiModelTokenUsage(null, null, null), AiModelTokenUsage.from(mapper.readTree(
                "{\"usage\":{\"input_tokens\":-1,\"output_tokens\":\"unknown\"}}")));
    }
}
