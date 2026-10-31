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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 2026-10-26 视频提示词换成中文 H3 结构后，换模板本身不能把已采用的视频都标成「镜头、台词或提示词已修改」：
 * 旧格式生成的候选（没有 promptFormat）按旧模板核对，新格式的按新模板核对。
 */
class DirectorVideoPromptFormatTest {
    private final ObjectMapper om = new ObjectMapper();
    private DirectorService service;
    private ObjectNode c;

    @BeforeEach
    void setUp() throws Exception {
        StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
        when(fixtures.enabled()).thenReturn(true); // 没有可用视频模型时按测试响应的合同（全能参考、4–15 秒）
        service = new DirectorService(null, null, null, null, null, null, mock(StudioVideoService.class), fixtures, null, null, null, null,
                mock(AiAppSceneModelPolicyService.class), null, null, null, om, mock(PlatformTransactionManager.class));
        c = (ObjectNode) om.readTree("""
                {"settings":{"style":"真人写实","aspectRatio":"9:16"},
                 "assets":[
                  {"id":"as4","kind":"character","name":"陈默","description":"","image":{"candidates":[{"id":"m1","key":"k/chen.png","source":"generated"}],"adoptedId":"m1","adoptedBy":"user"}},
                  {"id":"as6","kind":"character","name":"林小雅","description":"","image":{"candidates":[{"id":"m2","key":"k/lin.png","source":"generated"}],"adoptedId":"m2","adoptedBy":"user"}}],
                 "clips":[{"id":"cl1","episodeId":"ep1","order":1,"title":"飞仙之眼","durationSec":15,"assetIds":["as4","as6"],
                  "shots":[
                   {"durationSec":7,"size":"全景","camera":"低角度","still":"陈默和林小雅站在壁画前","action":"林小雅举相机","dialogue":[]},
                   {"durationSec":8,"size":"近景","camera":"平视","still":"林小雅指着壁画","action":"林小雅前倾","dialogue":[{"speakerId":"as6","text":"小哥，你看这个飞仙的眼睛。"}]}],
                  "board":{"candidates":[{"id":"b1","key":"k/board.png","source":"generated"}],"adoptedId":"b1","adoptedBy":"user"},
                  "video":{"candidates":[],"adoptedId":"v1","adoptedBy":"user"}}]}""");
    }

    private String legacyPrompt() {
        return DirectorPrompts.legacyVideoPrompt(c.path("settings"), c.path("clips").get(0),
                List.of(new DirectorPrompts.Ref("图2", "character", "陈默"), new DirectorPrompts.Ref("图3", "character", "林小雅")),
                Map.of("as4", "陈默", "as6", "林小雅"), List.of(), List.of("林小雅"), new LinkedHashMap<>());
    }

    /** 生成时记下的候选：提示词、指纹（与 DirectorService#videoCurrent 同一个算法）和实际参考图。 */
    private void adopt(String prompt, Integer format) {
        ObjectNode v = ((ObjectNode) c.path("clips").get(0).path("video")).withArray("candidates").addObject()
                .put("id", "v1").put("key", "k/v.mp4").put("source", "generated").put("prompt", prompt)
                .put("fingerprint", DirectorService.hash(prompt + "|15|9:16|null|k/board.png|k/chen.png|k/lin.png"));
        if (format != null) v.put("promptFormat", format);
        var refs = v.putArray("refs");
        refs.addObject().put("label", "图1").put("key", "k/board.png");
        refs.addObject().put("label", "图2").put("key", "k/chen.png");
        refs.addObject().put("label", "图3").put("key", "k/lin.png");
    }

    private JsonNode video() { return c.path("clips").get(0).path("video"); }

    @Test
    void videoMadeWithTheOldTemplateStaysCurrentAfterTheTemplateChange() {
        adopt(legacyPrompt(), null);
        service.refresh(c);
        assertTrue(c.path("clips").get(0).path("videoPrompt").asText().contains("【画面】"), "片段已经换成新模板");
        assertEquals("current", video().path("adoptedCheck").asText(), video().toString());
    }

    @Test
    void oldTemplateVideoIsStillFlaggedWhenTheDialogueReallyChanged() {
        adopt(legacyPrompt(), null);
        ((ObjectNode) c.path("clips").get(0).path("shots").get(1).path("dialogue").get(0)).put("text", "改过的台词。");
        service.refresh(c);
        assertEquals("outdated", video().path("adoptedCheck").asText());
        assertEquals("镜头、台词或提示词已修改", video().path("staleReasons").get(0).asText());
    }

    @Test
    void videoMadeWithTheNewTemplateIsCheckedAgainstTheNewTemplate() {
        service.refresh(c); // 先编出新格式提示词
        adopt(c.path("clips").get(0).path("videoPrompt").asText(), DirectorPrompts.VIDEO_PROMPT_FORMAT);
        service.refresh(c);
        assertEquals("current", video().path("adoptedCheck").asText(), video().toString());

        // 记了新格式、内容却是旧模板的（不会发生，但核对必须按新模板）→ 已修改
        ((ObjectNode) video()).putArray("candidates");
        adopt(legacyPrompt(), DirectorPrompts.VIDEO_PROMPT_FORMAT);
        service.refresh(c);
        assertEquals("outdated", video().path("adoptedCheck").asText());
    }
}
