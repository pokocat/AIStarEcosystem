package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DramaProjectService 工作台文档 CRUD + 大纲 AI：
 * seed 合法性 / 保存回写 / 归属隔离 / 软删 / 大模型未配置抛错 / 大纲解析。
 * 用内存 Map 背书 repo（避免 JPA 上下文），ObjectMapper 用真实实例。
 */
class DramaProjectServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private Map<String, DramaProject> store;
    private AiModelInvocationService invocation;
    private PromptService promptService;
    private CreditService creditService;
    private DramaProjectService svc;

    @BeforeEach
    void setup() {
        store = new HashMap<>();
        DramaProjectRepository repo = mock(DramaProjectRepository.class);
        invocation = mock(AiModelInvocationService.class);
        promptService = mock(PromptService.class);
        // 默认：prompt 已配置（origin=resource）。具体测试可对单个 key 覆盖为 code（未配置）。
        when(promptService.resolve(anyString())).thenAnswer(inv -> new PromptService.ResolvedPrompt(
                "你是助手。只输出 JSON。", "{{input}}", new PromptParamsDto(null, null, null), "resource"));
        creditService = mock(CreditService.class);
        PlatformConfigService configs = mock(PlatformConfigService.class);
        // 配置读取一律返回调用方默认值（与未配置时的线上行为一致）
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.<Long>getArgument(1));
        com.aistareco.aep.service.storage.StorageQuotaService storage = mock(com.aistareco.aep.service.storage.StorageQuotaService.class);
        DramaReferenceAssetService assets = mock(DramaReferenceAssetService.class);
        svc = new DramaProjectService(repo, invocation, promptService, creditService, configs, storage,
                com.aistareco.aep.service.cdn.CdnUrlSigner.NOOP, assets, OM);

        when(repo.save(any())).thenAnswer(inv -> {
            DramaProject p = inv.getArgument(0);
            store.put(p.getId(), p);
            return p;
        });
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaProject p = store.get(inv.<String>getArgument(0));
            if (p == null || p.getDeletedAt() != null
                    || !Objects.equals(p.getOwnerUserId(), inv.getArgument(1))) return Optional.empty();
            return Optional.of(p);
        });
        when(repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(anyString())).thenAnswer(inv -> {
            List<DramaProject> out = new ArrayList<>();
            for (DramaProject p : store.values()) {
                if (p.getDeletedAt() == null && Objects.equals(p.getOwnerUserId(), inv.getArgument(0))) out.add(p);
            }
            return out;
        });
        // 回收站相关：按 id+owner 取（不限软删态）/ 软删列表 / 到期候选 / 物理删除。
        when(repo.findByIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv -> {
            DramaProject p = store.get(inv.<String>getArgument(0));
            if (p == null || !Objects.equals(p.getOwnerUserId(), inv.getArgument(1))) return Optional.empty();
            return Optional.of(p);
        });
        when(repo.findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(anyString())).thenAnswer(inv -> {
            List<DramaProject> out = new ArrayList<>();
            for (DramaProject p : store.values()) {
                if (p.getDeletedAt() != null && Objects.equals(p.getOwnerUserId(), inv.getArgument(0))) out.add(p);
            }
            return out;
        });
        when(repo.findByDeletedAtBefore(any())).thenAnswer(inv -> {
            java.time.OffsetDateTime cutoff = inv.getArgument(0);
            List<DramaProject> out = new ArrayList<>();
            for (DramaProject p : store.values()) {
                if (p.getDeletedAt() != null && p.getDeletedAt().isBefore(cutoff)) out.add(p);
            }
            return out;
        });
        doAnswer(inv -> {
            DramaProject p = inv.getArgument(0);
            store.remove(p.getId());
            return null;
        }).when(repo).delete(any());
    }

    private static JsonNode node(String json) {
        try {
            return OM.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String createReturningId(String body, String user) {
        return svc.createProject(node(body), user).path("meta").path("id").asText();
    }

    @Test
    void createSeedsValidEmptyProjectData() {
        JsonNode detail = svc.createProject(
                node("{\"title\":\"测试剧\",\"type\":\"悬疑短剧\",\"typeKey\":\"mystery\",\"mode\":\"guided\",\"episodes\":12}"),
                "u1");
        assertEquals("测试剧", detail.path("meta").path("title").asText());
        assertEquals(1, detail.path("meta").path("stage").asInt());
        JsonNode data = detail.path("data");
        for (String k : List.of("projectInfo", "topicCards", "episodes", "characters", "script", "storyboard", "promptPack")) {
            assertTrue(data.has(k), "ProjectData missing key: " + k);
        }
        assertEquals(0, data.path("episodes").size());
        assertEquals(12, data.path("projectInfo").path("episodes").asInt());
    }

    @Test
    void saveRoundTripsAndRecomputesCardFields() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        svc.saveProject(id, node("{\"data\":{\"projectInfo\":{\"title\":\"改名了\",\"episodes\":6},"
                + "\"episodes\":[{\"no\":1,\"hook\":\"h\",\"synopsis\":\"s\",\"beat\":\"b\"}]},\"stage\":3,\"progress\":40}"), "u1");
        JsonNode got = svc.getProject(id, "u1");
        assertEquals("改名了", got.path("meta").path("title").asText());
        assertEquals(3, got.path("meta").path("stage").asInt());
        assertEquals(40, got.path("meta").path("progress").asInt());
        assertEquals(1, got.path("data").path("episodes").size());
    }

    @Test
    void ownershipIsolatesProjects() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.getProject(id, "u2"));
        assertEquals("DRAMA_PROJECT_NOT_FOUND", ex.getCode());
        assertTrue(svc.listProjects("u2").isEmpty());
        assertEquals(1, svc.listProjects("u1").size());
    }

    @Test
    void deleteSoftRemoves() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        svc.deleteProject(id, "u1");
        assertThrows(BusinessException.class, () -> svc.getProject(id, "u1"));
        assertTrue(svc.listProjects("u1").isEmpty());
    }

    @Test
    void outlineThrowsWhenAiNotConfigured() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(false);
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.outlineAiDraft(id, null, "u1"));
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
    }

    @Test
    void outlineParsesEpisodesFromLlmJson() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"episodes\":[{\"no\":1,\"hook\":\"开场钩子\",\"synopsis\":\"梗概\",\"beat\":\"转折\"}]}",
                        "stop", 100L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\",\"episodes\":3}", "u1");
        JsonNode out = svc.outlineAiDraft(id, null, "u1");
        assertEquals(1, out.path("episodes").size());
        assertEquals("开场钩子", out.path("episodes").get(0).path("title").asText()); // 旧 hook 无 title → title 回退 hook
        assertEquals(1, out.path("episodes").get(0).path("no").asInt());
    }

    @Test
    void epscriptDraftParsesScenesAndShots() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"scenes\":[{\"place\":\"内景 · 客厅 · 夜\",\"mood\":\"悬疑\",\"action\":\"她发现异样\","
                                + "\"lines\":[{\"who\":\"旁白\",\"text\":\"第一晚就不对劲\"}],"
                                + "\"shots\":[{\"size\":\"中近景\",\"move\":\"推近\",\"dur\":4,\"desc\":\"拆箱抬头\",\"engine\":\"avatar\",\"line\":{\"who\":\"旁白\",\"text\":\"第一晚\"}},"
                                + "{\"size\":\"特写\",\"move\":\"固定\",\"dur\":99,\"desc\":\"窗口人影\",\"engine\":\"weird\"}]}]}",
                        "stop", 100L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        JsonNode out = svc.epscriptAiDraft(id, node("{\"ep\":1,\"plot\":\"她搬进新公寓\"}"), "u1");
        assertEquals(1, out.path("scenes").size());
        assertEquals(1, out.path("boardScenes").size());
        JsonNode shots = out.path("boardScenes").get(0).path("shots");
        assertEquals(2, shots.size());
        assertEquals("sc_1_1_s1", shots.get(0).path("id").asText());
        assertEquals(30, shots.get(1).path("dur").asInt(), "dur 超界应被钳到 30");
        assertEquals("seedance", shots.get(1).path("engine").asText(), "未知 engine 归一化为 seedance");
        assertEquals("旁白", shots.get(0).path("line").path("who").asText());
    }

    @Test
    void castDraftParsesCharacters() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"characters\":[{\"name\":\"林夏\",\"role\":\"key\",\"cast\":\"女·28\",\"desc\":\"坚韧\"},"
                                + "{\"name\":\"陈姨\",\"role\":\"weird\",\"cast\":\"女·55\",\"desc\":\"热心\"}]}",
                        "stop", 80L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        JsonNode out = svc.castAiDraft(id, "u1");
        assertEquals(2, out.path("characters").size());
        assertEquals("key", out.path("characters").get(0).path("role").asText());
        assertEquals("extra", out.path("characters").get(1).path("role").asText(), "非法 role 归一化为 extra");
        assertFalse(out.path("characters").get(0).path("bound").asBoolean());
    }

    @Test
    void outlineThrowsOnUnparseableLlmOutput() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "对不起我无法生成", "stop", 10L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.outlineAiDraft(id, null, "u1"));
        assertEquals("AI_BAD_OUTPUT", ex.getCode());
    }

    // ── v0.66 扣费（hold → 生成 → commit；失败 release 不扣） ─────────────────────

    @Test
    void aiSuccessHoldsAndCommitsCredits() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"episodes\":[{\"no\":1,\"hook\":\"h\",\"synopsis\":\"s\",\"beat\":\"b\"}]}",
                        "stop", 100L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\",\"episodes\":3}", "u1");
        svc.outlineAiDraft(id, null, "u1");
        // 默认 count=min(3,6)=3 ≤ 6 → 试铺价 6
        verify(creditService).hold(eq("u1"), eq(6L), eq("DRAMA_AI"), anyString(), anyString());
        verify(creditService).commitHold(eq("DRAMA_AI"), anyString(), eq(6L), anyString());
        verify(creditService, never()).releaseHold(anyString(), anyString(), anyString());
    }

    @Test
    void aiFailureReleasesHold() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "不是 JSON", "stop", 10L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        assertThrows(BusinessException.class,
                () -> svc.epscriptAiDraft(id, node("{\"ep\":1,\"plot\":\"剧情\"}"), "u1"));
        verify(creditService).hold(eq("u1"), eq(10L), eq("DRAMA_AI"), anyString(), anyString());
        verify(creditService).releaseHold(eq("DRAMA_AI"), anyString(), anyString());
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }

    // ── v0.71 prompt 数据化（resolve → fill → 参数 / 未配置闸） ─────────────────────

    @Test
    void throwsWhenPromptNotConfigured() {
        // 端点已绑，但 prompt 未配置（DB / resource 都没有，origin=code）→ 不调模型、不扣费
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(promptService.resolve(PromptService.KEY_DRAMA_EPSCRIPT)).thenReturn(new PromptService.ResolvedPrompt(
                "你是助手。", "{{input}}", new PromptParamsDto(null, null, null), "code"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.epscriptAiDraft(id, node("{\"ep\":1,\"plot\":\"剧情\"}"), "u1"));
        assertEquals("PROMPT_NOT_CONFIGURED", ex.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
        verify(creditService, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void promptParamsOverrideTemperatureAndMaxTokens() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(promptService.resolve(PromptService.KEY_DRAMA_OUTLINE)).thenReturn(new PromptService.ResolvedPrompt(
                "sys", "为《{{title}}》生成 {{count}} 集大纲", new PromptParamsDto(0.3, 1234, true), "db"));
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(
                        "{\"episodes\":[{\"no\":1,\"hook\":\"h\",\"synopsis\":\"s\",\"beat\":\"b\"}]}",
                        "stop", 1L, "ep", "fake-model"));
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\",\"episodes\":3}", "u1");
        svc.outlineAiDraft(id, null, "u1");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> opts = ArgumentCaptor.forClass(Map.class);
        verify(invocation).invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), opts.capture());
        assertEquals(0.3, opts.getValue().get("temperature"), "运营设的 temperature 应覆盖默认");
        assertEquals(1234, opts.getValue().get("max_tokens"), "运营设的 max_tokens 应生效");
    }

    // ── v0.79 互动剧（DramaProject 的形态） ─────────────────────────────────────

    @Test
    void createInteractiveSeedsOverlay() {
        JsonNode detail = svc.createProject(
                node("{\"title\":\"密室\",\"type\":\"互动剧\",\"typeKey\":\"interactive\",\"mode\":\"interactive\",\"episodes\":6}"),
                "u1");
        assertEquals("interactive", detail.path("meta").path("mode").asText());
        JsonNode ov = detail.path("data").path("interactive");
        assertTrue(ov.path("enabled").asBoolean(), "互动剧应叠加 overlay");
        assertEquals("ep1", ov.path("startEpisodeId").asText());
        assertTrue(ov.path("nodes").isObject());
    }

    @Test
    void interactiveDraftThrowsWhenAiNotConfigured() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(false);
        String id = createReturningId("{\"type\":\"互动剧\",\"typeKey\":\"interactive\",\"mode\":\"interactive\"}", "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.interactiveDraft(id, node("{\"theme\":\"末日列车\"}"), "u1"));
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    @Test
    void interactiveDraftBuildsGraphAndOverlayFromLlm() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        String graph = "{\"title\":\"末日列车\",\"globalFlags\":{\"hasKey\":false},\"startEp\":1,\"episodes\":["
                + "{\"no\":1,\"hook\":\"上车\",\"synopsis\":\"逃上末班车\",\"interactions\":["
                + "  {\"triggerTime\":52,\"interactionType\":\"choice\",\"condition\":\"globalFlags.hasKey == true\","
                + "   \"uiConfig\":{\"question\":\"开门？\",\"countdownSec\":10,\"options\":["
                + "      {\"text\":\"开\",\"nextEp\":2,\"setFlags\":{\"hasKey\":true}},"
                + "      {\"text\":\"不开\",\"nextEp\":3}]}},"
                + "  {\"triggerTime\":20,\"interactionType\":\"choice\",\"uiConfig\":{\"question\":\"早\",\"options\":[{\"text\":\"x\",\"nextEp\":3}]}}],"
                + "\"isEnding\":false},"
                + "{\"no\":2,\"hook\":\"生还\",\"synopsis\":\"活下来\",\"interactions\":[],\"isEnding\":true,\"endingLabel\":\"生还结局\"},"
                + "{\"no\":3,\"hook\":\"沦陷\",\"synopsis\":\"失败\",\"interactions\":[],\"isEnding\":true}]}";
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(graph, "stop", 100L, "ep", "fake-model"));

        String id = createReturningId("{\"type\":\"互动剧\",\"typeKey\":\"interactive\",\"mode\":\"interactive\"}", "u1");
        JsonNode out = svc.interactiveDraft(id, node("{\"theme\":\"末日列车\"}"), "u1");

        // 大纲分集（图节点）
        assertEquals(3, out.path("episodes").size());
        assertEquals(1, out.path("episodes").get(0).path("no").asInt());
        assertEquals("上车", out.path("episodes").get(0).path("title").asText()); // 旧 hook 无 title → title 回退 hook
        // overlay
        JsonNode ov = out.path("interactive");
        assertTrue(ov.path("enabled").asBoolean());
        assertEquals("ep1", ov.path("startEpisodeId").asText());
        assertTrue(ov.path("globalFlags").has("hasKey"));
        JsonNode node1 = ov.path("nodes").path("ep1");
        // 互动点按 triggerTime 升序
        assertEquals(2, node1.path("interactions").size());
        assertEquals(20, node1.path("interactions").get(0).path("triggerTime").asInt());
        assertEquals(52, node1.path("interactions").get(1).path("triggerTime").asInt());
        // 选项 nextEp → nextVideoId "ep"+no，稳定 id，setFlags 保留
        JsonNode opt0 = node1.path("interactions").get(1).path("uiConfig").path("options").get(0);
        assertEquals("A", opt0.path("id").asText());
        assertEquals("ep2", opt0.path("nextVideoId").asText());
        assertTrue(opt0.path("setFlags").has("hasKey"));
        // 结局节点
        assertTrue(ov.path("nodes").path("ep2").path("isEnding").asBoolean());
        assertEquals("结局", ov.path("nodes").path("ep3").path("endingLabel").asText());
    }

    // ── 回收站（软删 → 列表 → 恢复 / 彻底删除 / 到期清理）──────────────────────────

    @Test
    void softDeletedShowsInTrashWithDaysLeft() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        svc.deleteProject(id, "u1");
        assertTrue(svc.listProjects("u1").isEmpty(), "软删后不应出现在工坊列表");
        List<JsonNode> trash = svc.listTrash("u1");
        assertEquals(1, trash.size());
        JsonNode item = trash.get(0);
        assertEquals(id, item.path("id").asText());
        assertFalse(item.path("deletedAt").isNull());
        assertFalse(item.path("purgeAt").isNull());
        // 刚删除：剩余天数应接近保留期（>=29，<=30）。
        long daysLeft = item.path("daysLeft").asLong();
        assertTrue(daysLeft >= 29 && daysLeft <= DramaProjectService.TRASH_RETENTION_DAYS, "daysLeft=" + daysLeft);
    }

    @Test
    void restoreBringsBackToList() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        svc.deleteProject(id, "u1");
        svc.restoreProject(id, "u1");
        assertTrue(svc.listTrash("u1").isEmpty(), "恢复后不应再在回收站");
        assertEquals(1, svc.listProjects("u1").size(), "恢复后应回到工坊列表");
        assertDoesNotThrow(() -> svc.getProject(id, "u1"));
    }

    @Test
    void purgeRequiresTrashAndHardDeletes() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        // 未在回收站直接彻底删除 → 拒绝。
        assertThrows(BusinessException.class, () -> svc.purgeProject(id, "u1"));
        svc.deleteProject(id, "u1");
        svc.purgeProject(id, "u1");
        assertTrue(svc.listTrash("u1").isEmpty());
        assertTrue(store.isEmpty(), "彻底删除应物理移除");
    }

    @Test
    void trashIsolatedByOwner() {
        String id = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        svc.deleteProject(id, "u1");
        assertTrue(svc.listTrash("u2").isEmpty(), "他人不应看到 u1 的回收站");
        assertThrows(BusinessException.class, () -> svc.restoreProject(id, "u2"));
        assertThrows(BusinessException.class, () -> svc.purgeProject(id, "u2"));
    }

    @Test
    void purgeExpiredRemovesOnlyAgedTrash() {
        String fresh = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        String aged = createReturningId("{\"type\":\"X\",\"typeKey\":\"x\",\"mode\":\"guided\"}", "u1");
        svc.deleteProject(fresh, "u1");
        svc.deleteProject(aged, "u1");
        // 把 aged 的删除时间挪到保留期之外。
        store.get(aged).setDeletedAt(java.time.OffsetDateTime.now().minusDays(DramaProjectService.TRASH_RETENTION_DAYS + 1));
        int cleaned = svc.purgeExpiredTrash();
        assertEquals(1, cleaned);
        assertFalse(store.containsKey(aged), "过期项应被物理删除");
        assertTrue(store.containsKey(fresh), "未过期项应保留");
    }
}
