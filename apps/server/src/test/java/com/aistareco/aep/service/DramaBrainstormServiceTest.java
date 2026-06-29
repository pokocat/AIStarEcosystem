package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaBrainstorm;
import com.aistareco.aep.repository.DramaBrainstormRepository;
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
 * DramaBrainstormService 首页脑暴草稿 CRUD + AI 对话 / 生成大纲 / 去制作：
 * seed 合法性 / 保存回写 / 归属隔离 / 软删 / §8.0 未配置抛错 / 对话与大纲解析 / promote 分流与幂等。
 * 内存 Map 背书 repo；projectService / shortService mock 验证 promote 落向。
 */
class DramaBrainstormServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private Map<String, DramaBrainstorm> store;
    private AiModelInvocationService invocation;
    private PromptService promptService;
    private DramaProjectService projectService;
    private DramaShortService shortService;
    private DramaBrainstormService svc;

    @BeforeEach
    void setup() {
        store = new HashMap<>();
        DramaBrainstormRepository repo = mock(DramaBrainstormRepository.class);
        invocation = mock(AiModelInvocationService.class);
        promptService = mock(PromptService.class);
        when(promptService.resolve(anyString())).thenAnswer(inv -> new PromptService.ResolvedPrompt(
                "你是脑暴助手。只输出 JSON。", "{{transcript}}", new PromptParamsDto(null, null, null), "resource"));
        projectService = mock(DramaProjectService.class);
        shortService = mock(DramaShortService.class);
        svc = new DramaBrainstormService(repo, OM, invocation, promptService, projectService, shortService);

        when(repo.save(any())).thenAnswer(inv -> {
            DramaBrainstorm b = inv.getArgument(0);
            store.put(b.getId(), b);
            return b;
        });
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaBrainstorm b = store.get(inv.<String>getArgument(0));
            if (b == null || b.getDeletedAt() != null
                    || !Objects.equals(b.getOwnerUserId(), inv.getArgument(1))) return Optional.empty();
            return Optional.of(b);
        });
        when(repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(anyString())).thenAnswer(inv -> {
            List<DramaBrainstorm> out = new ArrayList<>();
            for (DramaBrainstorm b : store.values()) {
                if (b.getDeletedAt() == null && Objects.equals(b.getOwnerUserId(), inv.getArgument(0))) out.add(b);
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
        return svc.createBrainstorm(body == null ? null : node(body), user).path("meta").path("id").asText();
    }

    private void aiReturns(String content) {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(content, "stop", 1L, "ep", "fake-model"));
    }

    @Test
    void createSeedsGreetingAndRecovers() {
        JsonNode detail = svc.createBrainstorm(node("{\"seed\":\"替嫁千金\"}"), "u1");
        String id = detail.path("meta").path("id").asText();
        assertEquals("draft", detail.path("meta").path("status").asText());
        JsonNode data = detail.path("data");
        assertEquals("替嫁千金", data.path("seed").asText());
        assertEquals("series", data.path("settings").path("form").asText());
        assertEquals("9:16", data.path("settings").path("ratio").asText());
        assertEquals(1, data.path("messages").size());
        assertEquals("ai", data.path("messages").get(0).path("role").asText());
        assertTrue(data.path("outline").isNull());
        // 恢复
        JsonNode got = svc.getBrainstorm(id, "u1");
        assertEquals(id, got.path("meta").path("id").asText());
        assertEquals(1, got.path("data").path("messages").size());
    }

    @Test
    void saveRoundTripsAndRecomputesTitleFromOutline() {
        String id = createReturningId(null, "u1");
        svc.saveBrainstorm(id, node("{\"data\":{\"messages\":[{\"role\":\"user\",\"text\":\"做个甜宠\"}],"
                + "\"outline\":{\"title\":\"闪婚老公是大佬\",\"beats\":[\"a\"],\"roles\":[],\"scenes\":[]},"
                + "\"settings\":{\"form\":\"series\",\"ratio\":\"9:16\"}}}"), "u1");
        JsonNode got = svc.getBrainstorm(id, "u1");
        assertEquals("闪婚老公是大佬", got.path("meta").path("title").asText());
        assertTrue(got.path("meta").path("hasOutline").asBoolean());
        assertEquals(1, got.path("data").path("messages").size());
    }

    @Test
    void ownershipIsolates() {
        String id = createReturningId(null, "u1");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.getBrainstorm(id, "u2"));
        assertEquals("DRAMA_BRAINSTORM_NOT_FOUND", ex.getCode());
        assertTrue(svc.listBrainstorms("u2").isEmpty());
        assertEquals(1, svc.listBrainstorms("u1").size());
    }

    @Test
    void deleteSoftRemoves() {
        String id = createReturningId(null, "u1");
        svc.deleteBrainstorm(id, "u1");
        assertThrows(BusinessException.class, () -> svc.getBrainstorm(id, "u1"));
        assertTrue(svc.listBrainstorms("u1").isEmpty());
    }

    @Test
    void chatThrowsWhenAiNotConfigured() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(false);
        String id = createReturningId(null, "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.chat(id, node("{\"text\":\"做个复仇爽剧\"}"), "u1"));
        assertEquals("AI_NOT_CONFIGURED", ex.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    @Test
    void chatRequiresText() {
        String id = createReturningId(null, "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.chat(id, node("{\"text\":\"   \"}"), "u1"));
        assertEquals("DRAMA_BRAINSTORM_TEXT_REQUIRED", ex.getCode());
    }

    @Test
    void chatReturnsReplyAndQuick() {
        aiReturns("{\"reply\":\"听起来有戏 👀 我捋了一版\",\"quick\":[\"换个更甜的\",\"走双重身份\"]}");
        String id = createReturningId(null, "u1");
        JsonNode out = svc.chat(id, node("{\"text\":\"替嫁千金逆袭\"}"), "u1");
        assertEquals("ai", out.path("message").path("role").asText());
        assertEquals("听起来有戏 👀 我捋了一版", out.path("message").path("text").asText());
        assertEquals(2, out.path("message").path("quick").size());
        assertEquals("换个更甜的", out.path("message").path("quick").get(0).asText());
    }

    @Test
    void chatThrowsOnUnparseableOutput() {
        aiReturns("对不起我无法生成");
        String id = createReturningId(null, "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.chat(id, node("{\"text\":\"做个剧\"}"), "u1"));
        assertEquals("AI_BAD_OUTPUT", ex.getCode());
    }

    @Test
    void outlineRequiresAUserMessage() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        String id = createReturningId(null, "u1");
        // body messages 只有 ai 开场白 → 还没聊
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.generateOutline(id, node("{\"messages\":[{\"role\":\"ai\",\"text\":\"开场白\"}]}"), "u1"));
        assertEquals("DRAMA_BRAINSTORM_EMPTY", ex.getCode());
    }

    @Test
    void outlineParsesAndNormalizes() {
        aiReturns("{\"title\":\"替嫁千金她A爆全场\",\"type\":\"都市逆袭\",\"tone\":\"强爽·快节奏\","
                + "\"logline\":\"真千金步步翻盘\",\"mainline\":\"屈辱替嫁到全面逆袭\","
                + "\"beats\":[\"屈辱替嫁\",\"身世反转\",\"全面逆袭\"],"
                + "\"roles\":[{\"name\":\"林星遥\",\"role\":\"真千金 · 女主\"},{\"name\":\"\",\"role\":\"空名跳过\"}],"
                + "\"scenes\":[\"教堂婚礼\",\"董事会议室\"]}");
        String id = createReturningId(null, "u1");
        JsonNode out = svc.generateOutline(id, node("{\"messages\":[{\"role\":\"user\",\"text\":\"替嫁千金\"}]}"), "u1");
        JsonNode o = out.path("outline");
        assertEquals("替嫁千金她A爆全场", o.path("title").asText());
        assertEquals(3, o.path("beats").size());
        assertEquals(1, o.path("roles").size(), "空名角色应被剔除");
        assertEquals("林星遥", o.path("roles").get(0).path("name").asText());
        assertEquals(2, o.path("scenes").size());
    }

    @Test
    void outlineThrowsOnBadOutput() {
        aiReturns("{\"foo\":\"bar\"}"); // 没有 title / beats
        String id = createReturningId(null, "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.generateOutline(id, node("{\"messages\":[{\"role\":\"user\",\"text\":\"x\"}]}"), "u1"));
        assertEquals("AI_BAD_OUTPUT", ex.getCode());
    }

    @Test
    void promoteThrowsWhenNoOutline() {
        String id = createReturningId(null, "u1");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.promote(id, node("{\"form\":\"series\"}"), "u1"));
        assertEquals("DRAMA_BRAINSTORM_NO_OUTLINE", ex.getCode());
    }

    @Test
    void promoteSeriesCreatesProjectAndSeedsCharacters() {
        when(projectService.createProject(any(), eq("u1"))).thenReturn(
                node("{\"meta\":{\"id\":\"dp_x1\"},\"data\":{\"projectInfo\":{},\"characters\":[]}}"));
        String id = createReturningId(null, "u1");
        svc.saveBrainstorm(id, node("{\"data\":{\"messages\":[{\"role\":\"user\",\"text\":\"替嫁千金\"}],"
                + "\"outline\":{\"title\":\"替嫁千金\",\"type\":\"都市逆袭\",\"logline\":\"逆袭\",\"mainline\":\"主线\","
                + "\"beats\":[\"a\",\"b\"],\"roles\":[{\"name\":\"林星遥\",\"role\":\"真千金 · 女主\"},"
                + "{\"name\":\"顾沉舟\",\"role\":\"霸总 · 男主\"},{\"name\":\"苏曼\",\"role\":\"反派\"}],\"scenes\":[]},"
                + "\"settings\":{\"form\":\"series\",\"ratio\":\"9:16\",\"episodes\":24}}}"), "u1");

        JsonNode out = svc.promote(id, node("{\"form\":\"series\"}"), "u1");
        assertEquals("project", out.path("kind").asText());
        assertEquals("dp_x1", out.path("projectId").asText());

        // createProject 收到的立项 body：标题/集数/logline 来自大纲与设置
        ArgumentCaptor<JsonNode> body = ArgumentCaptor.forClass(JsonNode.class);
        verify(projectService).createProject(body.capture(), eq("u1"));
        assertEquals("替嫁千金", body.getValue().path("title").asText());
        assertEquals(24, body.getValue().path("episodes").asInt());
        assertEquals("逆袭", body.getValue().path("logline").asText());

        // 预填角色：三个 role，前两个为主角(key)，第三个 extra
        ArgumentCaptor<JsonNode> saveBody = ArgumentCaptor.forClass(JsonNode.class);
        verify(projectService).saveProject(eq("dp_x1"), saveBody.capture(), eq("u1"));
        JsonNode chars = saveBody.getValue().path("data").path("characters");
        assertEquals(3, chars.size());
        assertEquals("林星遥", chars.get(0).path("name").asText());
        assertEquals("key", chars.get(0).path("role").asText());
        assertEquals("extra", chars.get(2).path("role").asText());

        // 脑暴标 promoted
        assertEquals("promoted", svc.getBrainstorm(id, "u1").path("meta").path("status").asText());
    }

    @Test
    void promoteSingleCreatesShort() {
        when(shortService.createFromRecipe(eq("u1"), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString())).thenReturn("dvs_s1");
        String id = createReturningId(null, "u1");
        svc.saveBrainstorm(id, node("{\"data\":{\"messages\":[{\"role\":\"user\",\"text\":\"种草\"}],"
                + "\"outline\":{\"title\":\"熬夜面膜种草\",\"type\":\"口播种草\",\"logline\":\"熬夜也能救\","
                + "\"mainline\":\"\",\"beats\":[\"痛点\"],\"roles\":[],\"scenes\":[]},"
                + "\"settings\":{\"form\":\"single\",\"ratio\":\"9:16\"}}}"), "u1");

        JsonNode out = svc.promote(id, node("{\"form\":\"single\"}"), "u1");
        assertEquals("short", out.path("kind").asText());
        assertEquals("dvs_s1", out.path("shortId").asText());
        verify(shortService).createFromRecipe(eq("u1"), eq("熬夜面膜种草"), eq("口播种草"),
                anyString(), anyString(), eq("熬夜面膜种草"), anyString());
        verify(projectService, never()).createProject(any(), anyString());
    }

    @Test
    void promoteIsIdempotent() {
        when(projectService.createProject(any(), eq("u1"))).thenReturn(
                node("{\"meta\":{\"id\":\"dp_x1\"},\"data\":{\"projectInfo\":{},\"characters\":[]}}"));
        String id = createReturningId(null, "u1");
        svc.saveBrainstorm(id, node("{\"data\":{\"outline\":{\"title\":\"x\",\"beats\":[\"a\"],\"roles\":[],\"scenes\":[]},"
                + "\"settings\":{\"form\":\"series\",\"ratio\":\"9:16\"}}}"), "u1");
        JsonNode first = svc.promote(id, null, "u1");
        JsonNode second = svc.promote(id, null, "u1");
        assertEquals("dp_x1", first.path("projectId").asText());
        assertEquals("dp_x1", second.path("projectId").asText());
        // 只立项一次
        verify(projectService, times(1)).createProject(any(), eq("u1"));
    }
}
