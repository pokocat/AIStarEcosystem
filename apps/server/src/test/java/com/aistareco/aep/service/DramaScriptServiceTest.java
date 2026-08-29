package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.DramaScriptRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DramaScriptServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private AiModelInvocationService invocation;
    private PromptService promptService;
    private DramaScriptService service;

    @BeforeEach
    void setUp() {
        invocation = mock(AiModelInvocationService.class);
        promptService = mock(PromptService.class);
        service = new DramaScriptService(
                mock(DramaScriptRepository.class), invocation, promptService,
                mock(MaterialVideoJobService.class), new DramaShortContinuityService(OM), OM);
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
    }

    @Test
    void shortDraftUsesPromptScoped6144Default() {
        stubPrompt(new PromptParamsDto(null, null, true));
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(response(validScript(), "stop"));

        var scripts = service.aiDraft(OM.createObjectNode().put("theme", "喵影江湖"), "u1");

        assertEquals(1, scripts.size());
        assertEquals("1.0", scripts.get(0).path("continuity_manifest").path("version").asText());
        assertEquals("shot-01", scripts.get(0).path("continuity_manifest").path("shots").path(0).path("id").asText());
        ArgumentCaptor<Map<String, Object>> options = optionsCaptor();
        verify(invocation).invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), options.capture());
        assertEquals(6144, options.getValue().get("max_tokens"));
    }

    @Test
    void operatorConfiguredMaxTokensStillWins() {
        stubPrompt(new PromptParamsDto(0.7, 7000, true));
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(response(validScript(), "stop"));

        service.aiDraft(OM.createObjectNode().put("theme", "喵影江湖"), "u1");

        ArgumentCaptor<Map<String, Object>> options = optionsCaptor();
        verify(invocation).invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), options.capture());
        assertEquals(7000, options.getValue().get("max_tokens"));
    }

    @Test
    void lengthFinishReasonReturnsExplicitTruncationError() {
        stubPrompt(new PromptParamsDto(null, null, true));
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(response("{\"scripts\":[", "length"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.aiDraft(OM.createObjectNode().put("theme", "喵影江湖"), "u1"));

        assertEquals("AI_OUTPUT_TRUNCATED", ex.getCode());
        assertTrue(ex.getMessage().contains("长度上限"));
    }

    @Test
    void repairsMissingArrayCloserFromStoppedModelResponse() {
        stubPrompt(new PromptParamsDto(null, null, true));
        String missingScriptsArrayCloser = "{\"scripts\":[{\"title\":\"雨夜霓虹迷局\","
                + "\"scenes\":[{\"duration_sec\":30,\"shot\":\"雨夜街头\",\"dialogue\":\"找到你了\"}]}}";
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(response(missingScriptsArrayCloser, "stop"));

        var scripts = service.aiDraft(OM.createObjectNode().put("theme", "未来城市悬疑"), "u1");

        assertEquals(1, scripts.size());
        assertEquals("雨夜霓虹迷局", scripts.get(0).path("title").asText());
        assertEquals(1, scripts.get(0).path("scenes").size());
    }

    private void stubPrompt(PromptParamsDto params) {
        when(promptService.resolve(AiModelPurpose.DRAMA_SCRIPT_DRAFT))
                .thenReturn(new PromptService.ResolvedPrompt("你是短片编剧", "主题：{{theme}}", params, "resource"));
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static ArgumentCaptor<Map<String, Object>> optionsCaptor() {
        return (ArgumentCaptor) ArgumentCaptor.forClass(Map.class);
    }

    private static AiModelInvocationService.AiModelResponse response(String content, String finishReason) {
        return new AiModelInvocationService.AiModelResponse(content, finishReason, 100L, "test", "test-model");
    }

    private static String validScript() {
        return "{\"scripts\":[{\"title\":\"喵影江湖\",\"scenes\":[{\"duration_sec\":5,\"shot\":\"橘猫跃上屋檐\",\"dialogue\":\"走着瞧\"}]}]}";
    }
}
