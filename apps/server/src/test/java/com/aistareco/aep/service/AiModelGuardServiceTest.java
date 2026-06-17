package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiModelGuardServiceTest {

    @Test
    void rejectsRequestsOverRpmLimit() {
        AiModelGuardService guard = new AiModelGuardService(mock(AiModelUsageRecordRepository.class));
        AiModelEndpoint endpoint = endpoint("p-rpm");
        endpoint.setRpmLimit(1);

        guard.checkBeforeCall(endpoint, new AiModelGuardService.TokenEstimate(1, 1));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> guard.checkBeforeCall(endpoint, new AiModelGuardService.TokenEstimate(1, 1)));

        assertEquals("LLM_RPM_LIMIT_EXCEEDED", ex.getCode());
    }

    @Test
    void rejectsWhenDailyTokenQuotaWouldBeExceeded() {
        AiModelUsageRecordRepository repo = mock(AiModelUsageRecordRepository.class);
        when(repo.sumTotalTokensByProviderSince(eq("p-quota"), any(Instant.class))).thenReturn(95L);
        AiModelGuardService guard = new AiModelGuardService(repo);
        AiModelEndpoint endpoint = endpoint("p-quota");
        endpoint.setDailyTokenQuota(100L);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> guard.checkBeforeCall(endpoint, new AiModelGuardService.TokenEstimate(3, 3)));

        assertEquals("LLM_DAILY_TOKEN_QUOTA_EXCEEDED", ex.getCode());
    }

    @Test
    void estimatesOpenAiBodyTokensFromMessagesAndMaxTokens() {
        AiModelGuardService guard = new AiModelGuardService(mock(AiModelUsageRecordRepository.class));
        ReflectionTestUtils.setField(guard, "defaultOutputTokenReserve", 100L);

        AiModelGuardService.TokenEstimate estimate = guard.estimateOpenAiBodyTokens(java.util.Map.of(
                "messages", java.util.List.of(java.util.Map.of("role", "user", "content", "12345678")),
                "max_tokens", 12
        ));

        assertEquals(12, estimate.completionTokens());
    }

    private static AiModelEndpoint endpoint(String id) {
        return AiModelEndpoint.builder()
                .id(id)
                .name(id)
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://llm.example.test/v1")
                .upstreamApiKeyEncrypted("encrypted")
                .model("test-model")
                .enabled(true)
                .build();
    }
}
