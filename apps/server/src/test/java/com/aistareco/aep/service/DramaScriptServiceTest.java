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
    private MaterialVideoJobService videoJobs;
    private DramaScriptService service;

    @BeforeEach
    void setUp() {
        invocation = mock(AiModelInvocationService.class);
        promptService = mock(PromptService.class);
        service = new DramaScriptService(
                mock(DramaScriptRepository.class), invocation, promptService,
                videoJobs = mock(MaterialVideoJobService.class), new DramaShortContinuityService(OM), OM);
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
    }

    /** v0.198：画布的片段视频和短剧同一个分区，但老工作台的视频列表不显示它们。 */
    @Test
    void listEpisodeJobs_excludesCanvasVideos() {
        when(videoJobs.listJobs("u1", null, null, MaterialVideoJobService.APP_DRAMA)).thenReturn(java.util.List.of(
                OM.createObjectNode().put("id", "mvj_ep").put("kind", "drama-episode"),
                OM.createObjectNode().put("id", "mvj_canvas").put("kind", DramaCanvasRunService.VIDEO_JOB_KIND)));
        var jobs = service.listEpisodeJobs("u1", null);
        assertEquals(1, jobs.size());
        assertEquals("mvj_ep", jobs.get(0).path("id").asText());
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

        // 断错误码与状态（§8.0.1 ⑩）：前端按 code 判定「写太长被截断」，文案会随改版变。
        assertEquals("AI_OUTPUT_TRUNCATED", ex.getCode());
        assertEquals(org.springframework.http.HttpStatus.BAD_GATEWAY, ex.getStatus());
        assertFalse(ex.getMessage().isBlank(), "截断必须给用户一句能看懂的说明，不能是空消息");
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
