package com.aistareco.aep.service;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiModelAccessPolicyServiceTest {
    private final PlatformConfigService config = mock(PlatformConfigService.class);
    private final AiModelEndpointRepository endpoints = mock(AiModelEndpointRepository.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final AiModelAccessPolicyService service = new AiModelAccessPolicyService(config, endpoints, mapper);

    @Test void unconfiguredEndpointPreservesExistingAppAvailability() {
        assertTrue(service.allows("model", "studio"));
        assertTrue(service.allows("model", "drama"));
        assertEquals(List.of("unclassified"), service.get("model").categories());
        assertFalse(service.explicitlyOpensStudioVideo("model"));
    }

    @Test void selectedAppsApplyToNewCallsAndCategoryCanBeMultimodal() {
        var policy = new AiModelAccessPolicyService.Policy(List.of("text", "image"), "selected", List.of("studio"));
        when(endpoints.existsById("model")).thenReturn(true);
        service.save("model", policy, "operator");
        verify(config).upsert(eq("ai.model-access.model"), eq(mapper.valueToTree(policy)), anyString(), eq("operator"));
        when(config.findByKey("ai.model-access.model")).thenReturn(Optional.of(new PlatformConfigDto("ai.model-access.model", mapper.valueToTree(policy), 1, null, null, null)));
        assertTrue(service.allows("model", "studio"));
        assertFalse(service.allows("model", "drama"));
        assertFalse(service.allows("model", null));
    }

    @Test void invalidScopeAndUnknownAppCannotBeSaved() {
        when(endpoints.existsById("model")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.save("model", new AiModelAccessPolicyService.Policy(List.of("image"), "selected", List.of()), "operator"));
        assertThrows(BusinessException.class, () -> service.save("model", new AiModelAccessPolicyService.Policy(List.of("image"), "all", List.of("studio")), "operator"));
        assertThrows(BusinessException.class, () -> service.save("model", new AiModelAccessPolicyService.Policy(List.of("image"), "selected", List.of("unknown-app")), "operator"));
        verify(config, never()).upsert(anyString(), any(), anyString(), anyString());
    }

    @Test void studioVideoRequiresBothVideoCategoryAndStudioScope() {
        var key="ai.model-access.model";
        var image=new AiModelAccessPolicyService.Policy(List.of("image"),"selected",List.of("studio"));
        when(config.findByKey(key)).thenReturn(Optional.of(new PlatformConfigDto(key,mapper.valueToTree(image),1,null,null,null)));
        assertFalse(service.explicitlyOpensStudioVideo("model"));
        var otherApp=new AiModelAccessPolicyService.Policy(List.of("video"),"selected",List.of("drama"));
        when(config.findByKey(key)).thenReturn(Optional.of(new PlatformConfigDto(key,mapper.valueToTree(otherApp),1,null,null,null)));
        assertFalse(service.explicitlyOpensStudioVideo("model"));
        var studio=new AiModelAccessPolicyService.Policy(List.of("video"),"selected",List.of("studio"));
        when(config.findByKey(key)).thenReturn(Optional.of(new PlatformConfigDto(key,mapper.valueToTree(studio),1,null,null,null)));
        assertTrue(service.explicitlyOpensStudioVideo("model"));
    }
}
