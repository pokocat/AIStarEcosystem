package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaRecipe;
import com.aistareco.aep.repository.AepUserRepository;
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
    private AepUserRepository userRepo;
    private NotificationPublisher notifier;
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
        userRepo = mock(AepUserRepository.class);
        notifier = mock(NotificationPublisher.class);
        when(promptService.resolve(anyString())).thenAnswer(inv -> new PromptService.ResolvedPrompt(
                "你是操盘手。只输出 JSON。", "蒸馏《{{title}}》（{{type}}）：{{outline}}",
                new PromptParamsDto(null, null, null), "resource"));
        when(recipeRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        svc = new DramaRecipeService(recipeRepo, projectRepo, invocation, promptService, userRepo, notifier, OM);
    }

    /** 蒸馏链路成功 stub（端点 + LLM 输出可解析）。 */
    private void stubDistillOk() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"title\":\"反转悬疑·步步惊心\",\"summary\":\"适合都市悬疑\",\"mainline\":\"通用追凶主线\","
                                + "\"beats\":[{\"no\":1,\"hook\":\"开局悬念\",\"beat\":\"建立不安\"}],"
                                + "\"characters\":[{\"role\":\"key\",\"archetype\":\"敏感坚韧女主\",\"desc\":\"自我怀疑到直面\"}],"
                                + "\"hooks\":[\"开场即悬念\"],\"notes\":\"竖屏强钩子\"}",
                        "stop", 100L, "ep", "fake-model"));
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

    // ── 审核 / 发布 / 套用 ───────────────────────────────────────────────────────

    private DramaRecipe seedRecipe(String id, String status) {
        DramaRecipe r = DramaRecipe.builder()
                .id(id).ownerUserId("u1").sourceProjectId("dp1").status(status).origin("extracted")
                .title("反转悬疑配方").summary("适合都市悬疑").typeKey("mystery").type("悬疑短剧").ratio("9:16").episodes(80)
                .coverFrom("#f97316").coverTo("#e11d48").useCount(0)
                .payloadJson("{\"mainline\":\"通用追凶\",\"beats\":[{\"no\":1,\"hook\":\"开局悬念\",\"beat\":\"建立不安\"}],"
                        + "\"characters\":[{\"role\":\"key\",\"archetype\":\"坚韧女主\",\"desc\":\"成长弧线\"}],\"hooks\":[],\"notes\":\"\"}")
                .build();
        when(recipeRepo.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(r));
        return r;
    }

    @Test
    void publishSetsStatusAndTimestamp() {
        seedRecipe("dr1", "submitted");
        JsonNode dto = svc.publish("dr1");
        assertEquals("published", dto.path("status").asText());
        assertNotNull(dto.path("publishedAt").asText(null));
    }

    @Test
    void rejectSetsStatusAndNote() {
        seedRecipe("dr1", "submitted");
        JsonNode dto = svc.reject("dr1", "去具体化不够");
        assertEquals("rejected", dto.path("status").asText());
        assertEquals("去具体化不够", dto.path("reviewNote").asText());
    }

    @Test
    void applyPublishedRecipeSeedsNewProjectFromBeats() {
        seedRecipe("dr1", "published");
        when(projectRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        JsonNode out = svc.applyToNewProject("dr1", "u9");
        String pid = out.path("projectId").asText();
        assertTrue(pid.startsWith("dp_"));
        // 校验落库的项目：mode=template、mainline 来自配方、分集骨架来自 beats
        org.mockito.ArgumentCaptor<DramaProject> cap = org.mockito.ArgumentCaptor.forClass(DramaProject.class);
        verify(projectRepo).save(cap.capture());
        DramaProject p = cap.getValue();
        assertEquals("u9", p.getOwnerUserId());
        assertEquals("template", p.getMode());
        assertTrue(p.getPayloadJson().contains("通用追凶"));
        assertTrue(p.getPayloadJson().contains("开局悬念"));
    }

    @Test
    void applyUnpublishedRecipeThrows() {
        seedRecipe("dr1", "submitted");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.applyToNewProject("dr1", "u9"));
        assertEquals("DRAMA_RECIPE_NOT_PUBLISHED", ex.getCode());
    }

    @Test
    void publishMissingRecipeThrows() {
        when(recipeRepo.findByIdAndDeletedAtIsNull("nope")).thenReturn(Optional.empty());
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.publish("nope"));
        assertEquals("DRAMA_RECIPE_NOT_FOUND", ex.getCode());
    }

    // ── 通道② 运营邀请精选 + 用户授权 ───────────────────────────────────────────────

    @Test
    void inviteCreatesInvitedFeaturedRecipeAndNotifiesAuthor() {
        DramaProject p = DramaProject.builder()
                .id("dp1").ownerUserId("u1").title("落地窗后").type("悬疑短剧").typeKey("mystery")
                .ratio("9:16").episodes(80).coverFrom("#f97316").coverTo("#e11d48").stage(4).payloadJson(PAYLOAD).build();
        when(projectRepo.findByIdAndDeletedAtIsNull("dp1")).thenReturn(Optional.of(p));
        AepUser author = mock(AepUser.class);
        when(author.getDisplayName()).thenReturn("阿珍工作室");
        when(userRepo.findById("u1")).thenReturn(Optional.of(author));
        stubDistillOk();

        JsonNode dto = svc.inviteFromProject("dp1", "op1");
        assertEquals("invited", dto.path("status").asText());
        assertEquals("featured", dto.path("origin").asText());
        assertEquals("阿珍工作室", dto.path("authorName").asText());
        assertEquals("op1", dto.path("invitedBy").asText());
        assertEquals("dp1", dto.path("sourceProjectId").asText());
        verify(notifier).notifyUser(eq("u1"), any(), anyString(), anyString());
        verify(recipeRepo).save(any(DramaRecipe.class));
    }

    @Test
    void inviteThrowsWhenProjectMissing() {
        when(projectRepo.findByIdAndDeletedAtIsNull("ghost")).thenReturn(Optional.empty());
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.inviteFromProject("ghost", "op1"));
        assertEquals("DRAMA_PROJECT_NOT_FOUND", ex.getCode());
        verify(recipeRepo, never()).save(any());
    }

    @Test
    void respondApprovePublishesWithConsent() {
        seedRecipe("dr1", "invited");
        JsonNode dto = svc.respondInvite("dr1", "u1", true);
        assertEquals("published", dto.path("status").asText());
        assertNotNull(dto.path("consentAt").asText(null));
        verify(notifier).notifyAdmins(any(), anyString(), anyString(), eq("u1"));
    }

    @Test
    void respondDeclineSetsDeclined() {
        seedRecipe("dr1", "invited");
        JsonNode dto = svc.respondInvite("dr1", "u1", false);
        assertEquals("declined", dto.path("status").asText());
    }

    @Test
    void respondByNonOwnerThrows() {
        seedRecipe("dr1", "invited");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.respondInvite("dr1", "u2", true));
        assertEquals("DRAMA_RECIPE_NOT_OWNER", ex.getCode());
    }

    @Test
    void respondWhenNotInvitedThrows() {
        seedRecipe("dr1", "submitted");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.respondInvite("dr1", "u1", true));
        assertEquals("DRAMA_RECIPE_NOT_INVITED", ex.getCode());
    }

    // ── 通道③ 运营手建内置 ─────────────────────────────────────────────────────────

    @Test
    void createBuiltinPublishesOfficialRecipe() throws Exception {
        JsonNode body = OM.readTree("{\"title\":\"都市逆袭·三幕式\",\"summary\":\"通用爽剧骨架\","
                + "\"type\":\"风格短片\",\"typeKey\":\"style\",\"ratio\":\"9:16\",\"episodes\":1,"
                + "\"mainline\":\"小人物谷底翻盘\",\"beats\":[{\"no\":1,\"hook\":\"屈辱开局\",\"beat\":\"埋反转\"}]}");
        JsonNode dto = svc.createBuiltin(body, "op1");
        assertEquals("published", dto.path("status").asText());
        assertEquals("official", dto.path("origin").asText());
        assertEquals("__official__", dto.path("ownerUserId").asText());
        assertEquals("都市逆袭·三幕式", dto.path("title").asText());
        assertEquals(1, dto.path("data").path("beats").size());
        assertFalse(dto.has("authorName"));
        verify(recipeRepo).save(any(DramaRecipe.class));
    }

    @Test
    void createBuiltinRequiresTitle() throws Exception {
        JsonNode body = OM.readTree("{\"summary\":\"无名\"}");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.createBuiltin(body, "op1"));
        assertEquals("DRAMA_RECIPE_TITLE_REQUIRED", ex.getCode());
        verify(recipeRepo, never()).save(any());
    }

    @Test
    void listCandidatesMarksAlreadyExtractedProjects() {
        DramaProject a = DramaProject.builder().id("dpA").ownerUserId("u1").title("A").type("悬疑短剧")
                .typeKey("mystery").ratio("9:16").episodes(60).stage(3).coverFrom("#111").coverTo("#222").build();
        DramaProject b = DramaProject.builder().id("dpB").ownerUserId("u2").title("B").type("甜宠短剧")
                .typeKey("romance").ratio("9:16").episodes(70).stage(5).coverFrom("#333").coverTo("#444").build();
        when(projectRepo.findTop80ByDeletedAtIsNullAndStageGreaterThanEqualOrderByUpdatedAtDesc(2))
                .thenReturn(java.util.List.of(a, b));
        DramaRecipe existing = DramaRecipe.builder().id("drX").sourceProjectId("dpA").status("submitted").build();
        when(recipeRepo.findBySourceProjectIdInAndDeletedAtIsNull(anyCollection()))
                .thenReturn(java.util.List.of(existing));
        AepUser u = mock(AepUser.class);
        when(u.getUsername()).thenReturn("作者");
        when(userRepo.findById(anyString())).thenReturn(Optional.of(u));

        java.util.List<JsonNode> out = svc.listCandidates();
        assertEquals(2, out.size());
        JsonNode first = out.stream().filter(n -> "dpA".equals(n.path("projectId").asText())).findFirst().orElseThrow();
        JsonNode second = out.stream().filter(n -> "dpB".equals(n.path("projectId").asText())).findFirst().orElseThrow();
        assertTrue(first.path("hasRecipe").asBoolean());
        assertFalse(second.path("hasRecipe").asBoolean());
    }
}
