package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.ipstudio.h3.H3PromptRewrite;
import com.aistareco.aep.ipstudio.h3.H3StudioPrompt;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Studio 画布 / 创作助手出 H3 视频前的智能优化（2026-10-27）：后台先按官方写法改写，没有提示就在同一行上接着出片；
 * 画布（review）有提示时停下等用户选，创作助手（auto）不停。改写按实际 Token 结算。
 */
class StudioVideoRewriteWorkerTest {
    final ObjectMapper json = new ObjectMapper();
    final AiChatTokenPricing.Rate rate = new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"), new java.math.BigDecimal("1.08"), 65536, 8192);

    static final String DIRECTOR_STYLE = "第1镜（0–3 秒）：全景，女孩走进咖啡店。\n第2镜（3–6 秒）：近景，画面里只有女孩。女孩说：「一杯热美式，谢谢。」\n【声音】咖啡机声。";

    record Harness(StudioWorkflowWorker worker, IpRun run, CreditService credits, IpRunService videos) {}

    Harness harness(String prompt, String mode, String rewrite, String reply) {
        var settings = new VideoSettings(mode, "768p", null, null, null,
                "universal_reference_video".equals(mode) ? List.of(new VideoStudioReferenceInput("image", "u/ref.png")) : null, null, rewrite);
        var built = H3StudioPrompt.build(prompt, 6, settings, json.createObjectNode());
        ObjectNode input = json.createObjectNode().put("clientRequestId", "c1").put("nodeId", "n1").put("operation", "video").put("prompt", prompt)
                .put("model", "ep-h3").put("durationSec", 6).put("aspectRatio", "9:16").put("count", 1).put("maxCost", 480).put("mock", false);
        input.set("video", json.valueToTree(settings));
        ObjectNode exec = input.putObject("_exec").put("rewrite", rewrite).put("endpointId", "qwen").put("maxTokens", 4096).put("temperature", 0.6)
                .put("systemPrompt", H3PromptRewrite.system(built.request().mode(), built.request().codeLines(), built.request().shots() != null))
                .put("userPrompt", H3PromptRewrite.user(built.request()));
        exec.set("h3", H3PromptRewrite.meta(json, built.request(), built.pictures(), built.videos(), built.audios()));
        exec.set("tokenPricing", json.valueToTree(rate));
        var runs = mock(IpRunRepository.class);
        var models = mock(AiModelInvocationService.class);
        var credits = mock(CreditService.class);
        var tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var run = IpRun.builder().id("r").projectId("p").ownerUserId("u").nodeId("n1").kind("studio-video").status("running").cost(30).inputJson(input.toString()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run));
        when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint = AiModelEndpoint.builder().id("qwen").enabled(true).model("m").build();
        when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, "qwen", "studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(models.invokeChatOnEndpoint(eq(endpoint), eq(AiModelPurpose.DAP_PERSONA), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(reply, "stop", 2000L, "m", "m", 1000L, 1000L));
        var worker = new StudioWorkflowWorker(runs, mock(StudioFixtureProvider.class), mock(FileStorageService.class), models, mock(DramaAssembleService.class), credits, json, tx, mock(DapAssetService.class));
        var videos = mock(IpRunService.class);
        when(videos.generateVideoBatch(anyString(), anyString(), any(), anyInt()))
                .thenReturn(new IpRunService.VideoBatch(List.of(json.createObjectNode().put("id", "mvj_1")), json.createObjectNode()));
        @SuppressWarnings("unchecked") ObjectProvider<IpRunService> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(videos);
        ReflectionTestUtils.setField(worker, "videoRuns", provider);
        return new Harness(worker, run, credits, videos);
    }

    /** 模型按约定写回、台词只留占位的一稿。 */
    String clean() {
        return "{\"subject_definitions\":\"<Subject 1> is the girl in <Picture 1>.\",\"summary\":\"[reference generation] A girl orders coffee.\","
                + "\"retention_analysis\":\"<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - face.\",\"style\":\"Live-action.\","
                + "\"overall_soundscape\":\"An espresso machine hisses.\",\"non_diegetic_music\":\"N/A\","
                + "\"shot_1\":\"A wide shot as <Subject 1> walks into a cafe.\",\"shot_2\":\"the camera cuts to <Subject 1> alone, who says brightly: {{L1}}\"}";
    }

    IpRunService.IpVideoRequest submitted(Harness h) {
        var req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        verify(h.videos()).generateVideoBatch(eq("u"), eq("p"), req.capture(), eq(1));
        return req.getValue();
    }

    @Test
    void aCleanDraftGoesStraightToTheVideoOnTheSameRun() throws Exception {
        var h = harness(DIRECTOR_STYLE, "universal_reference_video", "review", clean());
        h.worker().runBlocking("r");
        var req = submitted(h);
        assertTrue(req.prompt().startsWith("subject_definitions:"), req.prompt());
        assertTrue(req.prompt().contains("[Shot 2] At 00:03.000, the camera cuts to <Subject 1> alone, who says brightly: (S1) <d>[Chinese] 一杯热美式，谢谢。</d>"), req.prompt());
        assertEquals(Boolean.FALSE, req.video().optimizePrompt(), "厂商自己的改写关掉");
        assertNull(req.video().rewrite());
        assertEquals(480L, req.maxCost(), "视频照用户确认的价格");
        assertEquals("done", h.run().getStatus());
        JsonNode inputs = json.readTree(h.run().getInputJson());
        assertEquals("mvj_1", inputs.path("_exec").path("nativeVideoJobIds").get(0).asText(), "之后按视频任务投影");
        assertEquals(req.prompt(), json.readTree(h.run().getOutputJson()).path("videoPrompt").path("text").asText());
        verify(h.credits()).commitHold(anyString(), eq("r"), anyLong(), anyString(), any());
    }

    @Test
    void onTheCanvasADraftWithNotesStopsForTheUsersChoice() throws Exception {
        String missingLine = clean().replace("who says brightly: {{L1}}", "who smiles.");
        var h = harness(DIRECTOR_STYLE, "universal_reference_video", "review", missingLine);
        h.worker().runBlocking("r");
        verify(h.videos(), never()).generateVideoBatch(anyString(), anyString(), any(), anyInt());
        assertEquals("done", h.run().getStatus());
        JsonNode out = json.readTree(h.run().getOutputJson());
        assertTrue(out.path("needsChoice").asBoolean());
        assertTrue(out.path("videoPrompt").path("warnings").toString().contains("模型漏了"), out.toString());
        assertTrue(out.path("videoPrompt").path("text").asText().contains("The speaker says: (S1) <d>[Chinese] 一杯热美式，谢谢。</d>"), "补回的台词在优化稿里，用户可以直接用");
        verify(h.credits()).commitHold(anyString(), eq("r"), anyLong(), anyString(), any());
    }

    @Test
    void onTheCanvasAFailedRewriteIsNotChargedAndDoesNotGenerate() {
        var h = harness(DIRECTOR_STYLE, "universal_reference_video", "review", "not json");
        h.worker().runBlocking("r");
        verify(h.videos(), never()).generateVideoBatch(anyString(), anyString(), any(), anyInt());
        assertEquals("failed", h.run().getStatus());
        assertEquals("AI_BAD_OUTPUT", h.run().getErrorCode());
        verify(h.credits()).releaseHold(anyString(), eq("r"), anyString());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString(), any());
    }

    @Test
    void forTheAssistantAFailedRewriteGeneratesFromTheOriginal() throws Exception {
        var h = harness(DIRECTOR_STYLE, "universal_reference_video", "auto", "not json");
        h.worker().runBlocking("r");
        var req = submitted(h);
        assertEquals(DIRECTOR_STYLE, req.prompt(), "创作助手不停下来问，按原文接着做");
        assertEquals("done", h.run().getStatus());
        JsonNode out = json.readTree(h.run().getOutputJson());
        assertEquals("提示词优化没成功，已按原文生成", out.path("videoPromptNotes").get(0).asText());
    }

    @Test
    void forTheAssistantNotesDoNotStopTheVideo() {
        var h = harness(DIRECTOR_STYLE, "universal_reference_video", "auto", clean().replace("who says brightly: {{L1}}", "who smiles."));
        h.worker().runBlocking("r");
        assertTrue(submitted(h).prompt().contains("(S1) <d>[Chinese] 一杯热美式，谢谢。</d>"));
    }

    @Test
    void aUserWrittenPromptIsOptimisedWithTheModelWritingTheLines() throws Exception {
        // 不是「某某说：「…」」的写法：代码认不出台词，由模型照官方写法写，代码逐句核对
        String prompt = "女孩走进咖啡店。女孩：“一杯热美式，谢谢。”";
        String reply = "{\"style\":\"Live-action.\",\"overall_soundscape\":\"Cafe chatter.\",\"non_diegetic_music\":\"N/A\",\"shots\":[{\"start\":0,\"text\":"
                + "\"A girl walks into a cafe and (S1) says to the barista: <d>[Chinese] 一杯热美式，谢谢。</d>\"}]}";
        var h = harness(prompt, "t2v", "review", reply);
        h.worker().runBlocking("r");
        assertEquals("done", h.run().getStatus(), h.run().getOutputJson() + " " + h.run().getErrorMessage());
        assertFalse(json.readTree(h.run().getOutputJson()).path("needsChoice").asBoolean(), h.run().getOutputJson());
        var req = submitted(h);
        assertEquals("integrated_multimodal_description: Live-action. [Shot 1] A girl walks into a cafe and (S1) says to the barista: <d>[Chinese] 一杯热美式，谢谢。</d>"
                + "\n\noverall_soundscape: Cafe chatter.\n\nnon_diegetic_music: N/A", req.prompt());
        assertTrue(json.readTree(h.run().getOutputJson()).path("videoPrompt").path("warnings").isEmpty());
    }

    @Test
    void theRewriteInputListsReferencesInTheOrderTheyAreSent() {
        ObjectNode doc = json.createObjectNode();
        doc.putArray("nodes").addObject().put("title", "林小雅定妆照").putObject("metadata").put("storageKey", "u/ref.png");
        var settings = new VideoSettings("universal_reference_video", "768p", null, null, null,
                List.of(new VideoStudioReferenceInput("image", "u/ref.png"), new VideoStudioReferenceInput("audio", "u/voice.mp3")), null, "review");
        var built = H3StudioPrompt.build(DIRECTOR_STYLE, 6, settings, doc);
        assertEquals(List.of("<Picture 1>: reference image 「林小雅定妆照」.", "<Audio 1>: reference audio; use only its timbre and delivery."), built.request().references());
        assertTrue(built.request().codeLines(), "按「某某说：「…」」写的台词由代码填");
        assertEquals(2, built.request().shots(), "按「第N镜（…）」分好的镜头固定");
        var free = H3StudioPrompt.build("一个女孩在雨里跳舞", 5, new VideoSettings("i2v", "768p", null, "u/first.png", null, null, null, "review"), doc);
        assertFalse(free.request().codeLines());
        assertNull(free.request().shots(), "没分镜头就由模型定");
        assertEquals(H3PromptRewrite.Mode.I2V, free.request().mode());
        assertEquals(List.of("<Picture 1>: the first frame of the target video."), free.request().references());
    }
}
