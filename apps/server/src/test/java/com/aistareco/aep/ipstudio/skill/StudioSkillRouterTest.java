package com.aistareco.aep.ipstudio.skill;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Intent routing (意图直达 2026-10-20): words outrank attachments, a unique best wins, no hit keeps the bound skill (else
 * none, 全能创作), a tie is left to the model — never a 400 that makes the UI ask which method.
 */
class StudioSkillRouterTest {
    static final Path FILE = Path.of("src/main/resources/studio/skills/reference-video-recreation.md");

    static StudioSkill skill(String key, String triggers) throws Exception {
        String text = Files.readString(FILE).replace("key: reference-video-recreation", "key: " + key);
        int start = text.indexOf("triggers:"), end = text.indexOf("\n---", start);
        return StudioSkillCatalog.parse(text.substring(0, start) + triggers + text.substring(end));
    }

    final StudioSkill video, script, plain;
    StudioSkillRouterTest() throws Exception {
        video = skill("video-recreation", "triggers:\n  media: [video]\n  keywords: [复刻, 拉片]\n  default: true");
        script = skill("script-rewrite", "triggers:\n  media: [text]\n  keywords: [改脚本, 文案]");
        plain = skill("poster", "triggers:\n  media: [image]\n  keywords: [海报]");
    }

    @Test void noActiveSkillMeansNoSkillAndASingleOneOnlyWhenTheMessageAsksForIt() {
        assertTrue(StudioSkillRouter.route(List.of(), Set.of("video"), "随便").isEmpty());
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(script), Set.of(), "帮我改脚本").orElseThrow().key());
        // The only skill on the shelf is still a method for one kind of job (local e2e 2026-10-19: 「生成商品宣传图」 bound 参考视频复刻).
        assertTrue(StudioSkillRouter.route(List.of(video), Set.of(), "生成商品宣传图，9:16").isEmpty());
        assertTrue(StudioSkillRouter.route(List.of(video), Set.of("image"), "做一张海报").isEmpty());
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video), Set.of("video", "image"), "照这条视频做").orElseThrow().key());
    }

    @Test void wordsOutrankAttachmentsAndAUniqueBestWins() {
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of(), "帮我改脚本").orElseThrow().key());
        assertEquals("poster", StudioSkillRouter.route(List.of(video, script, plain), Set.of("image"), "做一张").orElseThrow().key());
        // An attached video is material; 「文案」 says what to make of it. With media weighted double, a product photo plus
        // 「写一段文案」 used to become an image job.
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of("video"), "文案也看看").orElseThrow().key());
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video, script), Set.of("video", "text"), "复刻这条").orElseThrow().key());
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of(), "改脚本 TEXT").orElseThrow().key());
    }

    @Test void noHitIsTheGeneralDialogueNotTheDefault() {
        assertTrue(StudioSkillRouter.route(List.of(video, script), Set.of(), "你好").isEmpty());
        assertTrue(StudioSkillRouter.route(List.of(script, plain), Set.of(), "你好").isEmpty());
    }

    @Test void noHitKeepsTheSkillTheThreadAlreadyHasWhileItIsActive() throws Exception {
        assertEquals("poster", StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "再来一张，背景亮一点", plain).orElseThrow().key(),
                "a follow-up that names no job continues the current one");
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "帮我改脚本", plain).orElseThrow().key(),
                "a message that names another job switches");
        var withdrawn = skill("gone", "triggers:\n  media: []\n  keywords: []").withRuntime("withdrawn", 1);
        assertTrue(StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "谢谢", withdrawn).isEmpty(), "a withdrawn method never carries over");
        var offShelf = skill("off-shelf", "triggers:\n  media: []\n  keywords: []");
        assertTrue(StudioSkillRouter.route(List.of(video, script, plain), Set.of(), "谢谢", offShelf).isEmpty(), "nor one that is no longer offered");
    }

    @Test void aTieIsLeftToTheModelNotToADefaultOrA400() throws Exception {
        var both = skill("poster-recreation", "triggers:\n  media: [image]\n  keywords: [复刻]");
        assertTrue(StudioSkillRouter.route(List.of(both, video), Set.of(), "复刻一下").isEmpty(), "the default is a hint for the model, not a tie-break");
        assertTrue(StudioSkillRouter.route(List.of(script, plain, video), Set.of("text", "image"), "").isEmpty(), "two attachments, no words: the model decides");
        assertEquals("poster", StudioSkillRouter.route(List.of(script, plain, video), Set.of("text", "image"), "", plain).orElseThrow().key(),
                "…unless the thread is already on one of the tied methods: a tie never bumps the current job");
    }

    @Test void triggersParseLenientlyAndNeverReject() throws Exception {
        var odd = skill("odd", "triggers:\n  media: [video, hologram, 3]\n  keywords: [\"  复刻 \", \"\", 复刻]\n  default: yes-please");
        assertEquals(List.of("video"), odd.triggers().media());
        assertEquals(List.of("复刻"), odd.triggers().keywords());
        assertFalse(odd.triggers().defaultSkill());
        var notAMap = skill("odd2", "triggers: video");
        assertFalse(notAMap.triggers().declared());
        assertNull(notAMap.summaryDto().triggers());
        assertEquals("video", StudioSkillRouter.mediaOf("video"));
        assertEquals("audio", StudioSkillRouter.mediaOf("audio"));
        assertNull(StudioSkillRouter.mediaOf("config"));
    }
}
