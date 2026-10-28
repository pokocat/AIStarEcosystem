package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 分镜确认的布光要传到视频（2026-10-28 review）：第 3 版视频提示词让分镜图同时交代人物受光、肤色和整体色调，
 * 场景图只交代空间和光源位置；给 H3 英文改写的参考说明同样改。旧版（第 1、2 版）生成的视频按它那一版核对，不被标成需更新。
 */
class DirectorVideoLightingTest {
    private final ObjectMapper om = new ObjectMapper();
    private DirectorService service;
    private ObjectNode c;

    @BeforeEach
    void setUp() throws Exception {
        StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
        when(fixtures.enabled()).thenReturn(true);
        service = new DirectorService(null, null, null, null, null, null, mock(StudioVideoService.class), fixtures, null, null, null,
                mock(AiAppSceneModelPolicyService.class), null, null, null, om, mock(PlatformTransactionManager.class));
        c = (ObjectNode) om.readTree("""
                {"seq":10,"settings":{"style":"真人写实","aspectRatio":"9:16"},"taskMeta":{},
                 "assets":[
                  {"id":"as4","kind":"character","name":"陈默","description":"三十岁，短发","image":{"candidates":[{"id":"m1","key":"k/chen.png","source":"generated"}],"adoptedId":"m1","adoptedBy":"user"}},
                  {"id":"as5","kind":"scene","name":"旧书店","description":"靠窗一张木桌，头顶一盏吊灯","image":{"candidates":[{"id":"m2","key":"k/shop.png","source":"generated"}],"adoptedId":"m2","adoptedBy":"user"}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"夜访","durationSec":8,"assetIds":["as4","as5"],
                  "shots":[
                   {"durationSec":4,"size":"中景","camera":"平视，固定机位","still":"陈默推门走进书店","action":"推门","dialogue":[]},
                   {"durationSec":4,"size":"近景","camera":"越过陈默肩膀，缓慢推近","still":"陈默低头看信","action":"低头","dialogue":[{"speakerId":"as4","text":"谁寄来的？"}]}],
                  "boardPrompt":"","boardPromptCustom":false,
                  "board":{"candidates":[{"id":"b1","key":"k/board.png","source":"generated"}],"adoptedId":"b1","adoptedBy":"user"},
                  "video":{"candidates":[],"adoptedId":"v1","adoptedBy":"user"}}]}""");
    }

    private ObjectNode clip() { return (ObjectNode) c.path("clips").get(0); }
    private JsonNode video() { return clip().path("video"); }

    private static final List<DirectorPrompts.Ref> REFS = List.of(new DirectorPrompts.Ref("图2", "character", "陈默"), new DirectorPrompts.Ref("图3", "scene", "旧书店"));
    private static final Map<String, String> NAMES = Map.of("as4", "陈默", "as5", "旧书店");

    private String v2() { return DirectorPrompts.videoPromptV2(c.path("settings"), clip(), REFS, NAMES, List.of(), List.of("陈默"), new LinkedHashMap<>()); }
    private String v1() { return DirectorPrompts.legacyVideoPrompt(c.path("settings"), clip(), REFS, NAMES, List.of(), List.of("陈默"), new LinkedHashMap<>()); }

    /** 与 DirectorService#videoCurrent 同一个指纹算法（测试响应的视频模型 id 为 null）。 */
    private String fingerprint(String prompt) { return DirectorService.hash(prompt + "|8|9:16|null|k/board.png|k/chen.png|k/shop.png"); }

    private void adopt(String prompt, Integer format) {
        ObjectNode v = ((ObjectNode) video()).withArray("candidates").addObject()
                .put("id", "v1").put("key", "k/v.mp4").put("source", "generated").put("prompt", prompt).put("fingerprint", fingerprint(prompt));
        if (format != null) v.put("promptFormat", format);
        var refs = v.putArray("refs");
        refs.addObject().put("label", "图1").put("key", "k/board.png");
        refs.addObject().put("label", "图2").put("key", "k/chen.png");
        refs.addObject().put("label", "图3").put("key", "k/shop.png");
    }

    @Test
    void theStoryboardCarriesTheLightingAndTheSceneOnlyTheLightSources() {
        service.refresh(c);
        String video = clip().path("videoPrompt").asText();
        assertTrue(video.contains("人物的受光、肤色和画面整体色调也照对应的格子"), video);
        assertTrue(video.contains("场景「旧书店」：空间布局和光源位置照参考图3"), video);
        assertFalse(video.contains("每格只参考构图") || video.contains("光线照参考"), "不再一边说分镜只管构图、一边让场景图管光线");
        assertFalse(video.contains("补光"), "出图的布光规则不整段粘到视频里，视频照已确认的分镜图");
    }

    @Test
    void theH3RewriteIsToldTheSame() throws Exception {
        service.refresh(c);
        Method rewrite = DirectorService.class.getDeclaredMethod("rewrite", ObjectNode.class, JsonNode.class);
        rewrite.setAccessible(true);
        Object rw = rewrite.invoke(service, c, clip());
        Method user = rw.getClass().getDeclaredMethod("user");
        user.setAccessible(true);
        String text = (String) user.invoke(rw);
        assertTrue(text.contains("follow each panel's lighting on faces, skin tones and overall color grade"), text);
        assertTrue(text.contains("use it for the layout and where the light sources are"), text);
        assertFalse(text.contains("Use it only for viewpoint"), "旧说明把分镜图限定在构图上");
    }

    @Test
    void videosMadeWithVersionOneOrTwoStayCurrentAfterTheChange() {
        adopt(v2(), 2);
        service.refresh(c);
        assertEquals("current", video().path("adoptedCheck").asText(), video().toString());

        ((ObjectNode) video()).putArray("candidates");
        adopt(v1(), null);
        service.refresh(c);
        assertEquals("current", video().path("adoptedCheck").asText(), "第 1 版的照旧按第 1 版核对");
    }

    @Test
    void aVersionTwoVideoIsStillFlaggedWhenTheDialogueReallyChanged() {
        adopt(v2(), 2);
        ((ObjectNode) clip().path("shots").get(1).path("dialogue").get(0)).put("text", "改过的台词？");
        service.refresh(c);
        assertEquals("outdated", video().path("adoptedCheck").asText());
        assertEquals("镜头、台词或提示词已修改", video().path("staleReasons").get(0).asText());
    }

    @Test
    void aVersionThreeVideoIsCheckedAgainstVersionThreeOnly() {
        service.refresh(c);
        adopt(clip().path("videoPrompt").asText(), DirectorPrompts.VIDEO_PROMPT_FORMAT);
        service.refresh(c);
        assertEquals("current", video().path("adoptedCheck").asText());
        ((ObjectNode) video()).putArray("candidates");
        adopt(v2(), DirectorPrompts.VIDEO_PROMPT_FORMAT); // 记了第 3 版、内容却是第 2 版：按第 3 版核对
        service.refresh(c);
        assertEquals("outdated", video().path("adoptedCheck").asText());
    }

    @Test
    void aVersionTwoTaskFinishingAfterTheChangeIsNotTreatedAsChanged() throws Exception {
        service.refresh(c);
        ObjectNode meta = om.createObjectNode().put("prompt", v2()).put("fingerprint", fingerprint(v2())).put("promptFormat", 2);
        Method add = DirectorService.class.getDeclaredMethod("addVideoCandidate", ObjectNode.class, ObjectNode.class, String.class, String.class, JsonNode.class, boolean.class);
        add.setAccessible(true);
        ((ObjectNode) video()).put("adoptedId", (String) null);
        add.invoke(service, c, clip(), "k/v2.mp4", "IPR-v2", meta, false);
        JsonNode cand = video().path("candidates").get(0);
        assertFalse(cand.path("stale").asBoolean(false), video().toString());
        assertEquals(2, cand.path("promptFormat").asInt());
    }
}
