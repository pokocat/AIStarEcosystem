package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 导演台全能创作助手：原文定位、建议的范围校验、回复回投、采用前核对与撤销。 */
class DirectorAssistantTest {
    final ObjectMapper om = new ObjectMapper();
    final IpRunRepository runs = mock(IpRunRepository.class);
    final DirectorService service = new DirectorService(null, runs, null, null, null, null, mock(StudioVideoService.class),
            mock(StudioFixtureProvider.class), null, null, null, null, mock(AiAppSceneModelPolicyService.class), null, null, null,
            om, mock(PlatformTransactionManager.class));

    @Test
    void locateFindsExactTextFirstThenIgnoresWhitespaceDifferences() {
        String content = "老贺凑过去看。那盆绿萝叶子油绿，\n中间一片叶面上，慢慢鼓起一道弯弯的纹。";
        assertArrayEquals(new int[]{0, 7}, DirectorAssistant.locate(content, "老贺凑过去看。"));
        int[] r = DirectorAssistant.locate(content, "叶子油绿， 中间一片叶面上");
        assertNotNull(r);
        assertEquals("叶子油绿，\n中间一片叶面上", content.substring(r[0], r[1]));
        assertNull(DirectorAssistant.locate(content, "陈德茂伸手挡住"));
        assertEquals("老贺凑近看。那盆", DirectorAssistant.splice("老贺凑过去看。那盆", DirectorAssistant.locate("老贺凑过去看。那盆", "凑过去看"), "凑近看"));
    }

    @Test
    void validateKeepsOnlyProposalsOfThisRoundsScopeAndKnownIds() {
        ObjectNode meta = om.createObjectNode().put("task", "assistant");
        meta.putArray("allowed").add("clip.prompt");
        meta.putArray("clipIds").add("cl1");
        meta.putArray("which").add("video");
        ObjectNode out = om.createObjectNode().put("reply", "改好了视频提示词。");
        var ps = out.putArray("proposals");
        ps.addObject().put("type", "clip.prompt").put("clipId", "cl1").put("which", "video").put("text", "新的视频提示词").put("note", "缩短");
        // 提示词范围不许改剧情：镜头建议、别的片段、分镜图提示词都丢掉
        ps.addObject().put("type", "clip.shots").put("clipId", "cl1");
        ps.addObject().put("type", "clip.prompt").put("clipId", "cl9").put("which", "video").put("text", "x");
        ps.addObject().put("type", "clip.prompt").put("clipId", "cl1").put("which", "board").put("text", "x");
        JsonNode r = DirectorAssistant.validate(om, meta, out);
        assertEquals(1, r.path("proposals").size());
        assertEquals(3, r.path("dropped").asInt());
        assertThrows(BusinessException.class, () -> DirectorAssistant.validate(om, meta, om.createObjectNode().put("reply", "")));
    }

    private ObjectNode work() {
        ObjectNode c = om.createObjectNode().put("draft", "").put("draftRev", 3).put("idea", "绿萝长耳朵");
        for (String f : List.of("assets", "clips", "applied")) c.putArray(f);
        c.putObject("taskMeta"); c.putObject("settings");
        ObjectNode ep = c.putArray("episodes").addObject().put("id", "ep1").put("no", 1).put("title", "叶上的耳朵").put("rev", 1)
                .put("content", "老贺凑过去看。那盆绿萝叶子油绿。\n陈德茂头也不抬：别人丢的。");
        ep.put("planStale", false);
        ObjectNode thread = c.putObject("assistant").put("current", "th1").putArray("threads").addObject().put("id", "th1").put("title", "t");
        ObjectNode pending = thread.putArray("messages").addObject().put("id", "m2").put("role", "assistant").put("status", "pending").put("text", "");
        pending.putObject("scope").put("kind", "selection").put("label", "第 1 集 · 叶上的耳朵 · 已选正文");
        pending.putArray("proposals");
        return c;
    }

    private IpRun reply(ObjectNode proposal) {
        ObjectNode meta = om.createObjectNode().put("task", "assistant").put("messageId", "m2");
        ObjectNode input = om.createObjectNode(); input.set("_director", meta);
        ObjectNode output = om.createObjectNode();
        ObjectNode d = output.putObject("director").put("reply", "只调整这一段：").put("dropped", 0);
        d.putArray("proposals").add(proposal);
        return IpRun.builder().id("r1").nodeId("assistant").status("done").inputJson(input.toString()).outputJson(output.toString()).build();
    }

    @Test
    void replyLandsInPendingMessageAndAppliedEditCanBeUndoneButNeverOverwritesLaterUserEdits() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("枯绿");
        ObjectNode c = work();
        ObjectNode p = om.createObjectNode().put("type", "script.replace").put("target", "ep1")
                .put("original", "老贺凑过去看。").put("replacement", "老贺凑近那盆绿萝，收音机忽然没了声。").put("note", "更诡异");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(reply(p)));
        assertTrue(service.reconcile(w, c));
        JsonNode msg = c.path("assistant").path("threads").get(0).path("messages").get(0);
        assertEquals("done", msg.path("status").asText());
        assertEquals("第 1 集", msg.path("proposals").get(0).path("targetLabel").asText());
        assertEquals("open", msg.path("proposals").get(0).path("status").asText());

        ObjectNode data = om.createObjectNode().put("messageId", "m2").put("proposalId", "p1");
        // 采用前用户在别处又改了一句：不影响替换，其余正文保留
        ((ObjectNode) c.path("episodes").get(0)).put("content", "老贺凑过去看。那盆绿萝叶子油绿。\n陈德茂头也不抬：别人丢的，你别碰。");
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data);
        assertEquals("老贺凑近那盆绿萝，收音机忽然没了声。那盆绿萝叶子油绿。\n陈德茂头也不抬：别人丢的，你别碰。", c.path("episodes").get(0).path("content").asText());
        assertEquals(2, c.path("episodes").get(0).path("rev").asInt());
        assertEquals("applied", msg.path("proposals").get(0).path("status").asText());
        // 重复采用被拒
        assertEquals("DIRECTOR_PROPOSAL_STALE", assertThrows(BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data)).getCode());
        // 撤销回到原文
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.undo", data);
        assertEquals("老贺凑过去看。那盆绿萝叶子油绿。\n陈德茂头也不抬：别人丢的，你别碰。", c.path("episodes").get(0).path("content").asText());
        assertEquals("open", msg.path("proposals").get(0).path("status").asText());
        // 用户把那句原文自己改掉了：建议不能再写入，不覆盖用户的修改
        ((ObjectNode) c.path("episodes").get(0)).put("content", "老贺弯腰看了看。那盆绿萝叶子油绿。");
        assertEquals("DIRECTOR_PROPOSAL_STALE", assertThrows(BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data)).getCode());
        assertEquals("老贺弯腰看了看。那盆绿萝叶子油绿。", c.path("episodes").get(0).path("content").asText());
    }

    @Test
    void shotSuggestionIsRefusedWhenTheClipChangedAfterTheAssistantSawIt() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("枯绿");
        ObjectNode c = work();
        ObjectNode clip = ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("clips")).addObject().put("id", "cl1").put("episodeId", "ep1").put("order", 1).put("rev", 1);
        clip.putArray("shots").addObject().put("id", "sh1").put("durationSec", 3).put("size", "中景").put("camera", "").put("action", "走近").put("still", "站在桌前").putArray("dialogue");
        clip.put("title", "").put("summary", "").put("boardPrompt", "").put("boardPromptCustom", false).put("videoPrompt", "").put("videoPromptCustom", false);
        clip.putArray("assetIds");
        for (String slot : List.of("board", "video")) { ObjectNode x = clip.putObject(slot); x.putArray("candidates"); x.putNull("adoptedId"); x.putArray("pending"); }
        String sig = ReflectionTestUtils.invokeMethod(service, "shotsSig", clip.path("shots"));
        ObjectNode p = om.createObjectNode().put("type", "clip.shots").put("clipId", "cl1").put("note", "手部特写");
        p.putArray("shots").addObject().put("id", "sh1").put("durationSec", 3).put("size", "特写").put("camera", "").put("action", "走近").put("still", "手部").putArray("dialogue");
        ObjectNode meta = om.createObjectNode().put("task", "assistant").put("messageId", "m2");
        meta.putObject("before").putObject("clips").putObject("cl1").put("shotsSig", sig).set("shots", clip.path("shots").deepCopy());
        ObjectNode input = om.createObjectNode(); input.set("_director", meta);
        ObjectNode output = om.createObjectNode();
        output.putObject("director").put("reply", "改了第 1 镜").putArray("proposals").add(p);
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(IpRun.builder().id("r1").nodeId("assistant").status("done")
                .inputJson(input.toString()).outputJson(output.toString()).build()));
        service.reconcile(w, c);
        ObjectNode data = om.createObjectNode().put("messageId", "m2").put("proposalId", "p1");
        ((ObjectNode) clip.path("shots").get(0)).put("action", "用户改过的动作");
        assertEquals("DIRECTOR_PROPOSAL_STALE", assertThrows(BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data)).getCode());
        assertEquals("用户改过的动作", clip.path("shots").get(0).path("action").asText());
    }

    @Test
    void failedReplyMarksTheMessageFailedWithoutTouchingTheScriptError() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("枯绿");
        ObjectNode c = work();
        ObjectNode meta = om.createObjectNode().put("task", "assistant").put("messageId", "m2");
        ObjectNode input = om.createObjectNode(); input.set("_director", meta);
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(IpRun.builder().id("r1").nodeId("assistant").status("failed")
                .errorMessage("积分不足").inputJson(input.toString()).outputJson("{}").build()));
        service.reconcile(w, c);
        JsonNode msg = c.path("assistant").path("threads").get(0).path("messages").get(0);
        assertEquals("failed", msg.path("status").asText());
        assertEquals("积分不足", msg.path("error").asText());
        assertTrue(c.path("textError").isMissingNode() || c.path("textError").isNull());
    }

    // ── review 2026-10-28：选区位置、撤销那一处、删除可撤销、超出选区的建议 ──

    private ObjectNode selectionReply(ObjectNode c, String content, int start, int end, String original, String replacement) {
        ((ObjectNode) c.path("episodes").get(0)).put("content", content);
        ObjectNode scope = (ObjectNode) c.path("assistant").path("threads").get(0).path("messages").get(0).path("scope");
        scope.put("episodeId", "ep1").put("text", content.substring(start, end)).put("start", start).put("end", end);
        return om.createObjectNode().put("type", "script.replace").put("target", "ep1").put("original", original).put("replacement", replacement).put("note", "");
    }

    @Test
    void selectedSecondOccurrenceIsTheOneChangedAndUndoRestoresExactlyIt() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        String content = "甲：别碰。\n乙：别碰。";
        ObjectNode p = selectionReply(c, content, 8, 11, "别碰。", "慢着。");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(reply(p)));
        service.reconcile(w, c);
        ObjectNode data = om.createObjectNode().put("messageId", "m2").put("proposalId", "p1");
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data);
        assertEquals("甲：别碰。\n乙：慢着。", c.path("episodes").get(0).path("content").asText());
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.undo", data);
        assertEquals(content, c.path("episodes").get(0).path("content").asText());
    }

    @Test
    void undoRestoresTheAppliedPlaceEvenWhenTheNewTextAlsoAppearsEarlier() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        String content = "先前：他走了。\n现在：他离开。";
        ObjectNode p = selectionReply(c, content, content.indexOf("他离开。"), content.length(), "他离开。", "他走了。");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(reply(p)));
        service.reconcile(w, c);
        ObjectNode data = om.createObjectNode().put("messageId", "m2").put("proposalId", "p1");
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data);
        assertEquals("先前：他走了。\n现在：他走了。", c.path("episodes").get(0).path("content").asText());
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.undo", data);
        assertEquals(content, c.path("episodes").get(0).path("content").asText());
    }

    @Test
    void deletionCanBeUndoneRightAway() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        String content = "开场。\n要删的句子。\n结尾。";
        ObjectNode p = selectionReply(c, content, 4, 10, "要删的句子。", "");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(reply(p)));
        service.reconcile(w, c);
        ObjectNode data = om.createObjectNode().put("messageId", "m2").put("proposalId", "p1");
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data);
        assertEquals("开场。\n\n结尾。", c.path("episodes").get(0).path("content").asText());
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.undo", data);
        assertEquals(content, c.path("episodes").get(0).path("content").asText());
    }

    @Test
    void suggestionsOutsideTheSelectionOrAmbiguousWithoutSelectionAreDropped() {
        ObjectNode meta = om.createObjectNode();
        meta.putArray("allowed").add("script.replace");
        meta.putArray("scriptTargets").add("ep1");
        meta.put("selection", "只许改这句。");
        ObjectNode out = om.createObjectNode().put("reply", "已给建议");
        out.putArray("proposals").addObject().put("type", "script.replace").put("target", "ep1").put("original", "不许改的其他段。").put("replacement", "却被改了。");
        assertEquals(0, DirectorAssistant.validate(om, meta, out).path("proposals").size());
        // 没选区：原文在正文里出现两处，回投时丢掉，不猜第一处
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        ((ObjectNode) c.path("episodes").get(0)).put("content", "甲：别碰。\n乙：别碰。");
        ((ObjectNode) c.path("assistant").path("threads").get(0).path("messages").get(0).path("scope")).put("kind", "script").put("episodeId", "ep1");
        ObjectNode p = om.createObjectNode().put("type", "script.replace").put("target", "ep1").put("original", "别碰。").put("replacement", "慢着。");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(reply(p)));
        service.reconcile(w, c);
        JsonNode msg = c.path("assistant").path("threads").get(0).path("messages").get(0);
        assertEquals(0, msg.path("proposals").size());
        assertEquals(1, msg.path("dropped").asInt());
    }

    // ── 写剧本前的创意对话 ──

    @Test
    void goPhrasesEndTheConversationButOrdinaryAnswersDoNot() {
        for (String go : List.of("你决定", "直接写吧", "开始生成", "都行。", "不用问了", "交给你", "直接写三集", "开始写吧，结局要悲一点", "写吧")) assertTrue(DirectorAssistant.saysGo(go), go);
        // review 2026-10-28：这些是回答，不是「开始写」
        for (String no : List.of("都行，但结局要反转", "主角是快递员，你决定结局怎么样？其他按我说的", "悬疑", "写三集", "写实一点", "写成悲剧", "生成一个反派")) assertFalse(DirectorAssistant.saysGo(no), no);
    }

    @Test
    void briefAtTheRoundCapConcludesAndDiscardsQuestions() {
        ObjectNode meta = om.createObjectNode().put("task", "brief").put("mustConclude", true);
        ObjectNode out = om.createObjectNode().put("reply", "再问一个").put("ready", false).put("summary", "写一个悬疑短剧").put("genre", "都市悬疑").put("tone", "不存在的调性");
        out.putArray("questions").addObject().put("q", "结局？").putArray("options").add("好").add("坏");
        JsonNode r = DirectorAssistant.validateBrief(om, meta, out);
        assertTrue(r.path("ready").asBoolean());
        assertEquals(0, r.path("questions").size());
        assertEquals("都市悬疑", r.path("genre").asText());
        assertEquals("", r.path("tone").asText());
    }

    @Test
    void briefReplyCountsRoundsAndScriptCarriesTheConfirmedAnswers() {
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        c.put("idea", "快递站夜班收到寄给十年后自己的包裹");
        ObjectNode b = c.putObject("brief").put("status", "asking").put("rounds", 0).put("maxRounds", 3).put("summary", "").put("genre", "").put("tone", "").put("title", "");
        var msgs = b.putArray("messages");
        msgs.addObject().put("id", "b1").put("role", "assistant").put("status", "pending").put("text", "");
        ObjectNode meta = om.createObjectNode().put("task", "brief").put("messageId", "b1");
        ObjectNode input = om.createObjectNode(); input.set("_director", meta);
        ObjectNode output = om.createObjectNode();
        ObjectNode d = output.putObject("director").put("reply", "先定两件事").put("ready", false).put("summary", "").put("genre", "").put("tone", "").put("title", "");
        d.putArray("questions").addObject().put("q", "想要什么感觉？").putArray("options").add("细思极恐");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(IpRun.builder().id("r1").nodeId("brief").status("done").inputJson(input.toString()).outputJson(output.toString()).build()));
        service.reconcile(w, c);
        assertEquals(1, c.path("brief").path("rounds").asInt());
        assertEquals("asking", c.path("brief").path("status").asText());
        msgs.addObject().put("id", "b2").put("role", "user").put("status", "done").put("text", "想要什么感觉？ 细思极恐");
        String brief = ReflectionTestUtils.invokeMethod(service, "briefForScript", c, true);
        assertTrue(brief.startsWith("快递站夜班收到寄给十年后自己的包裹"));
        assertTrue(brief.contains("答：想要什么感觉？ 细思极恐"));
        assertTrue(brief.contains("由你按最适合这个故事的方式补齐"));
    }

    @Test
    void missingIdFallsBackToTheOnlyObjectOfThisRoundButNotWhenAmbiguous() {
        ObjectNode meta = om.createObjectNode();
        meta.putArray("allowed").add("clip.prompt").add("asset.update");
        meta.putArray("clipIds").add("cl1");
        meta.putArray("which").add("video");
        meta.putArray("assetIds").add("as1").add("as2");
        ObjectNode out = om.createObjectNode().put("reply", "改好了");
        var ps = out.putArray("proposals");
        ps.addObject().put("type", "clip.prompt").put("text", "新提示词");
        ps.addObject().put("type", "asset.update").put("description", "更疲惫");
        JsonNode r = DirectorAssistant.validate(om, meta, out);
        assertEquals(1, r.path("proposals").size());
        assertEquals("cl1", r.path("proposals").get(0).path("clipId").asText());
        assertEquals("video", r.path("proposals").get(0).path("which").asText());
        assertEquals(1, r.path("dropped").asInt());
    }

    @Test
    void repliesAreShownAsPlainText() {
        assertEquals("开头最大的问题是慢。\n1. 悬念铺垫太长\n· 方向一", DirectorAssistant.plain("开头最大的问题是**慢**。\n1. **悬念铺垫太长**\n*   方向一"));
        assertEquals("我可以给一条修改建议，把下装补进外观设定，再同步出图提示词", DirectorAssistant.plain("我可以给一条 asset.update，把下装补进 description，再同步 prompt"));
    }

    // review 2026-10-28（两轮）：同一人物两场说同一句话；建议针对第二场，用户先把第二场改了，采用必须失败，第一场不能被改。
    @Test
    void suggestionForAPlaceTheUserAlreadyRewroteIsRefusedEvenWhenTheSameLineAppearsElsewhere() {
        String line = "老贺盯着门口，压低声音说：别碰。";
        String content = "## 第1场 花木市场\n" + line + "\n陈德茂没抬头。\n## 第2场 花木市场\n" + line + "\n陈德茂没抬头。";
        int second = content.lastIndexOf("别碰。");
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        ((ObjectNode) c.path("episodes").get(0)).put("content", content);
        ObjectNode scope = (ObjectNode) c.path("assistant").path("threads").get(0).path("messages").get(0).path("scope");
        scope.put("episodeId", "ep1").put("text", "别碰。").put("start", second).put("end", second + 3);
        ObjectNode p = om.createObjectNode().put("type", "script.replace").put("target", "ep1").put("original", "别碰。").put("replacement", "慢着。");
        when(runs.findByProjectIdOrderByCreatedAtDesc("w")).thenReturn(List.of(reply(p)));
        service.reconcile(w, c);
        ObjectNode data = om.createObjectNode().put("messageId", "m2").put("proposalId", "p1");
        String edited = content.substring(0, second) + "别动。" + content.substring(second + 3);
        ((ObjectNode) c.path("episodes").get(0)).put("content", edited);
        assertEquals("DIRECTOR_PROPOSAL_STALE", assertThrows(BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data)).getCode());
        assertEquals(edited, c.path("episodes").get(0).path("content").asText());

        // 别处改了（第一场加一句、改标题）不影响：照样改第二场那一处；撤销前别处再改，撤销仍只恢复那一处。
        String far = content.replace("## 第1场 花木市场\n", "## 第1场 花木市场 · 上午\n摊位上堆着空花盆。\n");
        ((ObjectNode) c.path("episodes").get(0)).put("content", far);
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data);
        String applied = c.path("episodes").get(0).path("content").asText();
        assertEquals(far.substring(0, far.lastIndexOf("别碰。")) + "慢着。" + far.substring(far.lastIndexOf("别碰。") + 3), applied);
        String moreEdits = applied.replace("摊位上堆着空花盆。", "摊位上堆着空花盆，地上全是土。");
        ((ObjectNode) c.path("episodes").get(0)).put("content", moreEdits);
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.undo", data);
        assertEquals(far.replace("摊位上堆着空花盆。", "摊位上堆着空花盆，地上全是土。"), c.path("episodes").get(0).path("content").asText());
        // 撤销后回到「未采用」，还能再采用同一处
        ReflectionTestUtils.invokeMethod(service, "proposalOp", "u", w, c, "assistant.apply", data);
        assertTrue(c.path("episodes").get(0).path("content").asText().endsWith("压低声音说：慢着。\n陈德茂没抬头。"));
        assertEquals(1, c.path("episodes").get(0).path("content").asText().split("慢着", -1).length - 1);
    }

    @Test
    void mapRangeOnlyFollowsUntouchedLines() {
        String base = "甲：别碰。\n乙：别碰。";
        int at = base.lastIndexOf("别碰。");
        assertNull(DirectorAssistant.mapRange(base, "甲：别碰。\n乙：别动。", at, at + 3));
        // 一模一样的行少了一行：认不准用户删的是哪一行，不映射
        assertNull(DirectorAssistant.mapRange("别碰。\n别碰。", "别碰。", 4, 7));
        String shifted = "开场白。\n甲：别碰。\n乙：别碰。";
        assertArrayEquals(new int[]{shifted.lastIndexOf("别碰。"), shifted.lastIndexOf("别碰。") + 3}, DirectorAssistant.mapRange(base, shifted, at, at + 3));
        // 删除后的撤销：空范围也能按行映射
        assertArrayEquals(new int[]{8, 8}, DirectorAssistant.mapRange("开场。\n\n结尾。", "多一行。\n开场。\n\n结尾。", 3, 3));
    }

    // review 2026-10-28：「直接写三集」里的要求要进剧本提示词（先记下这句话再组装）。
    @Test
    void goMessageWithRequirementsIsPartOfTheScriptPrompt() {
        var textRuns = mock(com.aistareco.aep.ipstudio.service.StudioWorkflowService.class);
        var svc = new DirectorService(null, runs, null, null, textRuns, null, mock(StudioVideoService.class),
                mock(StudioFixtureProvider.class), null, null, null, null, mock(AiAppSceneModelPolicyService.class), null, null, null,
                om, mock(PlatformTransactionManager.class));
        doThrow(new IllegalStateException("captured")).when(textRuns).submitDirectorText(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        DirectorWork w = new DirectorWork(); w.setId("w"); w.setTitle("t");
        ObjectNode c = work();
        c.putArray("episodes"); c.put("draft", "").put("idea", "快递站夜班收到寄给十年后自己的包裹");
        ObjectNode b = c.putObject("brief").put("status", "asking").put("rounds", 1).put("maxRounds", 3).put("summary", "").put("genre", "").put("tone", "").put("title", "");
        b.putArray("messages");
        var req = new DirectorService.TaskRequest("brief", null, "c1", om.createObjectNode().put("message", "直接写三集"), null, 21L);
        assertThrows(IllegalStateException.class, () -> ReflectionTestUtils.invokeMethod(svc, "askBrief", "u", w, c, req, req.options()));
        var user = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(textRuns).submitDirectorText(any(), any(), eq("script"), any(), user.capture(), any(), any(), any(), any(), any());
        assertTrue(user.getValue().contains("直接写三集"), user.getValue());
    }
}
