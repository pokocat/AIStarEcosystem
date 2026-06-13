package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
    private CreditService creditService;
    private DramaProjectService svc;

    @BeforeEach
    void setup() {
        store = new HashMap<>();
        DramaProjectRepository repo = mock(DramaProjectRepository.class);
        invocation = mock(AiModelInvocationService.class);
        creditService = mock(CreditService.class);
        PlatformConfigService configs = mock(PlatformConfigService.class);
        // 配置读取一律返回调用方默认值（与未配置时的线上行为一致）
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.<Long>getArgument(1));
        svc = new DramaProjectService(repo, invocation, creditService, configs, OM);

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
        assertEquals("开场钩子", out.path("episodes").get(0).path("hook").asText());
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
}
