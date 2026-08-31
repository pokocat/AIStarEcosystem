package com.aistareco.aep.service;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DramaShortPromptService（v0.143 提示词直出）：
 * 输入闸门 / §8.0 未配置与失败不产假数据 / 拆解结果归一（时长收口、超镜数如实告知、
 * 出场人物只认已知角色、人物视觉超长截断并记 note）/ seed → 草稿 payload（不接受伪造成片）。
 */
class DramaShortPromptServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String USER = "u_owner";
    /** 合法长度（≥20 字）的提示词。 */
    private static final String PROMPT = """
            【角色】阿宁：齐耳短发，米白针织开衫。
            【场景】老城咖啡馆，午后逆光。
            00:00-00:04 远景推近：阿宁抱着纸箱进门。台词：旁白：搬来第七天。
            """;

    private AiModelInvocationService invocation;
    private PromptService promptService;
    private DramaShortPromptService svc;

    @BeforeEach
    void setUp() {
        invocation = mock(AiModelInvocationService.class);
        promptService = mock(PromptService.class);
        when(promptService.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt(
                "你是分镜拆解师。只输出 JSON。", "{{prompt}}|{{maxShots}}|{{maxShotSec}}|{{instructionClause}}",
                new PromptParamsDto(null, null, null), "resource"));
        svc = new DramaShortPromptService(invocation, promptService, OM);
    }

    private void aiReturns(String content) {
        aiReturns(content, "stop");
    }

    private void aiReturns(String content, String finishReason) {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(invocation.invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(content, finishReason, 1L, "ep", "fake-model"));
    }

    private static JsonNode node(String json) {
        try {
            return OM.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ── 输入闸门 ────────────────────────────────────────────────────────────────

    @Test
    void promptRequired() {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.parse(node("{}"), USER));
        assertEquals("DRAMA_PROMPT_REQUIRED", e.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    @Test
    void tooShortPromptRejectedBeforeModelCall() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(node("{\"prompt\":\"太短了\"}"), USER));
        assertEquals("DRAMA_PROMPT_TOO_SHORT", e.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    @Test
    void tooLongPromptRejectedInsteadOfSilentTruncation() {
        String huge = "画".repeat(DramaShortPromptService.MAX_PROMPT_CHARS + 1);
        ObjectMapper om = OM;
        var body = om.createObjectNode().put("prompt", huge);
        BusinessException e = assertThrows(BusinessException.class, () -> svc.parse(body, USER));
        assertEquals("DRAMA_PROMPT_TOO_LONG", e.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    // ── §8.0：未配置 / 调用失败一律显式报错，不产假分镜 ─────────────────────────

    @Test
    void missingEndpointGives503() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(false);
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER));
        assertEquals("AI_NOT_CONFIGURED", e.getCode());
    }

    @Test
    void codeOriginPromptGives503() {
        when(invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)).thenReturn(true);
        when(promptService.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt(
                "sys", "{{input}}", new PromptParamsDto(null, null, null), "code"));
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER));
        assertEquals("PROMPT_NOT_CONFIGURED", e.getCode());
        verify(invocation, never()).invokeChat(any(), anyList(), anyMap());
    }

    @Test
    void unparsableOutputGives502() {
        aiReturns("这段提示词看起来不错，我建议……");
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER));
        assertEquals("AI_BAD_OUTPUT", e.getCode());
    }

    @Test
    void truncatedOutputGives502() {
        aiReturns("{\"shots\":[{\"visual\":\"半句", "length");
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER));
        assertEquals("AI_OUTPUT_TRUNCATED", e.getCode());
    }

    @Test
    void noUsableShotsGives502() {
        aiReturns("{\"title\":\"空\",\"shots\":[{\"visual\":\"\",\"voText\":\"\"}]}");
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER));
        assertEquals("AI_BAD_OUTPUT", e.getCode());
    }

    @Test
    void perUserRateLimitBlocksRepeatedParsesWithoutDegrading() {
        aiReturns("{\"title\":\"限频\",\"shots\":[{\"durationSec\":4,\"visual\":\"画面\"}]}");
        for (int i = 0; i < DramaShortPromptService.RATE_LIMIT_MAX; i++) {
            svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);
        }
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER));
        assertEquals("DRAMA_PROMPT_RATE_LIMITED", e.getCode());
        // 超限只拒绝，不产假结果；模型调用次数停在上限。
        verify(invocation, times(DramaShortPromptService.RATE_LIMIT_MAX))
                .invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), anyList(), anyMap());
        // 别的账号不受影响。
        svc.parse(OM.createObjectNode().put("prompt", PROMPT), "u_other");
    }

    // ── 拆解结果归一 ────────────────────────────────────────────────────────────

    @Test
    void parsesCharactersScenesAndShots() {
        aiReturns("""
                {"title":"搬来第七天","logline":"她终于开口","style":["电影感","治愈"],
                 "universalPrompt":"自然光竖屏，浅景深",
                 "characters":[{"name":"阿宁","visual":"齐耳短发，米白针织开衫","performance":"慢热，开口前先笑"},
                               {"name":"老周","visual":"花白短发，深灰工装围裙","performance":"话少"}],
                 "scenes":[{"name":"咖啡馆吧台","visual":"木质吧台，午后逆光，浮尘"}],
                 "shots":[{"no":1,"timecode":"00:00-00:04","durationSec":4,"sceneName":"咖啡馆吧台",
                           "castNames":["阿宁","路人甲"],"beat":"开场","visual":"阿宁抱着纸箱进门",
                           "size":"远景","move":"推近","voWho":"旁白","voText":"搬来第七天。",
                           "sfx":"风铃","bgm":"钢琴","fx":""},
                          {"no":2,"durationSec":6,"castNames":[],"visual":"空镜：吧台上的旧机械表",
                           "size":"特写","move":"固定","voWho":"","voText":""}],
                 "notes":["原提示词没写第二镜时长，已按画面复杂度估"]}
                """);
        JsonNode out = svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);

        assertEquals("搬来第七天", out.path("title").asText());
        assertEquals(2, out.path("characters").size());
        assertEquals("阿宁", out.path("characters").get(0).path("name").asText());
        assertEquals("慢热，开口前先笑", out.path("characters").get(0).path("performance").asText());
        assertEquals(1, out.path("scenes").size());
        assertEquals(2, out.path("shotCount").asInt());
        assertEquals(10, out.path("totalDurationSec").asInt());

        JsonNode first = out.path("shots").get(0);
        assertEquals(1, first.path("no").asInt());
        assertEquals("00:00-00:04", first.path("timecode").asText());
        assertEquals("咖啡馆吧台", first.path("sceneName").asText());
        // 出场人物只认已知角色名，模型编造的「路人甲」被丢掉（否则挂不到任何锚点）。
        assertEquals(1, first.path("castNames").size());
        assertEquals("阿宁", first.path("castNames").get(0).asText());
        // 空数组保留 = 这一镜确实没有人物（纯空镜），不能被当成「未标注」补全员。
        assertTrue(out.path("shots").get(1).has("castNames"));
        assertEquals(0, out.path("shots").get(1).path("castNames").size());
        assertEquals("原提示词没写第二镜时长，已按画面复杂度估", out.path("notes").get(0).asText());
    }

    @Test
    void overlongShotIsClampedAndReported() {
        aiReturns("""
                {"title":"长镜","shots":[{"durationSec":109,"visual":"独白长镜"}]}
                """);
        JsonNode out = svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);
        assertEquals(DramaShortPromptService.MAX_SHOT_SEC, out.path("shots").get(0).path("durationSec").asInt());
        assertTrue(out.path("notes").toString().contains("已经压到"), "超时长压到上限必须如实写进 notes：" + out.path("notes"));
    }

    @Test
    void shotsBeyondCapAreDroppedAndReported() {
        StringBuilder sb = new StringBuilder("{\"title\":\"超长片\",\"shots\":[");
        for (int i = 0; i < DramaShortPromptService.MAX_SHOTS + 5; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"durationSec\":3,\"visual\":\"镜").append(i + 1).append("\"}");
        }
        sb.append("]}");
        aiReturns(sb.toString());
        JsonNode out = svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);
        assertEquals(DramaShortPromptService.MAX_SHOTS, out.path("shotCount").asInt());
        assertTrue(out.path("notes").toString().contains("建议拆成多条"), "超镜数必须告知用户：" + out.path("notes"));
    }

    @Test
    void overlongCharacterVisualIsCappedWithNote() {
        String longVisual = "银".repeat(DramaShortPromptService.VISUAL_CHARS + 50);
        aiReturns("{\"title\":\"设定超长\",\"characters\":[{\"name\":\"赛博猴王\",\"visual\":\"" + longVisual
                + "\"}],\"shots\":[{\"durationSec\":4,\"visual\":\"猴王亮相\"}]}");
        JsonNode out = svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);
        assertEquals(DramaShortPromptService.VISUAL_CHARS,
                out.path("characters").get(0).path("visual").asText().length());
        assertTrue(out.path("notes").toString().contains("赛博猴王"), "截断必须点名字段：" + out.path("notes"));
    }

    @Test
    void limitsAreFilledIntoSystemPromptNotSentAsPlaceholders() {
        // 上限规则写在 system 段；system 也必须过 fill，否则模型只看到字面 {{maxShots}}。
        when(promptService.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt(
                "总镜数不超过 {{maxShots}} 镜；单镜不超过 {{maxShotSec}} 秒；角色最多 {{maxCharacters}} 位、场景最多 {{maxScenes}} 个。",
                "{{prompt}}", new PromptParamsDto(null, null, null), "resource"));
        aiReturns("{\"title\":\"上限\",\"shots\":[{\"durationSec\":4,\"visual\":\"画面\"}]}");

        svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Map<String, String>>> captor = ArgumentCaptor.forClass(List.class);
        verify(invocation).invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), captor.capture(), anyMap());
        String system = captor.getValue().get(0).get("content");
        assertFalse(system.contains("{{"), "system 段不应残留占位符：" + system);
        assertTrue(system.contains(String.valueOf(DramaShortPromptService.MAX_SHOTS)));
        assertTrue(system.contains(String.valueOf(DramaShortPromptService.MAX_SHOT_SEC)));
        assertTrue(system.contains(String.valueOf(DramaShortPromptService.MAX_CHARACTERS)));
    }

    @Test
    void instructionIsForwardedToPrompt() {
        aiReturns("{\"title\":\"改一版\",\"shots\":[{\"durationSec\":4,\"visual\":\"改后的画面\"}]}");
        svc.parse(OM.createObjectNode().put("prompt", PROMPT).put("instruction", "压到 20 秒内"), USER);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Map<String, String>>> captor = ArgumentCaptor.forClass(List.class);
        verify(invocation).invokeChat(eq(AiModelPurpose.DRAMA_SCRIPT_DRAFT), captor.capture(), anyMap());
        List<Map<String, String>> messages = captor.getValue();
        String userMessage = messages.get(messages.size() - 1).get("content");
        assertTrue(userMessage.contains("压到 20 秒内"), "调整要求必须进 prompt：" + userMessage);
        assertTrue(userMessage.contains("00:00-00:04"), "原提示词必须进 prompt");
    }

    @Test
    void missingCastNamesIsInferredFromVisualNotTurnedIntoEmptyArray() {
        // 模型漏写 castNames：能从画面文本认出角色就落该角色；绝不能落空数组
        // （空数组=明确无人，会静默丢掉人物一致性）。
        aiReturns("""
                {"title":"漏写出场人物",
                 "characters":[{"name":"阿宁","visual":"齐耳短发"},{"name":"老周","visual":"花白短发"}],
                 "shots":[{"durationSec":4,"visual":"阿宁抱着纸箱进门"},
                          {"durationSec":4,"visual":"空镜：吧台上的旧机械表"}]}
                """);
        JsonNode out = svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);

        JsonNode first = out.path("shots").get(0);
        assertEquals(1, first.path("castNames").size(), "画面里点了名的角色应被推断出来");
        assertEquals("阿宁", first.path("castNames").get(0).asText());
        // 推断不出 → 不写字段（下游按「未标注 → 全员」兜底），而不是空数组。
        assertFalse(out.path("shots").get(1).has("castNames"),
                "推断不出出场人物时必须省略该字段，不能落空数组");
    }

    @Test
    void extraCharactersAndScenesAreReported() {
        StringBuilder sb = new StringBuilder("{\"title\":\"群像\",\"characters\":[");
        for (int i = 0; i < DramaShortPromptService.MAX_CHARACTERS + 2; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"name\":\"角色").append(i + 1).append("\",\"visual\":\"外观").append(i + 1).append("\"}");
        }
        sb.append("],\"scenes\":[");
        for (int i = 0; i < DramaShortPromptService.MAX_SCENES + 1; i++) {
            if (i > 0) sb.append(',');
            sb.append("{\"name\":\"场景").append(i + 1).append("\",\"visual\":\"环境").append(i + 1).append("\"}");
        }
        sb.append("],\"shots\":[{\"durationSec\":4,\"visual\":\"群像亮相\"}]}");
        aiReturns(sb.toString());

        JsonNode out = svc.parse(OM.createObjectNode().put("prompt", PROMPT), USER);
        assertEquals(DramaShortPromptService.MAX_CHARACTERS, out.path("characters").size());
        assertEquals(DramaShortPromptService.MAX_SCENES, out.path("scenes").size());
        String notes = out.path("notes").toString();
        assertTrue(notes.contains("角色超过"), "丢角色必须如实告知：" + notes);
        assertTrue(notes.contains("场景超过"), "丢场景必须如实告知：" + notes);
    }

    @Test
    void emptySeedIsRejectedSoNobodyPaysForBlankStoryboard() {
        BusinessException none = assertThrows(BusinessException.class,
                () -> DramaShortPromptService.requireUsableSeed(node("{\"shots\":[]}")));
        assertEquals("DRAMA_SHORT_SEED_EMPTY", none.getCode());
        // 镜头存在但画面与台词都被清空 —— 同样不算可用。
        BusinessException blank = assertThrows(BusinessException.class, () -> DramaShortPromptService
                .requireUsableSeed(node("{\"shots\":[{\"durationSec\":4,\"visual\":\"  \",\"voText\":\"\"}]}")));
        assertEquals("DRAMA_SHORT_SEED_EMPTY", blank.getCode());
        // 有一镜有台词即可通过。
        DramaShortPromptService.requireUsableSeed(node("{\"shots\":[{\"visual\":\"\",\"voText\":\"开场白\"}]}"));
    }

    @Test
    void seedKeepsCastNamesAbsentWhenNotDeclared() {
        var data = DramaShortPromptService.seedToDraftData(
                node("{\"characters\":[{\"name\":\"阿宁\",\"visual\":\"齐耳短发\"}],"
                        + "\"shots\":[{\"durationSec\":4,\"visual\":\"画面\"},"
                        + "{\"durationSec\":4,\"visual\":\"空镜\",\"castNames\":[]}]}"), OM);
        assertFalse(data.path("shots").get(0).has("castNames"), "未标注的镜头不写 castNames");
        assertTrue(data.path("shots").get(1).has("castNames"), "显式空数组要保留");
        assertEquals(0, data.path("shots").get(1).path("castNames").size());
    }

    // ── seed → 草稿 payload ─────────────────────────────────────────────────────

    @Test
    void seedBuildsDraftDataWithVisualBibleAndPromptSource() {
        JsonNode seed = node("""
                {"title":"搬来第七天","logline":"她终于开口","style":["电影感","治愈"],
                 "universalPrompt":"自然光竖屏",
                 "characters":[{"name":"阿宁","visual":"齐耳短发","performance":"慢热"}],
                 "scenes":[{"name":"咖啡馆吧台","visual":"午后逆光"}],
                 "shots":[{"durationSec":4,"visual":"抱纸箱进门","voText":"搬来第七天。","castNames":["阿宁"],
                           "sceneName":"咖啡馆吧台","timecode":"00:00-00:04"}],
                 "notes":["有一镜时长按画面复杂度估"],
                 "promptSource":{"raw":"原始提示词全文"}}
                """);
        var data = DramaShortPromptService.seedToDraftData(seed, OM);

        assertEquals("搬来第七天", data.path("title").asText());
        assertEquals("电影感 · 治愈", data.path("fmtName").asText(), "风格标签同时用于展示与出片风格名");
        assertEquals("午后逆光", data.path("meta").path("scene").asText());
        assertEquals("阿宁", data.path("meta").path("character").path("name").asText());
        assertEquals("自然光竖屏", data.path("visualBible").path("universal").asText());
        assertEquals(1, data.path("visualBible").path("characters").size());
        assertEquals("原始提示词全文", data.path("promptSource").path("raw").asText());
        assertFalse(data.path("promptSource").path("parsedAt").asText("").isBlank());
        assertEquals(1, data.path("promptNotes").size());

        JsonNode shot = data.path("shots").get(0);
        assertEquals(1, shot.path("no").asInt());
        assertEquals(4, shot.path("dur").asInt());
        assertEquals("旁白", shot.path("voWho").asText(), "有台词但没写说话人 → 落旁白");
        assertEquals("咖啡馆吧台", shot.path("sceneName").asText());
        assertEquals("阿宁", shot.path("castNames").get(0).asText());
        assertEquals("draft", shot.path("flow").asText());
        assertTrue(shot.path("refs").isArray());
    }

    @Test
    void seedRejectsClientFakedMedia() {
        // 客户端把 seed 里的镜头标成已完成并塞视频地址 —— 一律按 draft 落库，绝不接受伪造成片（§8.0）。
        JsonNode seed = node("""
                {"title":"伪造","shots":[{"durationSec":4,"visual":"画面","flow":"done",
                  "videoUrl":"https://evil.example/fake.mp4","frameUrl":"https://evil.example/fake.jpg",
                  "audio":{"cdnKey":"fake","durationSec":4,"textFingerprint":"x"}}]}
                """);
        var data = DramaShortPromptService.seedToDraftData(seed, OM);
        JsonNode shot = data.path("shots").get(0);
        assertEquals("draft", shot.path("flow").asText());
        assertFalse(shot.has("videoUrl"));
        assertFalse(shot.has("frameUrl"));
        assertFalse(shot.has("audio"));
        assertFalse(data.has("assembled"));
    }

    @Test
    void seedWithoutStyleFallsBackToNeutralName() {
        var data = DramaShortPromptService.seedToDraftData(
                node("{\"shots\":[{\"durationSec\":4,\"visual\":\"画面\"}]}"), OM);
        assertEquals("自定义短片", data.path("fmtName").asText(), "不能回落到「口播带货」这类误导性默认");
        assertEquals("未命名短视频", data.path("title").asText());
    }
}
