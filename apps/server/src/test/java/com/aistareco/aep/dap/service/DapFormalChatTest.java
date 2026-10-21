package com.aistareco.aep.dap.service;
import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class DapFormalChatTest {
    @Test void jsonPersonaAndVisualAnalysisUseFormalEndpointAndExplicitOutputBudget() {
        var models=mock(AiModelInvocationService.class);var endpoint=AiModelEndpoint.builder().id("formal").enabled(true).baseUrl("https://formal.example/v1").model("qwen38-27b").upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("test-key")).build();
        when(models.resolveDefaultEndpoint(AiModelPurpose.DAP_PERSONA,"aiavatar")).thenReturn(Optional.of(endpoint));
        when(models.invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),any(),any())).thenReturn(new AiModelInvocationService.AiModelResponse("{\"name\":\"角色\"}","stop",10L,"formal","qwen38-27b"));
        var client=new DapMultimodalClient(new DapProperties(),models,mock(AiModelUsageService.class),mock(UpstreamModelHttp.class),mock(AiAppEndpointCandidateRepository.class));
        assertEquals("角色",client.chatJson("system","user").path("name").asText());
        client.chatJsonWithImages("system","view",List.of("data:image/png;base64,eA=="));
        var options=org.mockito.ArgumentCaptor.forClass(Map.class);var messages=org.mockito.ArgumentCaptor.forClass(List.class);
        verify(models,times(2)).invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),messages.capture(),options.capture());
        assertTrue(options.getAllValues().stream().allMatch(o->Integer.valueOf(4096).equals(o.get("max_tokens"))));
        assertTrue(options.getAllValues().stream().allMatch(o->Map.of("type","json_object").equals(o.get("response_format"))));
        assertTrue(((Map<?,?>)messages.getAllValues().get(1).get(1)).get("content") instanceof List<?>);
    }
}
