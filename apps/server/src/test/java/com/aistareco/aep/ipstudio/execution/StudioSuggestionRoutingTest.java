package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.ipstudio.skill.StudioSkillRouter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Our own follow-ups must reach the job they name. Production 2026-10-21 14:10: after a picture, the user clicked
 * 「用这张图做一段视频」 (offered by {@link StudioExecutionSummary#suggestions}) and the thread stayed on 出图 — no
 * keyword of 出视频 matched, both skills scored the same for the image, and a tie keeps the current skill.
 *
 * <p>Routing runs against the real repository skill files. A clicked suggestion is sent as plain text without pinned nodes
 * (web-aiavatar sends follow-ups without the draft's references), so those cases use no media; the picture follow-ups are
 * also checked with an image pinned, as when the user types the same words with the picture selected.
 */
class StudioSuggestionRoutingTest {
    private final ObjectMapper om = new ObjectMapper();
    private final List<StudioSkill> active = new StudioSkillCatalog().available();

    private StudioSkill skill(String key) { return active.stream().filter(s -> s.key().equals(key)).findFirst().orElseThrow(); }

    private String route(Set<String> media, String text, String bound) {
        return StudioSkillRouter.route(active, media, text, bound == null ? null : skill(bound)).map(StudioSkill::key).orElse(null);
    }

    private IpPlanExecution execution(String status) { return IpPlanExecution.builder().id("PEX-1").status(status).build(); }

    /** Steps as (operation, status, title) triples. */
    private ObjectNode state(String... triples) {
        var state = om.createObjectNode();
        var steps = state.putArray("steps");
        for (int i = 0; i < triples.length; i += 3)
            steps.addObject().put("id", "s" + i / 3).put("stage", "production").put("operation", triples[i]).put("status", triples[i + 1])
                    .put("title", triples[i + 2]).putArray("runIds");
        return state;
    }

    /** Every suggestion the summary can produce, from executions that make each of them. */
    private Set<String> allSuggestions() {
        Set<String> out = new LinkedHashSet<>();
        out.addAll(StudioExecutionSummary.suggestions(execution("done"), state("image", "done", "人物正面图")));
        out.addAll(StudioExecutionSummary.suggestions(execution("done"), state("image", "done", "正面图", "image", "done", "三视图")));
        out.addAll(StudioExecutionSummary.suggestions(execution("done"), state("video", "done", "开场镜头", "video", "done", "结尾镜头")));
        out.addAll(StudioExecutionSummary.suggestions(execution("done"), state("video", "done", "开场镜头", "video", "done", "结尾镜头", "assemble", "done", "合成")));
        var landscape = state("video", "done", "开场镜头", "video", "done", "结尾镜头", "assemble", "done", "合成");
        ((ObjectNode) landscape.path("steps").get(0)).putObject("definition").putObject("settings").put("aspectRatio", "16:9");
        out.addAll(StudioExecutionSummary.suggestions(execution("done"), landscape));
        var checked = state("video", "done", "开场镜头", "check", "done", "检查开场镜头");
        ((ObjectNode) checked.path("steps").get(1)).put("checkStatus", "fail").putObject("definition").putObject("settings").put("targetStepId", "s0");
        out.addAll(StudioExecutionSummary.suggestions(execution("done"), checked));
        out.addAll(StudioExecutionSummary.suggestions(execution("failed"), state("text", "done", "开场旁白", "video", "failed", "开场镜头")));
        out.addAll(StudioExecutionSummary.suggestions(execution("failed"), state("video", "failed", "开场镜头")));
        return out;
    }

    @Test void theSuggestionsUnderTestAreTheOnesTheSummaryReallyMakes() {
        assertEquals(Set.of("用这张图做一段视频", "换个风格再出一张", "用这些图做一段视频", "换个风格再出一组", "把做好的片段合成一条成片",
                "把这张画布存为模板", "把这条成片存为模板", "换成 16:9 横屏再出一版", "换成 9:16 竖屏再出一版", "重做第 1 段「开场镜头」",
                "接着做没完成的「开场镜头」", "把「开场旁白」再改得精炼一些", "再试一次"), allSuggestions(),
                "a new suggestion in StudioExecutionSummary needs a routing expectation here");
    }

    @Test void aPictureFollowUpGoesToTheJobItNames() {
        List<String> bounds = Arrays.asList(null, "image-generation", "video-generation", "script-writing", "reference-video-recreation");
        for (Set<String> media : List.of(Set.<String>of(), Set.of("image")))
            for (String bound : bounds) {
                String where = "media=" + media + " bound=" + bound;
                assertEquals("video-generation", route(media, "用这张图做一段视频", bound), where);
                assertEquals("video-generation", route(media, "用这些图做一段视频", bound), where);
                assertEquals("image-generation", route(media, "换个风格再出一张", bound), where);
                assertEquals("image-generation", route(media, "换个风格再出一组", bound), where);
            }
    }

    /** The rest name no new job: they continue the method the thread is on (a clicked follow-up carries no pinned node). */
    @Test void theOtherFollowUpsKeepTheCurrentMethod() {
        Set<String> picture = Set.of("用这张图做一段视频", "用这些图做一段视频", "换个风格再出一张", "换个风格再出一组");
        for (String suggestion : allSuggestions()) {
            if (picture.contains(suggestion)) continue;
            for (String bound : List.of("video-generation", "reference-video-recreation", "image-generation", "script-writing"))
                assertEquals(bound, route(Set.of(), suggestion, bound), suggestion + " on " + bound);
            assertNull(route(Set.of(), suggestion, null), suggestion + ": names no job, so no method is forced on an unbound thread");
        }
    }

    /** The new 出视频 words do not take messages that are another job's (docs/ip-studio-dialogue-intents.md §7 included). */
    @Test void theNewVideoWordsDoNotTakeOtherJobs() {
        assertEquals("script-writing", route(Set.of(), "写一段视频脚本，30 秒", null));
        assertEquals("script-writing", route(Set.of(), "帮我写一个视频口播稿", "video-generation"));
        assertEquals("reference-video-recreation", route(Set.of("video"), "照这条做一段视频", null));
        assertEquals("reference-video-recreation", route(Set.of("video", "image"), "复刻这条，换成我的保温杯", null));
        // A reference video plus a product picture also scores 出视频's image: with a video word this is a tie, which the
        // model settles by the intent table (never a wrong method forced on the thread), and never bumps a thread on 复刻.
        assertNotEquals("video-generation", route(Set.of("video", "image"), "复刻这条，换成我的保温杯，做一个视频", null));
        assertEquals("reference-video-recreation", route(Set.of("video", "image"), "复刻这条，换成我的保温杯，做一个视频", "reference-video-recreation"));
        assertEquals("image-generation", route(Set.of(), "画一张国风少女海报，9:16", null));
        assertEquals("image-generation", route(Set.of(), "帮我做个封面，内容是「夏日特饮上新」", null));
        assertEquals("video-generation", route(Set.of("text"), "画布上的这段剧本，出成视频", null));
        assertEquals("video-generation", route(Set.of(), "帮我做个视频", "image-generation"));
        assertEquals("video-generation", route(Set.of("image"), "把这张图生成一段视频", "image-generation"));
        assertEquals("video-generation", route(Set.of("image"), "这些图做成一段视频", "image-generation"));
        assertEquals("image-generation", route(Set.of(), "再来一张，背景亮一点", "image-generation"));
    }
}
