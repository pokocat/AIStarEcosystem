package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaRecipe;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaRecipeRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DramaRecipeService（v0.73 抽 skill）：从爆款项目蒸馏配方
 * —— 归属隔离 / 端点未配 / prompt 未配 / 缺大纲 / LLM 输出解析为 submitted 配方。
 */
class DramaRecipeServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private DramaProjectRepository projectRepo;
    private DramaRecipeRepository recipeRepo;
    private AiModelInvocationService invocation;
    private PromptService promptService;
    private DramaRecipeService svc;

    private static final String PAYLOAD = "{\"projectInfo\":{\"title\":\"落地窗后\",\"type\":\"悬疑短剧\","
            + "\"episodes\":80,\"logline\":\"搬进新家发现对楼偷窥\",\"mainline\":\"步步追凶\"},"
            + "\"episodes\":[{\"no\":1,\"hook\":\"开场悬念\",\"synopsis\":\"发现人影\",\"beat\":\"不安\"}],"
            + "\"characters\":[{\"name\":\"林夏\",\"role\":\"key\",\"cast\":\"女·28\",\"desc\":\"坚韧\"}]}";

    @BeforeEach
    void setup() {
        projectRepo = mock(DramaProjectRepository.class);
        recipeRepo = mock(DramaRecipeRepository.class);
        invocation = mock(AiModelInvocationService.class);
        promptService = mock(PromptService.class);
        when(promptService.resolve(anyString())).thenAnswer(inv -> new PromptService.ResolvedPrompt(
                "你是操盘手。只输出 JSON。", "蒸馏《{{title}}》（{{type}}）：{{outline}}",
                new PromptParamsDto(null, null, null), "resource"));
        when(recipeRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        svc = new DramaRecipeService(recipeRepo, projectRepo, invocation, promptService, OM);
    }

    private void seedProject() {
        DramaProject p = DramaProject.builder()
                .id("dp1").ownerUserId("u1").title("落地窗后").type("悬疑短剧").typeKey("mystery")
                .ratio("9:16").episodes(80).coverFrom("#f97316").coverTo("#e11d48").payloadJson(PAYLOAD).build();
        when(projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dp1", "u1")).thenReturn(Optional.of(p));
    }

    @Test
    void extractDistillsProjectIntoSubmittedRecipe() {
        seedProject();
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"title\":\"反转悬疑·步步惊心\",\"summary\":\"适合都市悬疑\",\"mainline\":\"通用追凶主线\","
                                + "\"beats\":[{\"no\":1,\"hook\":\"开局悬念\",\"beat\":\"建立不安\"}],"
                                + "\"characters\":[{\"role\":\"key\",\"archetype\":\"敏感坚韧女主\",\"desc\":\"自我怀疑到直面\"}],"
                                + "\"hooks\":[\"开场即悬念\",\"中段反转\"],\"notes\":\"竖屏强钩子\"}",
                        "stop", 100L, "ep", "fake-model"));

        JsonNode dto = svc.extractFromProject("dp1", "u1");
        assertEquals("submitted", dto.path("status").asText());
        assertEquals("extracted", dto.path("origin").asText());
        assertEquals("dp1", dto.path("sourceProjectId").asText());
        assertEquals("mystery", dto.path("typeKey").asText());
        assertEquals("反转悬疑·步步惊心", dto.path("title").asText());
        assertEquals("通用追凶主线", dto.path("data").path("mainline").asText());
        assertEquals(1, dto.path("data").path("beats").size());
        assertEquals("key", dto.path("data").path("characters").get(0).path("role").asText());
        verify(recipeRepo).save(any(DramaRecipe.class));
    }

    @Test
    void extractThrowsWhenAiNotConfigured() {
        seedProject();
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(false);
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.extractFromProject("dp1", "u1"));
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
        verify(recipeRepo, never()).save(any());
    }

    @Test
    void extractThrowsWhenPromptNotConfigured() {
        seedProject();
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(promptService.resolve(PromptService.KEY_DRAMA_RECIPE_EXTRACT)).thenReturn(new PromptService.ResolvedPrompt(
                "", "{{title}}", new PromptParamsDto(null, null, null), "code"));
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.extractFromProject("dp1", "u1"));
        assertEquals("PROMPT_NOT_CONFIGURED", ex.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    @Test
    void extractThrowsWhenNoOutline() {
        DramaProject p = DramaProject.builder()
                .id("dp2").ownerUserId("u1").title("空项目").type("短剧").typeKey("custom").ratio("9:16")
                .episodes(1).payloadJson("{\"projectInfo\":{\"title\":\"空项目\"},\"episodes\":[]}").build();
        when(projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dp2", "u1")).thenReturn(Optional.of(p));
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.extractFromProject("dp2", "u1"));
        assertEquals("DRAMA_RECIPE_NEEDS_OUTLINE", ex.getCode());
    }

    @Test
    void extractThrowsWhenProjectNotOwned() {
        when(projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull("dp1", "u2")).thenReturn(Optional.empty());
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.extractFromProject("dp1", "u2"));
        assertEquals("DRAMA_PROJECT_NOT_FOUND", ex.getCode());
    }
}
