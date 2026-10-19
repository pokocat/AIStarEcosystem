package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiModelEndpointProbeTest {
    private final AiModelEndpointRepository repo = mock(AiModelEndpointRepository.class);
    private final AiModelInvocationService invocation = mock(AiModelInvocationService.class);
    private final AiModelEndpointAdminService service = new AiModelEndpointAdminService(repo, null, invocation);

    @Test void unsavedProbeUsesProvidedCredentialAndConfiguredCatalogPath() {
        when(invocation.listModels(AiModelProviderType.OPENAI_COMPATIBLE, "https://vendor.example/v1", "new-key", "/v1/models?group=video"))
                .thenReturn(AiModelDiscoveryResultDto.ok(200, List.of()));
        var result = service.probe(null, AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/v1", "new-key", "/v1/models?group=video");
        assertTrue(result.ok());
        verifyNoInteractions(repo);
    }

    @Test void unsavedProbePassesConfiguredCredentialHeaderToCatalog() {
        var auth = new AiVideoRequestSpec.AuthHeader("x-api-key", "");
        when(invocation.listModels(AiModelProviderType.OPENAI_COMPATIBLE, "https://vendor.example/v1",
                "new-key", "/v1/models", auth)).thenReturn(AiModelDiscoveryResultDto.ok(200, List.of()));
        assertTrue(service.probe(null, AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/v1", "new-key", "/v1/models", auth).ok());
        verify(invocation).listModels(AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/v1", "new-key", "/v1/models", auth);
    }

    @Test void unsavedProbePassesConfiguredCatalogShape() {
        var catalog = new AiVideoRequestSpec.CatalogSpec("/models", "/model_id", "/name", null);
        when(invocation.listModels(AiModelProviderType.OPENAI_COMPATIBLE, "https://vendor.example/v1",
                "new-key", "/models", null, catalog)).thenReturn(AiModelDiscoveryResultDto.ok(200, List.of()));
        assertTrue(service.probe(null, AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/v1", "new-key", "/models", null, catalog).ok());
    }

    @Test void savedCredentialIsReusedOnlyWithinTheSameOriginAndProvider() {
        when(repo.findById("e")).thenReturn(Optional.of(AiModelEndpoint.builder()
                .id("e").providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("https://vendor.example/v1")
                .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("saved-key")).build()));
        service.probe("e", AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/alternate", null, "/v1/models");
        verify(invocation).listModels(AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/alternate", "saved-key", "/v1/models");

        assertThrows(BusinessException.class, () -> service.probe("e", AiModelProviderType.OPENAI_COMPATIBLE,
                "https://other.example/v1", null, null));
        assertThrows(BusinessException.class, () -> service.probe("e", AiModelProviderType.CUSTOM,
                "https://vendor.example/v1", null, null));
        verifyNoMoreInteractions(invocation);
    }

    @Test void catalogPathCannotRedirectSavedKeyToAnotherHost() {
        assertThrows(BusinessException.class, () -> service.probe("e", AiModelProviderType.OPENAI_COMPATIBLE,
                "https://vendor.example/v1", null, "//other.example/models"));
        assertThrows(BusinessException.class, () -> service.probe("e", AiModelProviderType.OPENAI_COMPATIBLE,
                "http://vendor.example/v1", null, "/models"));
        verifyNoInteractions(repo, invocation);
    }

    @Test void explicitlyDisabledCatalogNeverCallsTheSupplier() {
        var spec = new AiVideoRequestSpec("seedance", VideoStudioService.contract(5, 15),
                "/tasks", "/tasks/{id}", Map.of(), "");
        when(repo.findById("e")).thenReturn(Optional.of(AiModelEndpoint.builder()
                .id("e").videoRequestSpecJson(spec.json()).build()));
        BusinessException saved = assertThrows(BusinessException.class, () -> service.fetchModels("e"));
        assertEquals("MODEL_CATALOG_DISABLED", saved.getCode());
        BusinessException tested = assertThrows(BusinessException.class, () -> service.testConnection("e"));
        assertEquals("MODEL_CATALOG_DISABLED", tested.getCode());
        BusinessException draft = assertThrows(BusinessException.class,
                () -> service.probe(null, AiModelProviderType.OPENAI_COMPATIBLE,
                        "https://vendor.example/v1", "new-key", ""));
        assertEquals("MODEL_CATALOG_DISABLED", draft.getCode());
        verifyNoInteractions(invocation);
    }
}
