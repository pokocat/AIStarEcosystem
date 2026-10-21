package com.aistareco.aep.service;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiModelUsageAttributionTest {
    private final AiModelUsageRecordRepository records = mock(AiModelUsageRecordRepository.class);
    private final AiModelEndpointRepository endpoints = mock(AiModelEndpointRepository.class);
    private final AiModelUsageService service = new AiModelUsageService(records, endpoints,
            mock(AepUserRepository.class), mock(TenantRepository.class), mock(MembershipRepository.class));

    private AiModelUsageRecord last() {
        var captor = org.mockito.ArgumentCaptor.forClass(AiModelUsageRecord.class);
        verify(records, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    @Test void taskOverridesLoginAndExplicitOwnerOverridesTaskForSuccessAndFailure() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "", List.of()));
        try (var scope = AiModelUsageContext.bind("owner", "aiavatar", "run-1")) {
            service.record("ep", "provider", "vision", "DAP_PERSONA", 40L, 2L, 42L, true);
            assertEquals("owner", last().getUserId());
            assertEquals("aiavatar", last().getAppCode());
            service.recordObserved("ep", "provider", "vision", "DAP_PERSONA", null, null, null, false,
                    "req-failed", null, 12L, "HTTP_429", "limited");
            assertEquals("owner", last().getUserId());
            assertFalse(last().isSuccess());
            service.recordWithAttribution("ep", "provider", "vision", "DAP_PERSONA", 1L, 1L, 2L, true,
                    "explicit", null, "drama");
            assertEquals("explicit", last().getUserId());
            assertEquals("drama", last().getAppCode());
        } finally { SecurityContextHolder.clearContext(); }
        assertNull(AiModelUsageContext.current());
    }

    @Test void pooledWorkerRestoresNestedScopesAndDoesNotLeakAfterAnException() throws Exception {
        var pool = Executors.newSingleThreadExecutor();
        try {
            pool.submit(() -> {
                assertNull(AiModelUsageContext.current());
                try (var outer = AiModelUsageContext.bind("owner-a", "aiavatar", "a")) {
                    assertThrows(IllegalStateException.class, () -> {
                        try (var inner = AiModelUsageContext.bind("owner-b", "drama", "b")) {
                            service.record("ep", "provider", "model", "DRAMA_SCRIPT_DRAFT", 1L, 2L, 3L, true);
                            assertEquals("owner-b", last().getUserId());
                            throw new IllegalStateException("worker failed");
                        }
                    });
                    service.record("ep", "provider", "model", "DAP_PERSONA", 1L, 2L, 3L, true);
                    assertEquals("owner-a", last().getUserId());
                }
            }).get();
            assertNull(pool.submit(AiModelUsageContext::current).get());
        } finally { pool.shutdownNow(); }
    }

    @Test void imageTokensAndUnitsAreBothRetainedAndSupplierModeSetsCost() {
        when(endpoints.findById("ep")).thenReturn(Optional.of(AiModelEndpoint.builder().id("ep")
                .supplierBillingMode("TOKENS").promptTokenPriceMicros(1000).completionTokenPriceMicros(2000).build()));
        try (var scope = AiModelUsageContext.bind("owner", "aiavatar", "image-1")) {
            service.recordMeteredObserved("ep", "provider", "image", "DAP_IMAGE", 1500L, 500L, 2000L,
                    AiModelBillingMode.PER_CALL, 1L, 0L, true, "request", null, 100L, null, null);
        }
        var saved = last();
        assertEquals("owner", saved.getUserId());
        assertEquals(1L, saved.getBillableUnits());
        assertEquals(2000L, saved.getTotalTokens());
        assertEquals(AiModelBillingMode.TOKENS, saved.getBillingMode());
        assertEquals(2500L, saved.getCostMicros());
    }
    @Test void optimizationIsCountedOnceWithoutApplyingTheVideoSecondsPrice() {
        when(endpoints.findById("video-ep")).thenReturn(Optional.of(AiModelEndpoint.builder().id("video-ep")
                .supplierBillingMode("PER_SECOND").unitPriceMicros(900_000).build()));
        when(records.existsByProviderIdAndPurposeAndRequestIdAndSuccessTrue(eq("video-ep"), eq(AiModelUsageService.VIDEO_PROMPT_OPTIMIZATION), anyString()))
                .thenReturn(false, true);
        String key = "optimization-" + "x".repeat(110);
        service.recordPromptOptimization("video-ep", "provider", "video", "owner", key, "vendor-opt", true, 100L, null);
        var saved = last();
        assertEquals(AiModelBillingMode.PER_CALL, saved.getBillingMode());
        assertEquals(1L, saved.getBillableUnits());
        assertEquals(0L, saved.getBillableSeconds());
        assertEquals(0L, saved.getCostMicros(), "the supplier has no separate optimization tariff; video pricing cannot stand in");
        assertEquals("owner", saved.getUserId());
        assertTrue(saved.getRequestId().length() <= 96);
        service.recordPromptOptimization("video-ep", "provider", "video", "owner", key, "vendor-opt", true, 100L, null);
        verify(records, times(1)).save(any());
    }

}
