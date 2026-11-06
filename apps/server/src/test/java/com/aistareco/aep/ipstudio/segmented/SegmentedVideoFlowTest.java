package com.aistareco.aep.ipstudio.segmented;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.*;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.execution.*;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 一键到底：真的计划、真的连续制作推进和真的提示词，模型调用用假结果（docs/studio-segmented-video.md）。
 * 断言的是用户点一次之后的行为：提交顺序、分镜图不合格重出、失败重试、什么时候才停下来。
 */
class SegmentedVideoFlowTest {
    final ObjectMapper om = new ObjectMapper();
    IpPlanExecution row;
    final Map<String, IpRunDto> dtos = new HashMap<>();
    final Map<String, IpRun> byRequest = new HashMap<>();
    final List<RunRequest> submitted = new ArrayList<>();
    IpPlanExecutionRepository executions; IpRunRepository runRepository; IpProjectService projects; StudioWorkflowService workflow; StudioVideoService videos;
    StudioPlanExecutor executor; SegmentedVideoService service; StudioPlanExecutionService executionService;
    ObjectNode doc;
    StudioSegmentedRun segmented;
    int contractMin = 5, contractMax = 15;
    boolean vision = true;

    @BeforeEach void setUp() throws Exception {
        executions = mock(IpPlanExecutionRepository.class); runRepository = mock(IpRunRepository.class); projects = mock(IpProjectService.class);
        workflow = mock(StudioWorkflowService.class); videos = mock(StudioVideoService.class);
        when(executions.findById(anyString())).thenAnswer(i -> Optional.ofNullable(row));
        when(executions.lockById(anyString())).thenAnswer(i -> Optional.ofNullable(row));
        when(executions.save(any())).thenAnswer(i -> i.getArgument(0));
        when(executions.saveAndFlush(any())).thenAnswer(i -> { row = i.getArgument(0); return row; });
        when(executions.findByOwnerUserIdAndClientRequestId(anyString(), anyString())).thenAnswer(i -> Optional.ofNullable(row));
        when(executions.findByProjectIdAndStatusIn(anyString(), any())).thenReturn(List.of());
        when(executions.acquireLease(anyString(), anyString(), anyLong(), any(), any())).thenAnswer(i -> {
            row.setLeaseOwner(i.getArgument(1)); row.setLeaseUntil(i.getArgument(4)); row.setLeaseVersion(row.getLeaseVersion() + 1); return 1; });
        when(executions.renewLease(anyString(), anyString(), anyLong(), any())).thenReturn(1);
        when(executions.releaseLease(anyString(), anyString(), anyLong())).thenReturn(1);
        when(runRepository.findByProjectIdAndClientRequestId(anyString(), anyString())).thenAnswer(i -> Optional.ofNullable(byRequest.get((String) i.getArgument(1))));
        when(projects.ownedRun(eq("u"), eq("p"), anyString())).thenAnswer(i -> dtos.containsKey((String) i.getArgument(2))
                ? Optional.of(IpRun.builder().id(i.getArgument(2)).ownerUserId("u").projectId("p").build()) : Optional.empty());
        when(projects.toRunDto(any())).thenAnswer(i -> dtos.get(((IpRun) i.getArgument(0)).getId()));
        when(projects.required("u", "p")).thenReturn(IpProject.builder().id("p").build());
        when(projects.requiredForUpdate("u", "p")).thenReturn(IpProject.builder().id("p").build());
        doc = (ObjectNode) om.readTree("{\"nodes\":[{\"id\":\"n1\",\"type\":\"image\",\"title\":\"达人照片\",\"metadata\":{\"storageKey\":\"ipstudio/u/photo.png\"}}],\"connections\":[]}");
        when(projects.readDoc(any())).thenAnswer(i -> doc);
        when(projects.requireOwnedAssetKey(anyString(), anyString())).thenAnswer(i -> i.getArgument(1));
        when(workflow.quote(anyString(), any())).thenAnswer(i -> { RunRequest r = i.getArgument(1); return switch (r.operation()) {
            case "image" -> 8L; case "video" -> r.video().rewrite() == null ? 900L : 1010L; case "assemble" -> 0L; default -> 70L; }; });
        when(workflow.submit(eq("u"), eq("p"), any())).thenAnswer(i -> {
            RunRequest request = i.getArgument(2);
            submitted.add(request);
            String id = "IPR-" + submitted.size();
            byRequest.put(request.clientRequestId(), IpRun.builder().id(id).ownerUserId("u").projectId("p").clientRequestId(request.clientRequestId()).build());
            dtos.put(id, dto(id, "running", null, null));
            return dtos.get(id);
        });
        var model = new VideoStudioModel("ep-video", "视频模型", true, true, false, VideoStudioService.contract(5, 15), null);
        when(videos.models()).thenAnswer(i -> List.of(new VideoStudioModel("ep-video", "视频模型", true, true, model.supportsPromptOptimization(), VideoStudioService.contract(contractMin, contractMax), null)));
        @SuppressWarnings("unchecked") ObjectProvider<StudioVideoService> videoProvider = mock(ObjectProvider.class);
        when(videoProvider.getIfAvailable()).thenReturn(videos);
        var quoter = new StudioPlanQuoter(workflow, videoProvider);
        var outputs = new StudioPlanOutputs(runRepository, projects, om);
        var manager = mock(PlatformTransactionManager.class); when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueEvents> events = mock(ObjectProvider.class);
        executor = new StudioPlanExecutor(executions, runRepository, outputs, workflow, mock(IpRunService.class), projects, quoter, om, manager, events);
        @SuppressWarnings("unchecked") ObjectProvider<StudioSegmentedRun> runs = mock(ObjectProvider.class);
        var segmented = new StudioSegmentedRun(outputs, om);
        ReflectionTestUtils.setField(segmented, "retryDelay", java.time.Duration.ZERO);
        this.segmented = segmented;
        when(runs.getIfAvailable()).thenReturn(segmented); when(runs.getObject()).thenReturn(segmented);
        ReflectionTestUtils.setField(executor, "segmented", runs);

        var skills = mock(StudioSkillRules.class);
        var rules = new StudioSkillRules.Rules("video-generation", "出视频", 1, "active", Map.of("production", List.of("text", "image", "video", "check", "assemble")), 60, 8, "model", 28, 0,
                List.of("subject-consistency", "scene-and-action", "duration-and-order"), List.of(), List.of(), "正文", "digest");
        when(skills.requireActive(anyString())).thenReturn(rules);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanExecutor> executorProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanSource> sources = mock(ObjectProvider.class);
        executionService = new StudioPlanExecutionService(executions, projects, skills, outputs, executorProvider, sources, om);
        var policies = mock(AiAppSceneModelPolicyService.class);
        var imageEndpoint = endpoint("ep-image", false);
        when(policies.directorImageDefault()).thenReturn(Optional.empty());
        when(policies.resolve(eq("studio"), eq("image"), any(), anyLong())).thenReturn(new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(imageEndpoint, null, true), 8, "per_call"));
        when(policies.resolve(eq("studio"), eq("script"), any(), anyLong())).thenAnswer(i -> new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint("ep-text", vision), null, true), 8, "per_call"));
        var fixtures = mock(StudioFixtureProvider.class);
        service = new SegmentedVideoService(videos, policies, mock(DapPricingService.class), quoter, executionService, projects, skills, fixtures, mock(StudioSceneCatalog.class), om);
    }

    private AiModelEndpoint endpoint(String id, boolean sees) {
        var e = mock(AiModelEndpoint.class);
        when(e.getId()).thenReturn(id);
        when(e.publicModelName()).thenReturn(id);
        when(e.getModel()).thenReturn("m");
        when(e.getModelsJson()).thenReturn("[{\"id\":\"m\",\"supportsVision\":" + sees + "}]");
        return e;
    }

    IpRunDto dto(String id, String status, JsonNode output, String code) {
        return new IpRunDto(id, "p", "n", "studio", status, status, 0, 0, code, "failed".equals(status) ? "没做成" : null,
                om.createObjectNode(), output == null ? om.createObjectNode() : output, Instant.now().toString(), null, null);
    }

    private RunRequest last() { return submitted.get(submitted.size() - 1); }
    private String idOf(RunRequest r) { return byRequest.get(r.clientRequestId()).getId(); }
    private void finish(RunRequest r, JsonNode output) { dtos.put(idOf(r), dto(idOf(r), "done", output, null)); }
    private void fail(RunRequest r, String code) { dtos.put(idOf(r), dto(idOf(r), "failed", null, code)); }
    private JsonNode state() { try { return om.readTree(row.getStepsJson()); } catch (Exception e) { throw new IllegalStateException(e); } }
    private JsonNode step(String id) { for (JsonNode s : state().path("steps")) if (id.equals(s.path("id").asText())) return s; return null; }
    private List<String> nodes() { return submitted.stream().map(RunRequest::nodeId).toList(); }

    private ObjectNode script(int... shotsPerSegment) {
        ObjectNode out = om.createObjectNode().put("title", "探店").put("summary", "一句话").put("style", "真人写实");
        out.putArray("assets").addObject().put("name", "小夏").put("kind", "character").put("ref", "图1").put("description", "短发").put("voice", "年轻女声");
        out.withArray("assets").addObject().put("name", "老板").put("kind", "character").put("description", "五十多岁，围裙").put("voice", "低沉男声");
        var segments = out.putArray("segments");
        int no = 0;
        for (int count : shotsPerSegment) {
            var segment = segments.addObject().put("no", ++no).put("title", "段" + no).put("summary", "s").put("durationSec", 15);
            var shots = segment.putArray("shots");
            for (int i = 0; i < count; i++) {
                var shot = shots.addObject().put("durationSec", 15.0 / count).put("size", "近景").put("camera", "固定机位").put("still", "第" + no + "段第" + (i + 1) + "镜画面").put("action", "咬一口");
                shot.putArray("dialogue").addObject().put("speakerId", i == 0 ? "老板" : "小夏").put("text", "好吃");
            }
        }
        return out;
    }
    private JsonNode textOutput(JsonNode script) { ObjectNode out = om.createObjectNode(); out.set("segmented", script); return out; }
    private JsonNode imageOutput(String key) { ObjectNode out = om.createObjectNode(); out.putArray("candidates").addObject().put("key", key); return out; }
    private JsonNode videoOutput(String key) { ObjectNode out = om.createObjectNode().put("storageKey", key); out.putArray("videoCandidates").addObject().put("index", 0).put("status", "done").put("storageKey", key); return out; }
    private JsonNode checkOutput(String status, String suggestion) {
        ObjectNode out = om.createObjectNode();
        var check = out.putObject("check").put("status", status);
        check.putArray("items").addObject().put("id", "scene-and-action").put("status", status).put("reason", "对不上").put("suggestion", suggestion);
        return out;
    }

    private void start(int seconds) {
        long cap = service.price("u", null, null, seconds, "9:16", 0, true, false, true).cap();
        service.start("u", "p", new SegmentedVideoRequest("req1", "ecom-talking", "探店锅盔", false, null, "中文", seconds, "9:16", null, null, true,
                List.of(new SegmentedMaterial("n1", "达人照片", "character")), cap, null));
        executor.advance(row.getId());
    }

    @Test void priceSaysHowManySegmentsAndAllowsThreeAttemptsInTheCap() {
        var price = service.price("u", null, null, 46, "9:16", 0, false, false, true);
        assertEquals(List.of(15, 15, 11, 5), price.segments());
        assertEquals(4, price.boards());
        assertEquals(3600, price.videoCost());
        assertEquals(32, price.boardCost());
        // 脚本 + 审核 + 4 次检查按文字上限；上限再加每张分镜图和检查各一次。
        assertEquals(3600 + 32 + 70 * 6, price.estimated());
        assertEquals(price.estimated() * 3, price.cap());
    }

    @Test void theVideoPriceDoesNotCountThePromptRewriteTwice() {
        when(videos.models()).thenReturn(List.of(new VideoStudioModel("ep-video", "视频模型", true, true, true, VideoStudioService.contract(5, 15), null)));
        var price = service.price("u", null, null, 30, "9:16", 0, false, false, true);
        assertEquals(1800, price.videoCost());
        // 改写的冻结上限（每段 110）算在文字那边：脚本 + 审核 + 2 次检查 + 2 次改写。
        assertEquals(70 * 4 + 110 * 2, price.textCost());
        assertEquals(1800 + 16 + 500, price.estimated());
    }

    @Test void aStaleCapIsRefusedBeforeAnythingStarts() {
        var e = assertThrows(BusinessException.class, () -> service.start("u", "p", new SegmentedVideoRequest("req1", "s", "x", false, null, null, 46, "9:16", null, null, true, List.of(), 1L, null)));
        assertEquals("STUDIO_PRICE_CHANGED", e.getCode());
        assertNull(row);
    }

    @Test void aMaterialNoLongerOnTheCanvasIsRefused() {
        var e = assertThrows(BusinessException.class, () -> service.start("u", "p", new SegmentedVideoRequest("req1", "s", "x", false, null, null, 46, "9:16", null, null, true,
                List.of(new SegmentedMaterial("gone", "旧图", "image")), 99999L, null)));
        assertEquals("STUDIO_INPUT_INVALID", e.getCode());
    }

    @Test void oneClickRunsScriptReviewBoardsVideosAndAssembles() throws Exception {
        start(30);
        String id = row.getId();
        assertEquals(1, submitted.size());
        RunRequest script = last();
        assertEquals("text", script.operation());
        assertEquals("script", script.segmented().kind());
        assertEquals(Boolean.TRUE, script.readVisuals());
        assertEquals(List.of(15, 15), script.segmented().segments().stream().map(SegmentedPlan.Segment::seconds).toList());

        // 脚本写完 → 审核：拿到原稿和程序查出的问题，不看图
        finish(script, textOutput(script(1, 4)));
        executor.advance(id);
        RunRequest review = last();
        assertEquals("review", review.segmented().kind());
        assertNull(review.readVisuals());
        assertTrue(review.textEdit().content().contains("第1段第1镜画面"));
        assertTrue(review.segmented().issues().stream().anyMatch(i -> i.contains("第 1 段只有 1 个镜头")), review.segmented().issues().toString());

        // 审核改好 → 第一张分镜图：用审过的这一版，没有参考图的人写外观，有参考图的不写
        finish(review, textOutput(script(4, 4)));
        executor.advance(id);
        RunRequest board1 = last();
        assertEquals("image", board1.operation());
        assertTrue(board1.prompt().contains("第1段第4镜画面"), board1.prompt());
        assertTrue(board1.prompt().contains("老板：五十多岁，围裙"), board1.prompt());
        assertFalse(board1.prompt().contains("小夏：短发"), board1.prompt());
        assertEquals("ipstudio/u/photo.png", board1.references().get(0).storageKey());

        // 第一张查过之前，别的分镜图不开始：它们要照它保持一致
        finish(board1, imageOutput("gen/b1.png"));
        executor.advance(id);
        RunRequest check1 = last();
        assertEquals("check", check1.operation());
        assertTrue(check1.prompt().contains("第1段第4镜画面"), check1.prompt());
        assertEquals(4, submitted.size());

        // 不合格 → 自动重出一次，带上问题，再查
        finish(check1, checkOutput("fail", "第三格多了一只手"));
        executor.advance(id);
        RunRequest redo = last();
        assertEquals(board1.nodeId(), redo.nodeId());
        assertNotEquals(board1.clientRequestId(), redo.clientRequestId());
        assertTrue(redo.prompt().contains("第三格多了一只手"), redo.prompt());
        finish(redo, imageOutput("gen/b1v2.png"));
        executor.advance(id);
        RunRequest check1Again = last();
        assertEquals("check", check1Again.operation());

        // 还是不合格：不再重出，接着做。第二张分镜图参考第一张（重出的那张）
        finish(check1Again, checkOutput("fail", "还是多了"));
        executor.advance(id);
        assertEquals(IpPlanExecution.RUNNING, row.getStatus());
        RunRequest board2 = last();
        assertEquals("image", board2.operation());
        assertEquals("gen/b1v2.png", board2.references().get(board2.references().size() - 1).storageKey());
        assertTrue(board2.prompt().contains("是这条视频前面的分镜"), board2.prompt());

        finish(board2, imageOutput("gen/b2.png"));
        executor.advance(id);
        RunRequest check2 = last();
        finish(check2, checkOutput("unknown", ""));  // 判断不了也接着做
        executor.advance(id);

        // 两段视频一起开始：分镜图做图1，素材排在后面，提示词写的编号对得上
        List<RunRequest> clips = submitted.stream().filter(r -> "video".equals(r.operation())).toList();
        assertEquals(2, clips.size(), nodes().toString());
        RunRequest clip1 = clips.get(0);
        assertEquals("gen/b1v2.png", clip1.video().references().get(0).key());
        assertEquals("ipstudio/u/photo.png", clip1.video().references().get(1).key());
        assertEquals(15, clip1.durationSec());
        assertEquals("ep-video", clip1.model());
        assertTrue(clip1.prompt().contains("参考图1 是 2×2 分镜"), clip1.prompt());
        assertTrue(clip1.prompt().contains("小夏：长相、发型和衣服照参考图2"), clip1.prompt());
        assertTrue(clip1.prompt().contains("老板的音色：低沉男声"), clip1.prompt());

        // 合成：按段序，没有两段都好不开始
        finish(clips.get(0), videoOutput("gen/v1.mp4"));
        executor.advance(id);
        assertTrue(submitted.stream().noneMatch(r -> "assemble".equals(r.operation())));
        finish(clips.get(1), videoOutput("gen/v2.mp4"));
        executor.advance(id);
        RunRequest film = last();
        assertEquals("assemble", film.operation());
        assertEquals(List.of("gen/v1.mp4", "gen/v2.mp4"), film.references().stream().map(r -> r.storageKey()).toList());
        assertEquals("9:16", film.aspectRatio());
        finish(film, om.createObjectNode().put("storageKey", "gen/film.mp4"));
        executor.advance(id);
        assertEquals(IpPlanExecution.DONE, row.getStatus());
    }

    @Test void aFailedReviewFallsBackToTheOriginalScriptAfterThreeAttempts() {
        start(30);
        String id = row.getId();
        finish(last(), textOutput(script(4, 4)));
        executor.advance(id);
        RunRequest review = last();
        fail(review, "AI_BAD_OUTPUT");
        executor.advance(id);
        RunRequest retry = last();
        assertEquals(review.nodeId(), retry.nodeId());
        assertNotEquals(review.clientRequestId(), retry.clientRequestId());
        fail(retry, "AI_CALL_FAILED");
        executor.advance(id);
        assertEquals("text", last().operation());
        fail(last(), "AI_CALL_FAILED");
        executor.advance(id);
        assertEquals(IpPlanExecution.RUNNING, row.getStatus());
        assertEquals("image", last().operation());
        assertTrue(last().prompt().contains("第1段第1镜画面"));
        assertTrue(step("review").path("softSkipped").asBoolean());
    }

    @Test void aRetryWaitsBeforeTryingAgainSoItDoesNotHitTheSameRateLimit() {
        ReflectionTestUtils.setField(segmented, "retryDelay", java.time.Duration.ofMinutes(5));
        start(30);
        fail(last(), "AI_CALL_FAILED");
        executor.advance(row.getId());
        assertEquals(1, submitted.size());
        assertEquals("pending", step("script").path("status").asText());
        assertEquals(IpPlanExecution.RUNNING, row.getStatus());
        ReflectionTestUtils.setField(segmented, "retryDelay", java.time.Duration.ZERO);
        var state = (ObjectNode) state();
        state.path("steps").forEach(s -> { if ("script".equals(s.path("id").asText())) ((ObjectNode) s).put("notBefore", Instant.now().minusSeconds(1).toString()); });
        row.setStepsJson(state.toString());
        executor.advance(row.getId());
        assertEquals(2, submitted.size());
    }

    @Test void aVideoThatFailsTriesThreeTimesThenWaitsWithoutAssemblingMissingSegments() {
        vision = false;
        start(30);
        String id = row.getId();
        finish(last(), textOutput(script(4, 4)));
        executor.advance(id);
        finish(last(), textOutput(script(4, 4)));
        executor.advance(id);
        finish(last(), imageOutput("gen/b1.png"));
        executor.advance(id);
        finish(last(), imageOutput("gen/b2.png"));
        executor.advance(id);
        List<RunRequest> clips = submitted.stream().filter(r -> "video".equals(r.operation())).toList();
        assertEquals(2, clips.size());
        finish(clips.get(0), videoOutput("gen/v1.mp4"));
        fail(clips.get(1), "STUDIO_VIDEO_FAILED");
        executor.advance(id);
        RunRequest retry = last();
        assertEquals("video", retry.operation());
        assertEquals(clips.get(1).nodeId(), retry.nodeId());
        fail(retry, "STUDIO_VIDEO_FAILED");
        executor.advance(id);
        assertEquals("video", last().operation());
        assertNotEquals(retry.clientRequestId(), last().clientRequestId());
        fail(last(), "STUDIO_VIDEO_FAILED");
        executor.advance(id);
        assertEquals(IpPlanExecution.NEEDS_USER, row.getStatus());
        assertTrue(submitted.stream().noneMatch(r -> "assemble".equals(r.operation())));
        assertEquals("done", step("v1").path("status").asText());
    }

    @Test void aModelThatCannotSeeSkipsBoardReviewAndTheVideoStillUsesTheBoards() {
        vision = false;
        var price = service.price("u", null, null, 30, "9:16", 0, false, false, true);
        assertFalse(price.boardReview());
        assertEquals(price.estimated() * 3, price.cap());
    }

    @Test void refusedForGoodDoesNotRetry() {
        start(30);
        RunRequest script = last();
        fail(script, StudioPaymentMessage.CODE);
        executor.advance(row.getId());
        assertEquals(1, submitted.size());
        assertEquals(IpPlanExecution.NEEDS_USER, row.getStatus());
    }

    @Test void aThirtySecondSegmentUsesTwoBoardsWhenItHasMoreThanFourShots() {
        contractMin = 4; contractMax = 30;
        vision = false;
        start(60);
        String id = row.getId();
        ObjectNode longScript = script(6, 3);
        longScript.withArray("segments").forEach(s -> ((ObjectNode) s).put("durationSec", 30));
        finish(last(), textOutput(longScript));
        executor.advance(id);
        finish(last(), textOutput(longScript));
        executor.advance(id);
        RunRequest first = last();
        assertTrue(first.prompt().contains("第1段第4镜画面"), first.prompt());
        assertFalse(first.prompt().contains("第1段第5镜画面"), first.prompt());
        finish(first, imageOutput("gen/b1.png"));
        executor.advance(id);
        // 第 1 段后半和第 2 段前半都开始了；第 2 段只有 3 镜，后半那张用不上
        assertEquals("skipped", step("b2x").path("status").asText());
        RunRequest second = submitted.stream().filter(r -> r.nodeId().endsWith("-b1x")).findFirst().orElseThrow();
        assertTrue(second.prompt().contains("第1段第5镜画面"), second.prompt());
        RunRequest board2 = submitted.stream().filter(r -> r.nodeId().endsWith("-b2")).findFirst().orElseThrow();
        finish(second, imageOutput("gen/b1x.png"));
        finish(board2, imageOutput("gen/b2.png"));
        executor.advance(id);
        List<RunRequest> clips = submitted.stream().filter(r -> "video".equals(r.operation())).toList();
        assertEquals(2, clips.size());
        RunRequest clip1 = clips.get(0), clip2 = clips.get(1);
        assertEquals(30, clip1.durationSec());
        assertEquals("gen/b1.png", clip1.video().references().get(0).key());
        assertEquals("gen/b1x.png", clip1.video().references().get(1).key());
        assertTrue(clip1.prompt().contains("参考图2 是 2×2 分镜"), clip1.prompt());
        assertTrue(clip1.prompt().contains("对应第6镜"), clip1.prompt());
        assertTrue(clip1.prompt().contains("小夏：长相、发型和衣服照参考图3"), clip1.prompt());
        // 第 2 段只交一张分镜图，素材编号跟着往前
        assertEquals("gen/b2.png", clip2.video().references().get(0).key());
        assertEquals("ipstudio/u/photo.png", clip2.video().references().get(1).key());
        assertTrue(clip2.prompt().contains("小夏：长相、发型和衣服照参考图2"), clip2.prompt());
        assertFalse(clip2.prompt().contains("参考图2 是 2×2 分镜"), clip2.prompt());
    }

    @Test void theSameRequestIdAgainReturnsTheSameExecution() {
        start(30);
        String id = row.getId();
        long cap = service.price("u", null, null, 30, "9:16", 0, true, false, true).cap();
        var again = service.start("u", "p", new SegmentedVideoRequest("req1", "ecom-talking", "探店锅盔", false, null, "中文", 30, "9:16", null, null, true,
                List.of(new SegmentedMaterial("n1", "达人照片", "character")), cap + 500, null));
        assertEquals(id, again.id());
        var changed = assertThrows(BusinessException.class, () -> service.start("u", "p", new SegmentedVideoRequest("req1", "ecom-talking", "换了要求", false, null, "中文", 30, "9:16", null, null, true,
                List.of(new SegmentedMaterial("n1", "达人照片", "character")), cap + 500, null)));
        assertEquals("STUDIO_REQUEST_CHANGED", changed.getCode());
    }
}
