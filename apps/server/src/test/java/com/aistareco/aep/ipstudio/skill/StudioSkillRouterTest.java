package com.aistareco.aep.ipstudio.skill;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** Intent routing for a thread without a skill: single, scored, tie / no hit → default, none → STUDIO_SKILL_REQUIRED. */
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

    @Test void noActiveSkillMeansNoSkillAndASingleOneIsAlwaysChosen() {
        assertTrue(StudioSkillRouter.route(List.of(), Set.of("video"), "随便").isEmpty());
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(script), Set.of("video"), "复刻").orElseThrow().key());
    }

    @Test void mediaAndKeywordsScoreAndAUniqueBestWins() {
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of(), "帮我改脚本").orElseThrow().key());
        assertEquals("poster", StudioSkillRouter.route(List.of(video, script, plain), Set.of("image"), "做一张").orElseThrow().key());
        // media counts double: an attached video outweighs one keyword for another skill
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video, script), Set.of("video"), "文案也看看").orElseThrow().key());
        assertEquals("script-rewrite", StudioSkillRouter.route(List.of(video, script), Set.of(), "改脚本 TEXT").orElseThrow().key());
    }

    @Test void tiesAndNoHitsFallBackToTheDefault() {
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(video, script), Set.of(), "你好").orElseThrow().key());
        assertEquals("video-recreation", StudioSkillRouter.route(List.of(script, plain, video), Set.of("text", "image"), "").orElseThrow().key(),
                "a tie between two others still goes to the default");
    }

    @Test void withoutADefaultTheUserIsAskedWithTheList() {
        var e = assertThrows(BusinessException.class, () -> StudioSkillRouter.route(List.of(script, plain), Set.of(), "你好"));
        assertEquals("STUDIO_SKILL_REQUIRED", e.getCode());
        assertEquals(400, e.getStatus().value());
        @SuppressWarnings("unchecked") var skills = (List<Map<String, String>>) ((Map<String, Object>) e.getDetails()).get("skills");
        assertEquals(List.of("script-rewrite", "poster"), skills.stream().map(s -> s.get("key")).toList());
        assertTrue(skills.stream().allMatch(s -> s.containsKey("name") && s.containsKey("summary")));
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
