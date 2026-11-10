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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 2026-11-10 线上：分镜里第 3 镜没有台词，客户改写视频提示词时自己加了一句。第一次写「咂了下嘴说：不好吃，」（没加引号），
 * 第二次写「咂了下嘴说：“味道还是不行”」（中文双引号）。两次都一句没认出，代码按「认全了」处理，对改写模型说
 * 「Shot 3: no spoken lines」，模型照做删掉台词、还补了一句「No speech is audible.」，视频里她一句没说。
 * 片段原文照线上那一版（只换掉台词那一处）；验的是最终发给视频模型的提示词。
 */
class DirectorUserAddedLineTest {
    private final ObjectMapper om = new ObjectMapper();
    private IpRunRepository runs;
    private IpRunService imageRuns;
    private StudioWorkflowService textRuns;
    private DirectorService service;
    private DirectorWork w;
    private ObjectNode c;

    /** 客户第二次提交时的视频提示词（线上原文）。 */
    static final String CURLY = """
            【人物】
            静儿：长相、发型和衣服照参考图2。
            场景「静儿家厨房小院」：空间布局和光源位置照参考图3。
            静儿在画面里只出现一个，长相和衣服从头到尾保持一致。

            【分镜参考】
            参考图1 是 2×2 分镜：左上格对应第1镜，右上格对应第2镜，左下格对应第3镜，右下格对应第4镜。每格参考构图、机位和人物位置，人物的受光、肤色和画面整体色调也照对应的格子，每一镜都是一个完整的全屏画面。

            【画面】
            真人写实风格，画面里没有字幕。
            第1镜（0–4 秒）：中景，隔着碎花门帘从门口拍，固定机位。黑烟从锅里升起，静儿偏头躲开，门帘一角挡在前景。白炽灯泡的暖黄光下，静儿在煤气灶前翻炒，锅里冒起一股黑烟，她偏头躲开，伸手拧灶台旋钮关火。画面里只有静儿。
            第2镜（4 秒切）：近景，灶台侧前方拍，缓慢推近。静儿端着勺凑近鼻尖，头微微后仰，勺里红油反光。静儿用长柄勺舀起一勺锅底料汤，凑到鼻前闻了闻，摇了摇头，把勺放回锅里。画面里只有静儿。
            第3镜（8 秒切）：近景，灶台侧面拍，镜头右摇。静儿转过半个身，手伸向案台，嘴还抿着。静儿用勺尖蘸一点底料抿进嘴里，咂了下嘴说：“味道还是不行”转身伸手去够案台上的辣椒面。画面里只有静儿。
            第4镜（12 秒切）：特写，高角度俯拍锅口，缓慢推近。辣椒面从指缝落进锅里，汤底冒着大泡，蒸汽向上。静儿的手往锅里撒下一撮辣椒面，汤底翻起大泡，白色蒸汽向上涌，锅里响起咕噜声。画面里只有静儿。最后保持这个画面到结束。

            【声音】
            为了熬出一锅正宗有特色的延安沾沾底料，静儿一直在调，一直在研究，不停的琢磨

            【配乐】
            无""";
    /** 客户第一次提交时的写法：没加引号。 */
    static final String NO_QUOTES = CURLY.replace("咂了下嘴说：“味道还是不行”转身", "咂了下嘴说：不好吃，转身");

    @BeforeEach
    void setUp() throws Exception {
        runs = mock(IpRunRepository.class);
        imageRuns = mock(IpRunService.class);
        textRuns = mock(StudioWorkflowService.class);
        StudioVideoService videoModels = mock(StudioVideoService.class);
        MaterialVideoJobService videoJobs = mock(MaterialVideoJobService.class);
        service = new DirectorService(null, runs, null, imageRuns, textRuns, null, videoModels, mock(StudioFixtureProvider.class), null, videoJobs, null, null,
                mock(AiAppSceneModelPolicyService.class), null, null, null, om, mock(PlatformTransactionManager.class));
        var contract = new VideoStudioContract(List.of(new VideoStudioModeSpec("universal_reference_video", false, false, null, null)),
                List.of(new VideoStudioTier("768p", List.of(new VideoStudioCanvas("16:9", 1344, 768)))), 4, 15, 7000, 0L);
        when(videoModels.models()).thenReturn(List.of(new VideoStudioModel("ep-h3", "MiniMax H3", true, true, true, contract, null)));
        when(videoModels.quote(eq("u1"), any())).thenReturn(600L);
        when(textRuns.videoRewriteHold()).thenReturn(5L);
        when(textRuns.directorTextPrice(any())).thenReturn(5L);
        when(textRuns.directorPrices(any())).thenReturn(new long[]{3, 8});
        when(textRuns.submitDirectorText(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), any(), any(), any()))
                .thenReturn(new IpRunDto("IPR-rw", "DW-1", "videoPrompt:cl1", "studio-director", "running", "queued", 0, 5, null, null, null, null, "t", null, null));
        when(imageRuns.generateVideoForDirector(anyString(), anyString(), anyString(), any()))
                .thenReturn(om.createObjectNode().put("id", "mvj_1").put("stage", "queued").put("progress_pct", 0));
        when(videoJobs.getJob(any(), any(), any())).thenReturn(om.createObjectNode().put("status", "queued").put("stage", "排队中"));
        w = new DirectorWork();
        w.setId("DW-1");
        w.setOwnerUserId("u1");
        c = (ObjectNode) om.readTree("""
                {"settings":{"style":"真人写实","aspectRatio":"16:9","language":"中文"},"applied":[],"taskMeta":{},
                 "assets":[
                  {"id":"as22","kind":"character","name":"静儿","description":"二十岁的陕北姑娘。","image":{"candidates":[{"id":"m1","key":"k/jinger.png","source":"generated"}],"adoptedId":"m1","adoptedBy":"user"}},
                  {"id":"as51","kind":"scene","name":"静儿家厨房小院","description":"陕北砖房小院。","image":{"candidates":[{"id":"m2","key":"k/yard.png","source":"generated"}],"adoptedId":"m2","adoptedBy":"user"}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"熬底料","durationSec":15,"assetIds":["as22","as51"],
                  "shots":[
                   {"durationSec":4,"size":"中景","camera":"隔着碎花门帘从门口拍，固定机位","still":"黑烟从锅里升起，静儿偏头躲开，门帘一角挡在前景","action":"白炽灯泡的暖黄光下，静儿在煤气灶前翻炒，锅里冒起一股黑烟，她偏头躲开，伸手拧灶台旋钮关火。","dialogue":[]},
                   {"durationSec":4,"size":"近景","camera":"灶台侧前方拍，缓慢推近","still":"静儿端着勺凑近鼻尖，头微微后仰，勺里红油反光","action":"静儿用长柄勺舀起一勺红油底料，凑到鼻前闻了闻，摇了摇头，把勺放回锅里。","dialogue":[]},
                   {"durationSec":4,"size":"近景","camera":"灶台侧面拍，镜头右摇","still":"静儿转过半个身，手伸向案台，嘴还抿着","action":"静儿用勺尖蘸一点底料抿进嘴里，咂了下嘴，转身伸手去够案台上的辣椒面。","dialogue":[]},
                   {"durationSec":3,"size":"特写","camera":"高角度俯拍锅口，缓慢推近","still":"辣椒面从指缝落进锅里，红油冒着大泡，蒸汽向上","action":"静儿的手往锅里撒下一撮辣椒面，红油翻起大泡，白色蒸汽向上涌，锅里响起滋啦声。","dialogue":[]}],
                  "board":{"candidates":[{"id":"b1","key":"k/board.png","source":"generated"}],"adoptedId":"b1","adoptedBy":"user"},
                  "video":{"candidates":[],"adoptedId":null,"pending":[]}}]}""");
        service.refresh(c);
    }

    private ObjectNode clip() { return (ObjectNode) c.path("clips").get(0); }

    private void customPrompt(String prompt) {
        clip().put("videoPrompt", prompt).put("videoPromptCustom", true);
        service.refresh(c);
    }

    private record Sent(String user, ObjectNode meta) {}

    private Sent dispatch() {
        assertEquals("IPR-rw", service.dispatch("u1", w, c, "video", "cl1", "u-r1", om.createObjectNode(), null, null, 600L));
        ArgumentCaptor<String> user = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<ObjectNode> meta = ArgumentCaptor.forClass(ObjectNode.class);
        verify(textRuns).submitDirectorText(eq("u1"), eq("DW-1"), eq("videoPrompt:cl1"), anyString(), user.capture(), anyString(), meta.capture(), any(), any(), any());
        return new Sent(user.getValue(), meta.getValue());
    }

    /** 模型照约定写回的四镜；{@code shot3} 是第 3 镜正文。 */
    private ObjectNode output(String shot3) {
        ObjectNode o = om.createObjectNode().put("subject_definitions", "<Subject 1> is Jing'er from <Picture 2>.\n<Subject 2> is the kitchen courtyard from <Picture 3>.")
                .put("summary", "[reference generation] Jing'er keeps adjusting a pot of broth.")
                .put("retention_analysis", "<Picture 1> ([Shot 1]–[Shot 4]): fully_preserved.\n<Picture 2> ([Shot 1]–[Shot 4]): fully_preserved.\n<Picture 3> ([Shot 1]–[Shot 4]): fully_preserved.")
                .put("style", "Live-action realism. No subtitles.").put("overall_soundscape", "Frying and bubbling broth.").put("non_diegetic_music", "N/A");
        ArrayNode shots = o.putArray("shots");
        shots.add("A static medium shot through the floral curtain; <Subject 1> switches off the smoking stove.");
        shots.add("the camera cuts to a close view; <Subject 1> smells the broth and shakes her head.");
        shots.add(shot3);
        shots.add("the camera cuts to a high-angle close-up of chili powder falling into the bubbling broth.");
        return o;
    }

    /** 改写任务完成，worker 校验后回投；返回随后发给视频模型的提示词（有提示、停下等用户选时为 null）。 */
    private String finish(ObjectNode meta, ObjectNode modelOutput) throws Exception {
        ObjectNode input = om.createObjectNode();
        input.set("_director", meta);
        ObjectNode output = om.createObjectNode();
        output.set("director", DirectorPrompts.validate(om, meta, modelOutput));
        IpRun run = IpRun.builder().id("IPR-rw").projectId("DW-1").hostType(IpRun.HOST_DIRECTOR).ownerUserId("u1").nodeId("videoPrompt:cl1")
                .kind("studio-director").status(IpRun.STATUS_DONE).stage("done").cost(0L).inputJson(om.writeValueAsString(input))
                .outputJson(om.writeValueAsString(output)).createdAt(Instant.now()).build();
        when(runs.findByProjectIdOrderByCreatedAtDesc("DW-1")).thenReturn(List.of(run));
        when(runs.findById("IPR-rw")).thenReturn(java.util.Optional.of(run));
        service.reconcile(w, c);
        ArgumentCaptor<IpRunService.IpVideoRequest> req = ArgumentCaptor.forClass(IpRunService.IpVideoRequest.class);
        verify(imageRuns, atMost(1)).generateVideoForDirector(eq("u1"), eq("DW-1"), eq("video:cl1"), req.capture());
        return req.getAllValues().isEmpty() ? null : req.getValue().prompt();
    }

    private static String shot(String prompt, int n) {
        int body = prompt.indexOf("detailed_description:"); // 保留说明里也有「[Shot 1]–[Shot 4]」
        int from = prompt.indexOf("[Shot " + n + "]", body), to = prompt.indexOf("[Shot " + (n + 1) + "]", body);
        return prompt.substring(from, to < 0 ? prompt.indexOf("\n\noverall_soundscape") : to);
    }

    @Test
    void aLineAddedInCurlyQuotesIsFilledByCodeInItsShot() throws Exception {
        customPrompt(CURLY);
        Sent s = dispatch();
        assertTrue(s.meta().path("codeLines").asBoolean(), "中文双引号的台词也认得出，由代码原样填回");
        assertTrue(s.user().contains("Shot 3: {{L1}}"), s.user());
        assertFalse(s.user().contains("Shot 3: no spoken lines"), "不能对模型说第 3 镜没有台词：" + s.user());
        assertTrue(s.user().contains("咂了下嘴说：{{L1}}转身"), s.user());
        assertFalse(s.user().contains("味道还是不行"), "台词原文不交给改写模型");
        JsonNode line = s.meta().path("lines").get(0);
        assertEquals("味道还是不行", line.path("text").asText());
        assertEquals(3, line.path("shot").asInt());

        String sent = finish(s.meta(), output("the camera cuts to a close side view. <Subject 1> tastes the broth, smacks her lips and says: {{L1}} She turns toward the counter."));
        assertNotNull(sent, "没有提示，直接接着出视频");
        assertTrue(shot(sent, 3).contains("(S1) <d>[Chinese] 味道还是不行</d>"), sent);
        for (int i : List.of(1, 2, 4)) assertFalse(shot(sent, i).contains("<d>"), "台词只在第 3 镜：" + sent);
    }

    @Test
    void theSpeakerOfALineAfterAnActionIsTheCharacterOfThatSentence() {
        // 「摇了摇头说」「咂了下嘴说」前面都不是名字：按同一句前文认作静儿，两句是同一个说话人（同一个编号，H3 才用同一个声音）
        customPrompt(CURLY.replace("摇了摇头，把勺放回锅里", "摇了摇头说：「不对」，把勺放回锅里"));
        Sent s = dispatch();
        assertTrue(s.meta().path("codeLines").asBoolean());
        List<String> sids = new ArrayList<>();
        s.meta().path("lines").forEach(l -> sids.add(l.path("sid").asText()));
        assertEquals(List.of("S1", "S1"), sids);
        assertEquals(2, s.meta().path("lines").get(0).path("shot").asInt());
        assertEquals(3, s.meta().path("lines").get(1).path("shot").asInt());
    }

    @Test
    void aLineAddedWithoutQuotesIsLeftToTheModelAndCheckedAgainstTheOriginal() throws Exception {
        customPrompt(NO_QUOTES);
        Sent s = dispatch();
        assertFalse(s.meta().path("codeLines").asBoolean(), "认不出的台词还在原文里：改由模型照原文写");
        assertFalse(s.user().contains("no spoken lines"), s.user());
        assertTrue(s.user().contains("咂了下嘴说：不好吃，转身"), "原文原样交给模型：" + s.user());
        JsonNode spoken = s.meta().path("spoken");
        assertEquals(1, spoken.size(), "【人物】里的「静儿：长相…」不当台词：" + spoken);
        assertTrue(spoken.get(0).path("text").asText().startsWith("不好吃"), spoken.toString());

        String sent = finish(s.meta(), output("the camera cuts to a close side view. <Subject 1> tastes the broth, smacks her lips and (S1) says: <d>[Chinese] 不好吃</d> She turns toward the counter."));
        assertNotNull(sent, "模型写的台词对得上原文，不打扰用户");
        assertTrue(shot(sent, 3).contains("<d>[Chinese] 不好吃</d>"), sent);
    }

    @Test
    void aDraftThatDropsTheUnquotedLineWaitsForTheUser() throws Exception {
        customPrompt(NO_QUOTES);
        Sent s = dispatch();
        assertNull(finish(s.meta(), output("the camera cuts to a close side view. <Subject 1> tastes the broth and smacks her lips. She does not speak.")),
                "漏了台词：先停下让用户选，不拿删了台词的稿子出片");
        assertEquals("review", clip().path("videoPromptRewrite").asText());
        List<String> warnings = new ArrayList<>();
        clip().path("videoPromptEn").path("warnings").forEach(x -> warnings.add(x.asText()));
        assertTrue(warnings.stream().anyMatch(x -> x.contains("不好吃")), warnings.toString());
    }

    @Test
    void theTemplatesNoDialogueSentenceIsDroppedOnceTheUserAddsALine() {
        String auto = clip().path("videoPrompt").asText();
        assertTrue(auto.contains(DirectorPrompts.NO_DIALOGUE), auto);
        customPrompt(auto.replace("咂了下嘴，转身", "咂了下嘴说：「味道还是不行」转身"));
        Sent s = dispatch();
        assertTrue(s.meta().path("codeLines").asBoolean());
        assertFalse(s.user().contains(DirectorPrompts.NO_DIALOGUE), "模板写的「这一段没有对白」与用户加的台词矛盾：" + s.user());
        assertTrue(s.user().contains("Shot 3: {{L1}}"), s.user());
    }
}
