package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.materialvideo.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 剧本正文不限长度（2026-10-29 用户要求取消 6 万字）：长正文能存、能改、能拆集；
 * 一次模型调用只交它读得下的一段，分批或按范围读，并说清读了哪一段，不悄悄丢掉后半部。
 * 默认输入上限 32000 Token（测试里的文本模型没配按量计价），一次能读 24000 字。
 */
class DirectorLongTextTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private final DirectorWorkRepository works = mock(DirectorWorkRepository.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final StudioWorkflowService text = mock(StudioWorkflowService.class);
    private final IpProjectService projects = mock(IpProjectService.class);
    private final List<String> prompts = new ArrayList<>();
    private final List<JsonNode> metas = new ArrayList<>();
    private DirectorService service;
    private DirectorWork work;

    @BeforeEach void setUp() {
        when(projects.requireOwnedAssetKey(eq(USER), any())).thenAnswer(i -> i.getArgument(1));
        when(text.directorPrices(any())).thenReturn(new long[]{21, 16});
        when(text.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 16, 21, null, List.of(), "selectable", "selectable"));
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        org.mockito.stubbing.Answer<IpRunDto> submit = i -> {
            prompts.add(i.getArgument(4)); metas.add(((JsonNode) i.getArgument(6)).deepCopy());
            return new IpRunDto("r" + prompts.size(), work.getId(), i.getArgument(2), "text", "running", "queued", 0, 21, null, null, om.createObjectNode(), om.createObjectNode(), null, null, null);
        };
        when(text.submitDirectorText(any(), any(), any(), any(), any(), any(), any(), nullable(String.class), any(), any())).thenAnswer(submit);
        when(text.submitDirectorText(any(), any(), any(), any(), any(), any(), any(), nullable(String.class), any(), any(), any())).thenAnswer(submit);
        service = new DirectorService(works, runs, projects, mock(IpRunService.class), text, mock(StudioWorkflowWorker.class), mock(StudioVideoService.class),
                mock(StudioFixtureProvider.class), mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), null, mock(MaterialVideoModelClient.class),
                mock(AiAppSceneModelPolicyService.class), mock(FileStorageService.class), new IpStudioProperties(), mock(IpLibraryService.class), om, mock(PlatformTransactionManager.class));
    }

    /** n 字的正文：每行 20 字，开头和结尾各一句独有的话。 */
    private static String body(int n, String head, String tail) {
        StringBuilder b = new StringBuilder(head).append('\n');
        String line = "雨夜老街，小鹿提灯穿过人群走向面摊。\n";
        while (b.length() + tail.length() < n) b.append(line);
        return b.append(tail).toString();
    }

    private ObjectNode content() throws Exception { return (ObjectNode) om.readTree(work.getContentJson()); }

    private void store(ObjectNode c) throws Exception { work.setContentJson(om.writeValueAsString(c)); }

    private JsonNode edit(String op, String target, Long rev, String data) throws Exception {
        return service.edit(USER, work.getId(), new DirectorService.EditRequest(op, target, rev, om.readTree(data)));
    }

    private JsonNode task(String type, String target, JsonNode options) {
        return service.task(USER, work.getId(), new DirectorService.TaskRequest(type, target, "req-" + type + "-" + prompts.size() + "-" + UUID.randomUUID().toString().substring(0, 6), options, null, 21L));
    }

    /** 直接放几集正文进去（不经过拆分）。 */
    private void episodes(String... contents) throws Exception {
        ObjectNode c = content();
        ArrayNode eps = c.putArray("episodes");
        for (int i = 0; i < contents.length; i++)
            eps.addObject().put("id", "ep" + (i + 1)).put("no", i + 1).put("title", "第" + (i + 1) + "集").put("summary", "").put("content", contents[i])
                    .put("extracted", false).put("planStale", false).put("rev", 1);
        store(c);
    }

    @Test void scriptOfAnyLengthIsSavedWholeAndStaysEditable() throws Exception {
        String million = body(1_000_000, "开头哨兵：第一场", "结尾哨兵：全剧终");
        JsonNode v = service.create(USER, new DirectorService.CreateRequest("百万字", "", million));
        assertEquals(million.length(), v.path("draft").asText().length());
        assertTrue(v.path("draft").asText().endsWith("结尾哨兵：全剧终"));
        String longer = million + "\n补一场：天亮了。";
        v = service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, longer, v.path("draftRev").asLong(), null));
        assertEquals(longer, v.path("draft").asText());
        v = edit("draft.asEpisode", null, null, "{}");
        JsonNode ep = v.path("episodes").get(0);
        assertEquals(longer, ep.path("content").asText(), "作为一集也不截断");
        String edited = longer.replace("开头哨兵", "开头已改");
        v = edit("episode.update", ep.path("id").asText(), ep.path("rev").asLong(), om.writeValueAsString(Map.of("content", edited)));
        assertEquals(edited, v.path("episodes").get(0).path("content").asText());
        assertEquals(24000, v.path("pricing").path("textChars").asInt(), "页面据此说明 AI 一次能读多少");
    }

    @Test void aiSplitRefusesWhatTheModelCannotReadWholeButHeadingSplitIsFreeAtAnyLength() throws Exception {
        JsonNode v = service.create(USER, new DirectorService.CreateRequest("长篇", "", body(100_000, "没有分集标题", "完")));
        BusinessException e = assertThrows(BusinessException.class, () -> task("split", null, om.createObjectNode()));
        assertEquals("DIRECTOR_TEXT_TOO_LONG_FOR_MODEL", e.getCode());
        assertTrue(e.getMessage().startsWith("剧本约 100,0") && e.getMessage().contains("约 24,000 字") && e.getMessage().contains("没有扣积分"), e.getMessage());
        assertTrue(prompts.isEmpty(), "读不全就不交给模型");

        String headed = "# 第1集 夜市\n" + body(40_000, "夜市开头", "夜市结尾") + "\n# 第2集 雨夜\n" + body(40_000, "雨夜开头", "雨夜结尾");
        v = service.patch(USER, work.getId(), new DirectorService.PatchRequest(null, null, headed, v.path("draftRev").asLong(), null));
        v = task("split", null, om.createObjectNode());
        assertTrue(prompts.isEmpty(), "按标题拆分不调模型");
        v = edit("split.save", v.path("pendingSplit").path("id").asText(), null, "{}");
        assertEquals(2, v.path("episodes").size());
        assertTrue(v.path("episodes").get(1).path("content").asText().endsWith("雨夜结尾"));
    }

    @Test void extractReadsInBatchesFromTheFirstUnreadEpisodeAndRefusesAnEpisodeTooLongToRead() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("分批", "", null));
        episodes(body(15_000, "第一集哨兵", "一完"), body(15_000, "第二集哨兵", "二完"), body(15_000, "第三集哨兵", "三完"));
        task("extract", null, null);
        assertTrue(prompts.get(0).contains("第一集哨兵") && !prompts.get(0).contains("第二集哨兵"), "一次只读放得下的集");
        JsonNode batch = metas.get(0).path("batch");
        assertEquals(1, batch.path("fromNo").asInt()); assertEquals(1, batch.path("toNo").asInt()); assertEquals(3, batch.path("total").asInt());

        ObjectNode c = content();
        ((ObjectNode) c.path("episodes").get(0)).put("extracted", true);
        store(c);
        task("extract", null, null);
        assertTrue(prompts.get(1).contains("第二集哨兵") && !prompts.get(1).contains("第一集哨兵") && !prompts.get(1).contains("第三集哨兵"), "接着读第一个没读过的集");

        episodes(body(30_000, "超长一集", "完"));
        BusinessException e = assertThrows(BusinessException.class, () -> task("extract", null, null));
        assertEquals("DIRECTOR_TEXT_TOO_LONG_FOR_MODEL", e.getCode());
        assertTrue(e.getMessage().startsWith("第 1 集正文约 30,0"), e.getMessage());
        assertEquals(2, prompts.size());
    }

    @Test void storyboardNeedsTheWholeEpisodeSoAnUnreadableEpisodeIsRefusedBeforeAnythingElse() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("写分镜", "", null));
        episodes(body(30_000, "一整集", "完"));
        for (String type : List.of("plan", "reshoot")) {
            BusinessException e = assertThrows(BusinessException.class, () -> task(type, "ep1", om.createObjectNode()));
            assertEquals("DIRECTOR_TEXT_TOO_LONG_FOR_MODEL", e.getCode(), type);
            assertTrue(e.getMessage().contains("拆成几集"), e.getMessage());
        }
        assertTrue(prompts.isEmpty());
    }

    @Test void assistantReadsTheStretchAroundTheCursorTellsTheUserAndEditsOnlyThere() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("助手", "", null));
        String content = body(100_000, "开头哨兵：小鹿说，灯灭了。", "结尾哨兵");
        int at = content.indexOf('\n', 60_000) + 1;
        content = content.substring(0, at) + "中段哨兵：小鹿说，灯灭了。\n" + content.substring(at);
        episodes(content);
        ObjectNode opts = om.createObjectNode().put("message", "把这句改得更紧张");
        opts.putObject("scope").put("kind", "script").put("episodeId", "ep1").put("focusAt", at + 3);
        JsonNode v = task("assistant", null, opts);
        String prompt = prompts.get(0);
        assertTrue(prompt.contains("中段哨兵") && !prompt.contains("开头哨兵") && !prompt.contains("结尾哨兵"), "只交光标附近那一段");
        assertTrue(prompt.contains("contentRange") && prompt.contains("不要说你读过了全文"));
        assertTrue(prompt.length() < 32_000, "整个请求在模型读得下的范围内：" + prompt.length());
        JsonNode msg = v.path("assistant").path("threads").get(0).path("messages").get(1);
        assertTrue(msg.path("range").asText().contains("全文 " + DirectorService.chars(content.length()) + " 字"), msg.path("range").asText());
        JsonNode win = msg.path("scope").path("window");
        assertTrue(win.path("from").asInt() <= at && at < win.path("to").asInt());
        // 一段有多长：接近一次能读的 24000 字（正文里几千个换行不能被算成「其它素材」把这一段挤小）。
        assertTrue(win.path("to").asInt() - win.path("from").asInt() > 20000, win.toString());

        // 回复里改「小鹿说，灯灭了。」：开头和中段各有一处，只读了中段，就改中段那一处，不因为全文有两处而丢掉建议。
        ObjectNode p = om.createObjectNode().put("type", "script.replace").put("target", "ep1").put("original", "小鹿说，灯灭了。")
                .put("replacement", "小鹿压低声音：灯，灭了。").put("note", "更紧张");
        reply(msg.path("id").asText(), p, om.createObjectNode().put("type", "script.replace").put("target", "ep1")
                .put("original", "雨夜老街，小鹿提灯穿过人群走向面摊。").put("replacement", "雨夜老街。").put("note", "这一段里重复很多次，认不准"));
        ObjectNode c = content();
        JsonNode done = c.path("assistant").path("threads").get(0).path("messages").get(1);
        assertEquals(1, done.path("proposals").size());
        assertEquals(1, done.path("dropped").asInt());
        ReflectionTestUtils.invokeMethod(service, "proposalOp", USER, work, c, "assistant.apply",
                om.createObjectNode().put("messageId", done.path("id").asText()).put("proposalId", "p1"));
        String after = c.path("episodes").get(0).path("content").asText();
        assertTrue(after.startsWith("开头哨兵：小鹿说，灯灭了。"), "开头那一处没动");
        assertTrue(after.contains("中段哨兵：小鹿压低声音：灯，灭了。"));
        assertEquals(content.length() + "小鹿压低声音：灯，灭了。".length() - "小鹿说，灯灭了。".length(), after.length());
    }

    @Test void boardImageDiscussionCarriesTheEpisodeScriptLikeThePromptEntry() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("分镜图", "", null));
        episodes("独立审查哨兵：小鹿故意把灯笼藏在门后，这个秘密尚未出现在片段摘要。");
        ObjectNode c = content();
        ObjectNode clip = c.withArray("clips").addObject().put("id", "k1").put("episodeId", "ep1").put("order", 1).put("title", "夜市").put("summary", "小鹿回家")
                .put("boardPrompt", "门口场景").put("rev", 1);
        clip.putArray("shots"); clip.putArray("assetIds"); clip.putArray("issues");
        ObjectNode slot = clip.putObject("board").put("adoptedId", "b1").put("adoptedBy", "user");
        slot.putArray("candidates").addObject().put("id", "b1").put("key", "u/board.png").put("source", "generated");
        clip.putObject("video").putArray("candidates");
        store(c);
        for (String kind : List.of("prompt", "image")) {
            ObjectNode opts = om.createObjectNode().put("message", "请结合本集剧本修改分镜图提示词");
            opts.putObject("scope").put("kind", kind).put("clipId", "k1").put("which", "board");
            task("assistant", null, opts);
            assertTrue(prompts.get(prompts.size() - 1).contains("独立审查哨兵"), kind + " 也要带上本集剧本");
        }

        // 本集很长：分镜图讨论只带片段在剧本里那一段附近，并说明读了哪段。
        String longEp = body(80_000, "开头", "结尾哨兵");
        int at = longEp.indexOf('\n', 50_000) + 1;
        longEp = longEp.substring(0, at) + "片段起始句：小鹿推开老宅的门。\n" + longEp.substring(at);
        c = content();
        ((ObjectNode) c.path("episodes").get(0)).put("content", longEp);
        ((ObjectNode) c.path("clips").get(0)).put("sourceQuote", "片段起始句：小鹿推开老宅的门。");
        store(c);
        ObjectNode opts = om.createObjectNode().put("message", "照剧本改分镜图");
        opts.putObject("scope").put("kind", "image").put("clipId", "k1").put("which", "board");
        JsonNode v = task("assistant", null, opts);
        String prompt = prompts.get(prompts.size() - 1);
        assertTrue(prompt.contains("片段起始句") && !prompt.contains("结尾哨兵"));
        JsonNode msgs = v.path("assistant").path("threads").get(0).path("messages");
        assertTrue(msgs.get(msgs.size() - 1).path("range").asText().startsWith("本集剧本很长"));
    }

    @Test void suggestionsOnALongScriptStoreOneSnapshotAndDoNotResendTheWholeTextOnEveryRead() throws Exception {
        service.create(USER, new DirectorService.CreateRequest("快照", "", null));
        // 六万字（超过随作品下发快照的五万字）；两处修改都在助手读的开头那一段里，「计数哨兵」不出现在任何建议里。
        String content = "独有开头一\n" + body(1_000, "第二句", "计数哨兵") + "\n" + body(4_000, "第三句", "独有结尾二") + "\n" + body(55_000, "第四句", "完");
        episodes(content);
        ObjectNode opts = om.createObjectNode().put("message", "改两处");
        opts.putObject("scope").put("kind", "script").put("episodeId", "ep1");
        JsonNode v = task("assistant", null, opts);
        String id = v.path("assistant").path("threads").get(0).path("messages").get(1).path("id").asText();
        reply(id, om.createObjectNode().put("type", "script.replace").put("target", "ep1").put("original", "独有开头一").put("replacement", "改过的开头").put("note", "a"),
                om.createObjectNode().put("type", "script.replace").put("target", "ep1").put("original", "独有结尾二").put("replacement", "改过的结尾").put("note", "b"));
        String json = work.getContentJson();
        assertEquals(2, json.split("计数哨兵", -1).length - 1, "正文一份 + 快照一份，不是每条建议一份");
        JsonNode view = service.get(USER, work.getId());
        JsonNode p1 = view.path("assistant").path("threads").get(0).path("messages").get(1).path("proposals").get(0);
        assertTrue(p1.path("base").isMissingNode(), "五万字以上的正文不随每次读作品下发快照");
        ReflectionTestUtils.invokeMethod(service, "proposalOp", USER, work, content(), "assistant.apply", om.createObjectNode().put("messageId", id).put("proposalId", "p1"));
    }

    /** 模拟助手回复回投（reconcile 读到这次任务完成）。 */
    private void reply(String messageId, ObjectNode... proposals) throws Exception {
        ObjectNode meta = om.createObjectNode().put("task", "assistant").put("messageId", messageId);
        ObjectNode input = om.createObjectNode(); input.set("_director", meta);
        ObjectNode output = om.createObjectNode();
        ArrayNode ps = output.putObject("director").put("reply", "改好了").put("dropped", 0).putArray("proposals");
        for (ObjectNode p : proposals) ps.add(p);
        when(runs.findByProjectIdOrderByCreatedAtDesc(work.getId())).thenReturn(List.of(IpRun.builder().id("r" + prompts.size()).nodeId("assistant").status("done")
                .projectId(work.getId()).inputJson(input.toString()).outputJson(output.toString()).build()));
        ObjectNode c = content();
        service.reconcile(work, c);
        store(c);
    }
}
