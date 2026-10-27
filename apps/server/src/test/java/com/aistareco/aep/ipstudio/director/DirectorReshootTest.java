package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 分镜页「重写分镜脚本」：保留片段划分、逐段换镜头（整集或单个片段），不出图、不动其他片段；
 * 已有分镜图和视频留在历史版本里标成需更新；重写期间改过的片段不覆盖。
 * 以及一键制作没有可做的步骤时直接说明原因，不建一条「已完成」的空连跑（2026-10-27 用户反馈「点了没反应」）。
 */
class DirectorReshootTest {
    private static final String USER = "u1";
    private final ObjectMapper om = new ObjectMapper();
    private DirectorWorkRepository works;
    private IpRunRepository runs;
    private StudioWorkflowService textRuns;
    private DirectorService service;
    private final List<IpRun> stored = new ArrayList<>();
    private DirectorWork work;
    private int runSeq;

    @BeforeEach
    void setUp() throws Exception {
        works = mock(DirectorWorkRepository.class);
        runs = mock(IpRunRepository.class);
        textRuns = mock(StudioWorkflowService.class);
        StudioVideoService videoModels = mock(StudioVideoService.class);
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)),
                List.of(new VideoStudioTier("768p", List.of(new VideoStudioCanvas("9:16", 768, 1344)))), 4, 15, 7000, 0L);
        when(videoModels.models()).thenReturn(List.of(new VideoStudioModel("ep-h3", "MiniMax H3", true, true, false, contract, null)));
        when(textRuns.directorPrices(any())).thenReturn(new long[]{21, 8});
        when(textRuns.capabilities()).thenReturn(new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Capabilities(false, List.of(), 8, 21, null, List.of(), "selectable", "selectable"));
        when(textRuns.submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), any(), any(), any(), any()))
                .thenAnswer(i -> new IpRunDto("IPR-" + (++runSeq), "DW-1", i.getArgument(2), "studio-director", "running", "queued", 0, 21, null, null, null, null, null, null, null));
        when(works.save(any())).thenAnswer(i -> { work = i.getArgument(0); return work; });
        when(works.lockById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(works.findById(any())).thenAnswer(i -> Optional.ofNullable(work));
        when(runs.findByProjectIdOrderByCreatedAtDesc(any())).thenAnswer(i -> new ArrayList<>(stored));
        when(runs.findByProjectIdAndNodeIdAndStatus(any(), any(), any())).thenAnswer(i -> stored.stream()
                .filter(r -> r.getNodeId().equals(i.getArgument(1)) && r.getStatus().equals(i.getArgument(2))).toList());
        service = new DirectorService(works, runs, mock(IpProjectService.class), mock(IpRunService.class), textRuns,
                mock(StudioWorkflowWorker.class), videoModels, mock(StudioFixtureProvider.class),
                mock(StudioMediaImportService.class), mock(MaterialVideoJobService.class), mock(MaterialVideoModelClient.class),
                mock(AiAppSceneModelPolicyService.class), mock(FileStorageService.class), new IpStudioProperties(), mock(IpLibraryService.class), om,
                mock(PlatformTransactionManager.class));

        work = new DirectorWork();
        work.setId("DW-1");
        work.setOwnerUserId(USER);
        work.setTitle("掉漆");
        work.setCreatedAt(Instant.now());
        work.setUpdatedAt(Instant.now());
        // 第 1 集两个片段：片段 1 已有采用的分镜图、视频提示词手改过；第 2 集一个片段。
        work.setContentJson("""
                {"settings":{"style":"真人写实","aspectRatio":"9:16"},"idea":"","draft":"","applied":[],"taskMeta":{},"seq":20,
                 "episodes":[
                  {"id":"ep1","no":1,"title":"掉漆","summary":"","content":"陈默发现壁画变了。\\n陈默：这里昨天还不是这样。","extracted":true,"planStale":false,"planError":null,"pendingPlan":null,"rev":1},
                  {"id":"ep2","no":2,"title":"风铃","summary":"","content":"陈默守夜。\\n陈默：今晚我守着你。","extracted":true,"planStale":false,"planError":null,"pendingPlan":null,"rev":1}],
                 "assets":[
                  {"id":"as1","kind":"character","name":"陈默","aliases":[],"description":"修复师","episodeIds":["ep1","ep2"],"promptCustom":false,
                   "image":{"candidates":[{"id":"m1","key":"k/chen.png","source":"generated"}],"adoptedId":"m1","adoptedBy":"user","error":null},"voice":null,"rev":1}],
                 "clips":[
                  {"id":"cl1","episodeId":"ep1","order":1,"title":"发现","summary":"陈默发现壁画变了","durationSec":12,"assetIds":["as1"],
                   "shots":[{"id":"sh1","durationSec":4,"size":"中景","camera":"固定","action":"陈默刷壁画","still":"陈默拿着刷子","dialogue":[]},
                            {"id":"sh2","durationSec":4,"size":"近景","camera":"推近","action":"陈默停下","still":"陈默停手","dialogue":[]},
                            {"id":"sh3","durationSec":4,"size":"特写","camera":"固定","action":"陈默开口","still":"陈默的侧脸","dialogue":[{"speakerId":"as1","text":"这里昨天还不是这样。"}]}],
                   "boardPrompt":"","boardPromptCustom":false,"videoPrompt":"我手改的视频提示词","videoPromptCustom":true,"issues":[],
                   "board":{"candidates":[{"id":"b1","key":"k/board.png","source":"generated"}],"adoptedId":"b1","adoptedBy":"user","error":null},
                   "video":{"candidates":[],"adoptedId":null,"adoptedBy":null,"error":null,"pending":[]},"rev":1},
                  {"id":"cl2","episodeId":"ep1","order":2,"title":"离开","summary":"陈默离开洞窟","durationSec":12,"assetIds":["as1"],
                   "shots":[{"id":"sh4","durationSec":4,"size":"全景","camera":"固定","action":"陈默走出","still":"陈默在洞口","dialogue":[]},
                            {"id":"sh5","durationSec":4,"size":"中景","camera":"跟拍","action":"陈默走远","still":"陈默的背影","dialogue":[]},
                            {"id":"sh6","durationSec":4,"size":"近景","camera":"固定","action":"陈默回头","still":"陈默回头","dialogue":[]}],
                   "boardPrompt":"","boardPromptCustom":false,"videoPrompt":"","videoPromptCustom":false,"issues":[],
                   "board":{"candidates":[],"adoptedId":null,"adoptedBy":null,"error":null},
                   "video":{"candidates":[],"adoptedId":null,"adoptedBy":null,"error":null,"pending":[]},"rev":1},
                  {"id":"cl3","episodeId":"ep2","order":1,"title":"守夜","summary":"陈默守夜","durationSec":12,"assetIds":["as1"],
                   "shots":[{"id":"sh7","durationSec":12,"size":"中景","camera":"固定","action":"陈默坐下","still":"陈默坐着","dialogue":[]}],
                   "boardPrompt":"","boardPromptCustom":false,"videoPrompt":"","videoPromptCustom":false,"issues":[],
                   "board":{"candidates":[],"adoptedId":null,"adoptedBy":null,"error":null},
                   "video":{"candidates":[],"adoptedId":null,"adoptedBy":null,"error":null,"pending":[]},"rev":1}]}""");
    }

    private JsonNode reshoot(String episodeId, String... clipIds) {
        ObjectNode o = om.createObjectNode();
        var ids = o.putArray("clipIds");
        for (String id : clipIds) ids.add(id);
        return service.task(USER, "DW-1", new DirectorService.TaskRequest("reshoot", episodeId, "r" + (runSeq + 1), o, null, 21L));
    }

    private ObjectNode lastMeta() {
        ArgumentCaptor<ObjectNode> meta = ArgumentCaptor.forClass(ObjectNode.class);
        verify(textRuns, atLeastOnce()).submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), meta.capture(), any(), any(), any());
        return meta.getValue();
    }

    /** 模型按约定写回的 JSON：每个要重写的片段换成三个新镜头。 */
    private ObjectNode modelOutput(List<String> ids) {
        ObjectNode out = om.createObjectNode();
        var clips = out.putArray("clips");
        for (String id : ids) {
            ObjectNode clip = clips.addObject().put("id", id).put("title", "新标题 " + id).put("summary", "新摘要").set("assetIds", om.createArrayNode().add("as1"));
            var shots = clip.putArray("shots");
            for (int i = 0; i < 3; i++) shots.addObject().put("durationSec", 4).put("size", i == 1 ? "特写" : "中景").put("camera", "新机位 " + i)
                    .put("action", "新动作 " + i).put("still", "新画面 " + i).putArray("dialogue");
        }
        return out;
    }

    /** 让最近一次重写「完成」：worker 里按同一份 meta 校验，再由读作品时回投。 */
    private JsonNode finish(String runId, String node, ObjectNode meta, ObjectNode output) throws Exception {
        ObjectNode input = om.createObjectNode();
        input.set("_director", meta);
        ObjectNode out = om.createObjectNode();
        out.set("director", DirectorPrompts.validate(om, meta, output));
        stored.removeIf(r -> r.getId().equals(runId));
        stored.add(IpRun.builder().id(runId).projectId("DW-1").hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId(node)
                .kind("studio-director").status(IpRun.STATUS_DONE).stage("done").cost(3).inputJson(om.writeValueAsString(input))
                .outputJson(om.writeValueAsString(out)).createdAt(Instant.now()).build());
        return service.get(USER, "DW-1");
    }

    private void running(String node) {
        stored.add(IpRun.builder().id("IPR-busy-" + node).projectId("DW-1").hostType(IpRun.HOST_DIRECTOR).ownerUserId(USER).nodeId(node)
                .kind("studio-director").status(IpRun.STATUS_RUNNING).stage("running").cost(0).inputJson("{}").createdAt(Instant.now()).build());
    }

    private static JsonNode clip(JsonNode v, String id) {
        for (JsonNode c : v.path("clips")) if (id.equals(c.path("id").asText())) return c;
        return null;
    }

    @Test
    void rewritingOneClipChangesOnlyThatClipAndKeepsItsBoardAsHistory() throws Exception {
        // 采用的分镜图按当前镜头生成（指纹对得上），重写后才变成「需更新」。
        String boardPrompt = clip(service.get(USER, "DW-1"), "cl1").path("boardPrompt").asText();
        ObjectNode content = (ObjectNode) om.readTree(work.getContentJson());
        ((ObjectNode) content.path("clips").get(0).path("board").path("candidates").get(0)).put("fingerprint", DirectorService.hash(boardPrompt + "|k/chen.png"));
        work.setContentJson(om.writeValueAsString(content));
        JsonNode before = service.get(USER, "DW-1");
        assertEquals("current", clip(before, "cl1").path("board").path("adoptedCheck").asText());
        reshoot("ep1", "cl1");
        ObjectNode meta = lastMeta();
        ArgumentCaptor<String> node = ArgumentCaptor.forClass(String.class), system = ArgumentCaptor.forClass(String.class), user = ArgumentCaptor.forClass(String.class);
        verify(textRuns).submitDirectorText(any(), any(), node.capture(), system.capture(), user.capture(), anyInt(), any(), any(), any(), any(), any());
        assertEquals("reshoot:cl1", node.getValue());
        assertTrue(system.getValue().contains("【重写范围】") && !system.getValue().contains("单片段装不下的对白顺延至下一片段"));
        JsonNode in = om.readTree(user.getValue().substring(user.getValue().indexOf('{')));
        assertEquals(List.of("cl1"), om.convertValue(in.path("rewriteIds"), List.class));
        assertEquals(2, in.path("clips").size(), "the whole episode is given for continuity");
        JsonNode target = in.path("clips").get(0), neighbour = in.path("clips").get(1);
        assertTrue(target.path("rewrite").asBoolean() && target.path("shots").isMissingNode(), "the old shots are not handed over, or the model copies them");
        assertEquals("这里昨天还不是这样。", target.path("lines").get(0).path("text").asText(), "the clip's lines define what it must keep");
        assertEquals(3, neighbour.path("shots").size(), "the neighbour keeps its shots for continuity");

        JsonNode v = finish("IPR-1", "reshoot:cl1", meta, modelOutput(List.of("cl1")));
        JsonNode c1 = clip(v, "cl1");
        assertEquals("新标题 cl1", c1.path("title").asText());
        assertEquals("新画面 0", c1.path("shots").get(0).path("still").asText());
        assertEquals(1, c1.path("order").asInt(), "same place in the episode");
        assertFalse(c1.path("videoPromptCustom").asBoolean(), "the hand-written video prompt is replaced, as the confirm dialog says");
        assertTrue(c1.path("videoPrompt").asText().contains("新动作 0"));
        assertEquals(1, c1.path("board").path("candidates").size(), "the old board stays in history");
        assertEquals("outdated", c1.path("board").path("adoptedCheck").asText());
        assertEquals(clip(before, "cl2"), clip(v, "cl2"), "the other clip in the episode is untouched");
        assertEquals(clip(before, "cl3"), clip(v, "cl3"), "the other episode is untouched");
        assertTrue(v.path("notice").path("message").asText().contains("片段 1 的分镜脚本已重写"));
        assertTrue(v.path("notice").path("message").asText().contains("历史版本"));
    }

    @Test
    void rewritingTheWholeEpisodeKeepsTheClipSplitAndLeavesOtherEpisodesAlone() throws Exception {
        JsonNode before = service.get(USER, "DW-1");
        reshoot("ep1");
        ObjectNode meta = lastMeta();
        assertEquals(List.of("cl1", "cl2"), om.convertValue(meta.path("rewriteIds"), List.class));
        verify(textRuns).submitDirectorText(any(), any(), eq("reshoot:ep1"), any(), any(), anyInt(), any(), any(), any(), any(), any());

        BusinessException missing = assertThrows(BusinessException.class, () -> DirectorPrompts.validate(om, meta, modelOutput(List.of("cl1"))));
        assertTrue(missing.getMessage().contains("漏写"));

        JsonNode v = finish("IPR-1", "reshoot:ep1", meta, modelOutput(List.of("cl1", "cl2", "cl3")));
        assertEquals("新标题 cl1", clip(v, "cl1").path("title").asText());
        assertEquals("新标题 cl2", clip(v, "cl2").path("title").asText());
        assertEquals(clip(before, "cl3"), clip(v, "cl3"), "a clip outside the episode in the model output is ignored");
        assertEquals(3, v.path("clips").size());
        assertTrue(v.path("notice").path("message").asText().contains("第 1 集 2 个片段的分镜脚本已重写"));
    }

    @Test
    void aClipEditedDuringTheRewriteKeepsTheUsersVersionUntilTheyChoose() throws Exception {
        reshoot("ep1", "cl2");
        ObjectNode meta = lastMeta();
        service.edit(USER, "DW-1", new DirectorService.EditRequest("clip.update", "cl2", 1L, om.readTree("{\"title\":\"我改的\"}")));
        JsonNode v = finish("IPR-1", "reshoot:cl2", meta, modelOutput(List.of("cl2")));
        assertEquals("我改的", clip(v, "cl2").path("title").asText());
        assertEquals("新标题 cl2", clip(v, "cl2").path("pendingShots").path("title").asText());
        assertTrue(v.path("notice").path("message").asText().contains("没有覆盖"));

        v = service.edit(USER, "DW-1", new DirectorService.EditRequest("clip.usePendingShots", "cl2", null, om.createObjectNode()));
        assertEquals("新标题 cl2", clip(v, "cl2").path("title").asText());
        assertTrue(clip(v, "cl2").path("pendingShots").isNull());
    }

    @Test
    void discardingThePendingVersionKeepsTheClip() throws Exception {
        reshoot("ep1", "cl2");
        ObjectNode meta = lastMeta();
        service.edit(USER, "DW-1", new DirectorService.EditRequest("clip.update", "cl2", 1L, om.readTree("{\"title\":\"我改的\"}")));
        finish("IPR-1", "reshoot:cl2", meta, modelOutput(List.of("cl2")));
        JsonNode v = service.edit(USER, "DW-1", new DirectorService.EditRequest("clip.discardPendingShots", "cl2", null, om.createObjectNode()));
        assertEquals("我改的", clip(v, "cl2").path("title").asText());
        assertTrue(clip(v, "cl2").path("pendingShots").isNull());
    }

    @Test
    void anEditedEpisodeTextDropsTheResult() throws Exception {
        reshoot("ep1", "cl2");
        ObjectNode meta = lastMeta();
        service.edit(USER, "DW-1", new DirectorService.EditRequest("episode.update", "ep1", 1L, om.readTree("{\"content\":\"改过的正文\"}")));
        JsonNode v = finish("IPR-1", "reshoot:cl2", meta, modelOutput(List.of("cl2")));
        assertEquals("离开", clip(v, "cl2").path("title").asText());
        assertTrue(v.path("notice").path("message").asText().contains("正文有修改"));
    }

    @Test
    void overlappingWritesAreRefusedWithAReason() {
        running("reshoot:cl1");
        BusinessException sameClip = assertThrows(BusinessException.class, () -> reshoot("ep1", "cl1"));
        assertEquals("DIRECTOR_TASK_RUNNING", sameClip.getCode());
        BusinessException whole = assertThrows(BusinessException.class, () -> reshoot("ep1"));
        assertEquals("DIRECTOR_TASK_RUNNING", whole.getCode());
        assertDoesNotThrow(() -> reshoot("ep1", "cl2"), "another clip of the same episode can be rewritten at the same time");
        assertDoesNotThrow(() -> reshoot("ep2"), "another episode is independent");

        stored.clear();
        running("plan:ep1");
        BusinessException planning = assertThrows(BusinessException.class, () -> reshoot("ep1", "cl2"));
        assertTrue(planning.getMessage().contains("正在写分镜脚本"));

        stored.clear();
        running("board:cl1");
        BusinessException boarding = assertThrows(BusinessException.class, () -> reshoot("ep1", "cl1"));
        assertTrue(boarding.getMessage().contains("分镜图正在生成"));
    }

    @Test
    void anEpisodeWithoutClipsAsksForAStoryboardFirst() throws Exception {
        service.edit(USER, "DW-1", new DirectorService.EditRequest("clip.delete", "cl3", null, om.createObjectNode()));
        BusinessException e = assertThrows(BusinessException.class, () -> reshoot("ep2"));
        assertEquals("DIRECTOR_CLIPS_MISSING", e.getCode());
        BusinessException other = assertThrows(BusinessException.class, () -> reshoot("ep2", "cl1"));
        assertEquals("DIRECTOR_CLIPS_MISSING", other.getCode());
    }

    @Test
    void oneClickStoryboardWithNothingLeftSaysWhyInsteadOfFinishingSilently() {
        BusinessException e = assertThrows(BusinessException.class, () ->
                service.pipeline(USER, "DW-1", new DirectorService.PipelineRequest("start", "work", null, "plan", 100L, null, true)));
        assertEquals("DIRECTOR_PIPELINE_NOTHING_TO_DO", e.getCode());
        assertTrue(e.getMessage().contains("全部 2 集的分镜脚本都已写好"));
        assertTrue(e.getMessage().contains("重写分镜脚本"));
        verify(textRuns, never()).submitDirectorText(any(), any(), any(), any(), any(), anyInt(), any(), any(), any(), any(), any());

        BusinessException one = assertThrows(BusinessException.class, () ->
                service.pipeline(USER, "DW-1", new DirectorService.PipelineRequest("start", "episode", "ep2", "plan", 100L, null, true)));
        assertTrue(one.getMessage().startsWith("第 2 集的分镜脚本都已写好"));
    }

    @Test
    void oneClickStoryboardStillWritesEpisodesThatHaveNoClips() throws Exception {
        service.edit(USER, "DW-1", new DirectorService.EditRequest("clip.delete", "cl3", null, om.createObjectNode()));
        JsonNode v = service.pipeline(USER, "DW-1", new DirectorService.PipelineRequest("start", "work", null, "plan", 100L, null, true));
        assertEquals("running", v.path("pipeline").path("status").asText());
        verify(textRuns).submitDirectorText(any(), any(), eq("plan:ep2"), any(), any(), anyInt(), any(), any(), any(), any(), any());
    }

    @Test
    void theReshootPromptKeepsTheSplitAndTheFrameVariantDoesNotAskToSplit() {
        String multi = DirectorPrompts.reshoot(5, 15, 4);
        assertTrue(multi.contains("rewriteIds") && multi.contains("不合并、不拆分") && multi.contains("\"id\":\"片段 id\""));
        assertTrue(multi.contains("单片段镜头数"), "same hard limits as writing a storyboard");
        String frame = DirectorPrompts.reshoot(4, 4, 1);
        assertFalse(frame.contains("复杂动作拆成多个片段"));
        assertTrue(DirectorPrompts.plan(4, 4, 1).contains("复杂动作拆成多个片段"));
    }
}
