package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * H3 片段视频：用户看中文，提交前按官方 skill 改写成英文，台词由代码填；报价只含视频，改写按实际用量另扣。
 * 片段照线上《敦煌飞仙》「通道对话」：两人、两镜、第 2 镜三句台词。
 */
class DirectorH3VideoFlowTest {
    private final ObjectMapper om = new ObjectMapper();
    private IpRunRepository runs;
    private IpRunService imageRuns;
    private StudioWorkflowService textRuns;
    private StudioVideoService videoModels;
    private DirectorService service;
    private DirectorWork w;
    private ObjectNode c;

    @BeforeEach
    void setUp() throws Exception {
        runs = mock(IpRunRepository.class);
        imageRuns = mock(IpRunService.class);
        textRuns = mock(StudioWorkflowService.class);
        videoModels = mock(StudioVideoService.class);
        StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
        MaterialVideoJobService videoJobs = mock(MaterialVideoJobService.class);
        service = new DirectorService(null, runs, null, imageRuns, textRuns, null, videoModels, fixtures, null, videoJobs, null,
                mock(AiAppSceneModelPolicyService.class), null, null, null, om, mock(PlatformTransactionManager.class));
        h3(true);
        when(videoModels.quote(eq("u1"), any())).thenReturn(600L);
        when(textRuns.directorTextPrice(any(), anyInt())).thenReturn(5L);
        when(textRuns.directorPrices(any())).thenReturn(new long[]{3, 8});
        when(textRuns.submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), any(), any(), any(), any()))
                .thenReturn(new IpRunDto("IPR-rw", "DW-1", "videoPrompt:cl1", "studio-director", "running", "queued", 0, 5, null, null, null, null, "t", null, null));
        when(imageRuns.generateVideoForDirector(anyString(), anyString(), anyString(), any()))
                .thenReturn(om.createObjectNode().put("id", "mvj_1").put("stage", "queued").put("progress_pct", 0));
        when(videoJobs.getJob(any(), any(), any())).thenReturn(om.createObjectNode().put("status", "queued").put("stage", "排队中"));
        w = new DirectorWork();
        w.setId("DW-1");
        w.setOwnerUserId("u1");
        c = (ObjectNode) om.readTree("""
                {"settings":{"style":"真人写实","aspectRatio":"9:16","language":"中文"},"applied":[],"taskMeta":{},
                 "assets":[
                  {"id":"as4","kind":"character","name":"陈默","description":"25-30岁男性，瘦削。","image":{"candidates":[{"id":"m1","key":"k/chen.png","source":"generated"}],"adoptedId":"m1","adoptedBy":"user"}},
                  {"id":"as5","kind":"character","name":"老赵","description":"50-60岁男性，安保人员。","image":{"candidates":[{"id":"m2","key":"k/zhao.png","source":"generated"}],"adoptedId":"m2","adoptedBy":"user"}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"通道对话","durationSec":12,"assetIds":["as4","as5"],
                  "shots":[
                   {"durationSec":5,"size":"全景","camera":"固定机位","still":"陈默走出洞窟","action":"陈默提着饼干盒走向通道尽头","dialogue":[]},
                   {"durationSec":7,"size":"中景","camera":"越过陈默肩膀拍老赵","still":"老赵掐灭烟头","action":"老赵盯着陈默","dialogue":[
                     {"speakerId":"as5","text":"又熬通宵？小陈啊，你这身子骨，再这么干下去，怕是要先于壁画塌了。"},
                     {"speakerId":"as4","text":"赵叔，我这人吧，就是闲不住。看见那墙上有灰，心里就难受。"},
                     {"speakerId":"as5","text":"难受？那你昨晚听见啥动静没？"}]}],
                  "board":{"candidates":[{"id":"b1","key":"k/board.png","source":"generated"}],"adoptedId":"b1","adoptedBy":"user"},
                  "video":{"candidates":[],"adoptedId":null,"pending":[]}}]}""");
        service.refresh(c);
    }

    private void h3(boolean optimizable) {
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)),
                List.of(new VideoStudioTier("768p", List.of(new VideoStudioCanvas("9:16", 768, 1344)))), 4, 15, 7000, 0L);
        when(videoModels.models()).thenReturn(List.of(new VideoStudioModel("ep-h3", "MiniMax H3", true, true, optimizable, contract, null)));
    }

    private ObjectNode clip() { return (ObjectNode) c.path("clips").get(0); }

    /** 模型按约定写回的 JSON：每句台词只留占位。 */
    private ObjectNode modelOutput() {
        ObjectNode o = om.createObjectNode().put("subject_definitions", "<Subject 1> is Chen Mo in <Picture 2>. <Subject 2> is Lao Zhao in <Picture 3>.")
                .put("summary", "[reference generation] Two men talk in a sandy corridor.").put("retention_analysis", "<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - face.")
                .put("style", "Live-action, cinematic.").put("overall_soundscape", "Wind blows sand along the corridor.").put("non_diegetic_music", "N/A");
        ArrayNode shots = o.putArray("shots");
        shots.add("A static wide shot as <Subject 1> walks out of the cave carrying a tin box.");
        shots.add("the camera cuts to <Subject 2> over the shoulder of <Subject 1>. <Subject 2> says in a rough voice: {{L1}} <Subject 1> replies quietly: {{L2}} <Subject 2> asks: {{L3}}");
        return o;
    }

    /** 让改写任务「完成」：worker 里校验组装后的输出，原样交给 reconcile 回投。 */
    private void finishRewrite(JsonNode meta) throws Exception {
        ObjectNode input = om.createObjectNode();
        input.set("_director", meta);
        ObjectNode output = om.createObjectNode();
        output.set("director", DirectorPrompts.validate(om, meta, modelOutput()));
        IpRun run = IpRun.builder().id("IPR-rw").projectId("DW-1").hostType(IpRun.HOST_DIRECTOR).ownerUserId("u1").nodeId("videoPrompt:cl1")
                .kind("studio-director").status(IpRun.STATUS_DONE).stage("done").inputJson(om.writeValueAsString(input))
                .outputJson(om.writeValueAsString(output)).createdAt(Instant.now()).build();
        when(runs.findByProjectIdOrderByCreatedAtDesc("DW-1")).thenReturn(List.of(run));
        service.reconcile(w, c);
    }

    private ObjectNode dispatchRewrite() {
        assertEquals("IPR-rw", service.dispatch("u1", w, c, "video", "cl1", "u-r1", om.createObjectNode(), null, null, 600L));
        ArgumentCaptor<String> user = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<ObjectNode> meta = ArgumentCaptor.forClass(ObjectNode.class);
        verify(textRuns).submitDirectorText(eq("u1"), eq("DW-1"), eq("videoPrompt:cl1"), anyString(), user.capture(), eq(DirectorH3Rewrite.MAX_TOKENS),
                eq("u-r1-p"), meta.capture(), any(), any(), eq(5L));
        assertTrue(user.getValue().contains("老赵说：{{L1}}陈默说：{{L2}}老赵说：{{L3}}"), user.getValue());
        assertFalse(user.getValue().contains("又熬通宵"), "台词原文不交给改写模型");
        return meta.getValue();
    }

    @Test
    void quoteIsTheVideoOnlyAndTheClipSaysARewriteWillHappen() {
        assertEquals("needed", clip().path("videoPromptRewrite").asText());
        assertEquals(600L, service.videoQuote("u1", c, clip()), "改写不进报价，按实际用量另扣");
    }

    @Test
    void videoWaitsForTheRewriteThenGoesOutInEnglishWithTheConfirmedPrice() throws Exception {
        ObjectNode meta = dispatchRewrite();
        verify(imageRuns, never()).generateVideoForDirector(any(), any(), any(), any());
        assertEquals(600L, meta.path("then").path("maxCost").asLong(), "视频的价格上限就是用户确认的报价");
        assertEquals(3, meta.path("lines").size());

        finishRewrite(meta);
        ArgumentCaptor<IpRunService.IpVideoRequest> req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        verify(imageRuns).generateVideoForDirector(eq("u1"), eq("DW-1"), eq("video:cl1"), req.capture());
        String sent = req.getValue().prompt();
        assertTrue(sent.startsWith("subject_definitions:\n"), sent);
        assertTrue(sent.contains("[Shot 2] At 00:05.000, the camera cuts to"), sent);
        assertTrue(sent.contains("(S1) <d>[Chinese] 又熬通宵？小陈啊，你这身子骨，再这么干下去，怕是要先于壁画塌了。</d>"), sent);
        assertTrue(sent.contains("(S2) <d>[Chinese] 赵叔，我这人吧，就是闲不住。看见那墙上有灰，心里就难受。</d>"), sent);
        assertEquals(600L, req.getValue().maxCost());
        assertEquals("u-r1", req.getValue().clientRequestId());
        assertEquals("ready", clip().path("videoPromptRewrite").asText());
        assertEquals(sent, clip().path("videoPromptEn").path("text").asText());
        assertEquals(1, clip().path("video").path("pending").size());
        // 候选上记中文（核对是否过期用）和实际发出的英文
        JsonNode pendingMeta = clip().path("video").path("pending").get(0).path("meta");
        assertTrue(pendingMeta.path("prompt").asText().contains("【画面】"));
        assertEquals(sent, pendingMeta.path("sentPrompt").asText());
    }

    @Test
    void readyEnglishIsReusedWithoutAnotherRewrite() throws Exception {
        ObjectNode meta = dispatchRewrite();
        ((ObjectNode) meta.path("then")).put("pipelineId", "PL-gone"); // 一键制作已结束：只存英文稿，不接着提交
        finishRewrite(meta);
        verify(imageRuns, never()).generateVideoForDirector(any(), any(), any(), any());
        assertEquals("ready", clip().path("videoPromptRewrite").asText());

        service.dispatch("u1", w, c, "video", "cl1", "u-r2", om.createObjectNode(), null, null, 600L);
        verify(textRuns, times(1)).submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), any(), any(), any(), any());
        ArgumentCaptor<IpRunService.IpVideoRequest> req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        verify(imageRuns).generateVideoForDirector(eq("u1"), eq("DW-1"), eq("video:cl1"), req.capture());
        assertEquals(clip().path("videoPromptEn").path("text").asText(), req.getValue().prompt());
    }

    @Test
    void anEditToTheShotsDuringTheRewriteStopsTheVideo() throws Exception {
        ObjectNode meta = dispatchRewrite();
        ((ObjectNode) clip().path("shots").get(1)).put("camera", "正面拍老赵，镜头缓慢推近");
        service.refresh(c);
        finishRewrite(meta);
        verify(imageRuns, never()).generateVideoForDirector(any(), any(), any(), any());
        assertTrue(clip().path("video").path("error").path("message").asText().contains("改写期间有改动"), clip().path("video").toString());
        assertEquals("needed", clip().path("videoPromptRewrite").asText(), "画面改了要重新改写");
    }

    @Test
    void aDialogueOnlyEditKeepsTheRewriteAndSendsTheNewWords() throws Exception {
        ObjectNode meta = dispatchRewrite();
        ((ObjectNode) clip().path("shots").get(1).path("dialogue").get(2)).put("text", "昨晚你听见什么没有？");
        service.refresh(c);
        finishRewrite(meta);
        ArgumentCaptor<IpRunService.IpVideoRequest> req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        verify(imageRuns).generateVideoForDirector(eq("u1"), eq("DW-1"), eq("video:cl1"), req.capture());
        assertTrue(req.getValue().prompt().contains("(S1) <d>[Chinese] 昨晚你听见什么没有？</d>"), "台词按提交时的文字填：" + req.getValue().prompt());
        assertFalse(req.getValue().prompt().contains("那你昨晚听见啥动静没"));
        verify(textRuns, times(1)).submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), any(), any(), any(), any());
    }

    /** 改写任务没通过校验（这一次不扣费）：worker 判失败，回投时看到的就是这样一条任务。 */
    private void failRewrite(JsonNode meta, String id) throws Exception {
        ObjectNode input = om.createObjectNode();
        input.set("_director", meta);
        IpRun run = IpRun.builder().id(id).projectId("DW-1").hostType(IpRun.HOST_DIRECTOR).ownerUserId("u1").nodeId("videoPrompt:cl1")
                .kind("studio-director").status(IpRun.STATUS_FAILED).stage("failed").errorCode("AI_BAD_OUTPUT")
                .errorMessage("视频提示词改写不合格（改写稿缺少第 2 镜），本次未扣积分，请重试").clientRequestId("u-r1-p")
                .inputJson(om.writeValueAsString(input)).outputJson("{}").createdAt(Instant.now()).build();
        when(runs.findByProjectIdOrderByCreatedAtDesc("DW-1")).thenReturn(List.of(run));
        service.reconcile(w, c);
    }

    @Test
    void aRewriteThatFailsValidationIsRetriedOnceQuietly() throws Exception {
        ObjectNode meta = dispatchRewrite();
        failRewrite(meta, "IPR-rw");
        ArgumentCaptor<ObjectNode> retryMeta = ArgumentCaptor.forClass(ObjectNode.class);
        verify(textRuns).submitDirectorText(eq("u1"), eq("DW-1"), eq("videoPrompt:cl1"), anyString(), anyString(), eq(DirectorH3Rewrite.MAX_TOKENS),
                eq("u-r1-p2"), retryMeta.capture(), any(), any(), eq(5L));
        assertEquals(2, retryMeta.getValue().path("attempt").asInt());
        assertEquals(600L, retryMeta.getValue().path("then").path("maxCost").asLong(), "重试后照样接着提交视频");
        assertTrue(clip().path("video").path("error").isNull() || clip().path("video").path("error").isMissingNode(), "第一次失败不打扰用户");

        failRewrite(retryMeta.getValue(), "IPR-rw2");
        verify(textRuns, times(2)).submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), any(), any(), any(), any());
        assertTrue(clip().path("video").path("error").path("message").asText().contains("改写不合格"), "第二次还不过才报错");
        verify(imageRuns, never()).generateVideoForDirector(any(), any(), any(), any());
    }

    @Test
    void customPromptWhoseLinesCannotBeFoundIsRefused() {
        clip().put("videoPrompt", "两个人在通道里聊天，老赵问他昨晚听见什么。").put("videoPromptCustom", true);
        service.refresh(c);
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.dispatch("u1", w, c, "video", "cl1", "u-r3", om.createObjectNode(), null, null, 600L));
        assertEquals("DIRECTOR_VIDEO_PROMPT_LINES", e.getCode());
        verify(textRuns, never()).submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), any(), any(), any(), any());
    }

    @Test
    void modelsOtherThanH3GetTheChinesePromptAsBefore() {
        h3(false);
        service.refresh(c);
        assertEquals("off", clip().path("videoPromptRewrite").asText());
        service.dispatch("u1", w, c, "video", "cl1", "u-r4", om.createObjectNode(), null, null, 600L);
        ArgumentCaptor<IpRunService.IpVideoRequest> req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        verify(imageRuns).generateVideoForDirector(eq("u1"), eq("DW-1"), eq("video:cl1"), req.capture());
        assertTrue(req.getValue().prompt().contains("【画面】"));
        verify(textRuns, never()).submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt(), anyString(), any(), any(), any(), any());
    }

    @Test
    void denseDialogueIsFlaggedOnTheClip() {
        String warnings = clip().path("warnings").toString();
        assertTrue(warnings.contains("第 2 镜 7 秒 62 字"), warnings);
        assertTrue(warnings.contains("第 2 镜有两个人说话"), warnings);
    }
}
