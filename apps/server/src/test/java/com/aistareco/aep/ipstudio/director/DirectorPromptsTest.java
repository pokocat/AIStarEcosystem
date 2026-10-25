package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DirectorPromptsTest {

    @Test
    void scriptPromptAppendsChosenGenreAndToneRules() {
        String p = DirectorPrompts.script("奇幻脑洞", "治愈温情");
        assertTrue(p.startsWith(DirectorPrompts.SCRIPT));
        assertTrue(p.contains(DirectorPrompts.GENRES.get("奇幻脑洞")));
        assertTrue(p.contains(DirectorPrompts.TONES.get("治愈温情")));
        assertTrue(p.indexOf("【题材：奇幻脑洞】") < p.indexOf("【调性：治愈温情】"));
    }

    @Test
    void scriptPromptWithoutTagsIsTheBasePrompt() {
        assertEquals(DirectorPrompts.SCRIPT, DirectorPrompts.script(null, null));
        assertFalse(DirectorPrompts.SCRIPT.contains("三层反转"), "the reversal line is not a default for every genre");
        assertEquals(DirectorPrompts.SCRIPT, DirectorPrompts.script("不存在的题材", ""));
    }

    @Test
    void basePromptKeepsTheOutputContract() {
        // 编剧提示词换了写法，输出仍是导演台的 {title, logline, content}，后面的拆分 / 提取都读 content。
        assertTrue(DirectorPrompts.SCRIPT.contains("\"outline\":{\"world\""));
        assertTrue(DirectorPrompts.SCRIPT.contains("\"content\":\"完整剧本正文\"}"));
        assertEquals(6, DirectorPrompts.GENRES.size());
        assertEquals(5, DirectorPrompts.TONES.size());
    }

    @Test
    void scriptOutputKeepsTheOutlineAndToleratesItsAbsence() throws Exception {
        ObjectMapper om = new ObjectMapper();
        JsonNode meta = om.readTree("{\"task\":\"script\"}");
        String body = "\"content\":\"# 第1集 掉漆\\n## 第1场 莫高窟第17窟 · 深夜\\n陈默：钱我还在凑。\"";
        JsonNode with = DirectorPrompts.validate(om, meta, om.readTree("{\"title\":\"泥与光\",\"outline\":{\"world\":\"飞仙会动\",\"characters\":[{\"name\":\"陈默\",\"flaw\":\"爱面子\"},{\"name\":\"\"}],\"plot\":\"起承转合\"}," + body + "}"));
        assertEquals("飞仙会动", with.path("outline").path("world").asText());
        assertEquals(1, with.path("outline").path("characters").size(), "nameless characters are dropped");
        assertEquals("爱面子", with.path("outline").path("characters").get(0).path("flaw").asText());
        JsonNode without = DirectorPrompts.validate(om, meta, om.readTree("{\"title\":\"泥与光\"," + body + "}"));
        assertTrue(without.path("outline").isMissingNode());
    }

    @Test
    void planPromptFollowsTheModelLimits() {
        String multi = DirectorPrompts.plan(5, 15, 4);
        assertTrue(multi.contains("12–15 秒"), "range ends at the model maximum");
        assertTrue(multi.contains("3–4 个镜头"));
        assertTrue(multi.contains("正反打") && multi.contains("输出前强制校验") && multi.contains("去 AI 味镜头写实规则"));
        assertFalse(multi.contains("极致"), "no wording that pushes exaggerated expressions");
        assertFalse(multi.contains("放宽至 2 个镜头"), "shot count is not relaxed");
        assertTrue(multi.contains("action 不超过 80 字"), "length caps keep one episode inside the request time limit");
        assertTrue(DirectorPrompts.plan(4, 10, 4).contains("7–10 秒"), "a shorter model moves the range with it");
        String frame = DirectorPrompts.plan(5, 10, 1);
        assertTrue(frame.contains("只能有 1 个镜头"));
        assertFalse(frame.contains("禁止少于"), "first-frame models keep one shot per clip");
        assertTrue(frame.contains("去 AI 味镜头写实规则"), "realism rules apply to first-frame models too");
    }

    @Test
    void reversalLineOnlyForTwistToneAndSuspenseGenres() {
        assertTrue(DirectorPrompts.script(null, "反转烧脑").contains("【反转线】"));
        assertTrue(DirectorPrompts.script("都市悬疑", null).contains("【反转线】"));
        assertFalse(DirectorPrompts.script("市井情感", "治愈温情").contains("【反转线】"));
        assertTrue(DirectorPrompts.SCRIPT.contains("所有反转必须在前序剧情埋下可回溯的伏笔"), "foreshadowing rule stays for everyone");
    }

    // ── 分集：只认起点，区间由程序构造（2026-10-25 线上两单 AI_BAD_OUTPUT）──────────────

    private static JsonNode split(ObjectMapper om, int count, String output) throws Exception {
        return DirectorPrompts.validate(om, om.readTree("{\"task\":\"split\",\"paragraphCount\":" + count + "}"), om.readTree(output));
    }

    private static int[][] ranges(JsonNode r) {
        int[][] out = new int[r.path("episodes").size()][];
        for (int i = 0; i < out.length; i++) out[i] = new int[]{r.path("episodes").get(i).path("startParagraph").asInt(), r.path("episodes").get(i).path("endParagraph").asInt()};
        return out;
    }

    @Test
    void splitLastEpisodeRunsToTheEndEvenWhenTheModelStopsShort() throws Exception {
        // 《食神》：941 段，模型最后一集写到 939，漏了第 940 段「一箭穿心 剧终」。
        ObjectMapper om = new ObjectMapper();
        JsonNode r = split(om, 941, "{\"episodes\":[{\"startParagraph\":0,\"endParagraph\":312},{\"startParagraph\":313,\"endParagraph\":542},"
                + "{\"startParagraph\":543,\"endParagraph\":688},{\"startParagraph\":689,\"endParagraph\":896},{\"startParagraph\":897,\"endParagraph\":939}]}");
        assertArrayEquals(new int[][]{{0, 312}, {313, 542}, {543, 688}, {689, 896}, {897, 940}}, ranges(r));
        assertEquals(939, r.path("episodes").get(4).path("modelEnd").asInt(), "the model's own end is kept so the change can be shown");
        assertEquals(0, r.path("bodyStart").asInt());
    }

    @Test
    void splitKeepsReferenceMaterialBeforeTheFirstEpisode() throws Exception {
        // 《谁让这个睁眼瞎修仙的》：0～251 段是设定资料，模型从第 252 段的「第1集」开始分，没写 bodyStart。
        ObjectMapper om = new ObjectMapper();
        JsonNode r = split(om, 537, "{\"episodes\":[{\"startParagraph\":252,\"endParagraph\":310},{\"startParagraph\":311,\"endParagraph\":360},"
                + "{\"startParagraph\":361,\"endParagraph\":407},{\"startParagraph\":408,\"endParagraph\":470},{\"startParagraph\":471,\"endParagraph\":536}]}");
        assertEquals(252, r.path("bodyStart").asInt());
        assertArrayEquals(new int[][]{{252, 310}, {311, 360}, {361, 407}, {408, 470}, {471, 536}}, ranges(r));
    }

    @Test
    void splitMergesTheGapAfterAnExplicitBodyStartIntoTheFirstEpisode() throws Exception {
        ObjectMapper om = new ObjectMapper();
        JsonNode r = split(om, 20, "{\"bodyStart\":5,\"episodes\":[{\"startParagraph\":8},{\"startParagraph\":14}]}");
        assertEquals(5, r.path("bodyStart").asInt());
        assertEquals(8, r.path("headFrom").asInt());
        assertArrayEquals(new int[][]{{5, 13}, {14, 19}}, ranges(r));
        JsonNode early = split(om, 20, "{\"bodyStart\":9,\"episodes\":[{\"startParagraph\":3},{\"startParagraph\":12}]}");
        assertEquals(3, early.path("bodyStart").asInt(), "an episode that starts before bodyStart wins");
    }

    @Test
    void splitSortsDropsOutOfRangeAndMergesDuplicateStarts() throws Exception {
        ObjectMapper om = new ObjectMapper();
        JsonNode r = split(om, 30, "{\"episodes\":[{\"startParagraph\":20,\"title\":\"三\"},{\"startParagraph\":0,\"title\":\"一\"},"
                + "{\"startParagraph\":10,\"title\":\"二\"},{\"startParagraph\":10,\"title\":\"重复\"},{\"startParagraph\":99},{\"startParagraph\":\"x\"}]}");
        assertArrayEquals(new int[][]{{0, 9}, {10, 19}, {20, 29}}, ranges(r));
        assertEquals("二", r.path("episodes").get(1).path("title").asText(), "the first of duplicate starts is kept");
        assertEquals(2, r.path("dropped").asInt());
        assertEquals(1, r.path("duplicates").asInt());
    }

    @Test
    void splitFailsOnlyWhenNoStartIsUsable() throws Exception {
        ObjectMapper om = new ObjectMapper();
        BusinessException e = assertThrows(BusinessException.class, () -> split(om, 10, "{\"episodes\":[{\"startParagraph\":10},{\"startParagraph\":-1}]}"));
        assertEquals("AI_BAD_OUTPUT", e.getCode());
        assertEquals("AI_BAD_OUTPUT", assertThrows(BusinessException.class, () -> split(om, 10, "{\"episodes\":[]}")).getCode());
    }

    @Test
    void splitPromptAsksForStartsOnly() {
        assertTrue(DirectorPrompts.SPLIT.contains("\"bodyStart\":0,\"episodes\":[{\"title\":\"集名\",\"summary\":\"本集剧情摘要\",\"startParagraph\":0}]"));
        assertFalse(DirectorPrompts.SPLIT.contains("endParagraph"), "the model no longer writes where an episode ends");
    }

    private static List<String> script(int preamble, String... headings) {
        List<String> ps = new ArrayList<>();
        for (int i = 0; i < preamble; i++) ps.add("人物设定第 " + i + " 条：这是一段很长的设定说明，用来交代世界观和人物背景，不是要拍的剧情。");
        for (String h : headings) { ps.add(h); ps.add("场景：街口 · 日"); ps.add("甲：走吧。"); }
        return ps;
    }

    @Test
    void headingsAreFoundAfterReferenceMaterial() {
        List<String> ps = script(4, "# 第1集 下山", "## 第二集：进城", "【第3集】", "第 ４ 集 回山");
        assertEquals(List.of(4, 7, 10, 13), DirectorPrompts.headingStarts(ps));
    }

    @Test
    void headingsTakeTheLastRunSoAnOutlineInTheNotesIsSkipped() {
        // 设定资料里常有一份分集大纲「第1集…第2集…」，真正的分集标题在后面。
        List<String> ps = new ArrayList<>(List.of("分集大纲", "第1集 下山", "第2集 进城"));
        ps.addAll(script(0, "第1集 下山", "第2集 进城"));
        assertEquals(List.of(3, 6), DirectorPrompts.headingStarts(ps));
    }

    @Test
    void headingsNeedAnUnbrokenSequenceOfAtLeastTwo() {
        assertEquals(List.of(), DirectorPrompts.headingStarts(script(0, "第1集", "第3集")), "a gap goes to the model");
        assertEquals(List.of(), DirectorPrompts.headingStarts(script(0, "第1集")), "one heading is not a split");
        assertEquals(List.of(), DirectorPrompts.headingStarts(script(0, "第1场 街口", "第2场 屋里")), "scenes are not episodes");
        List<String> prose = script(0, "第1集", "第2集");
        prose.set(0, "第1集里他一句话都没说，直到最后才回头看了一眼，这一眼让在场的所有人都明白了他这些年藏在心里的那些心思。");
        assertEquals(List.of(), DirectorPrompts.headingStarts(prose), "a long paragraph is prose, not a heading");
    }

    @Test
    void headingTitleDropsTheEpisodeNumber() {
        assertEquals("下山", DirectorPrompts.headingTitle("# 第1集 下山"));
        assertEquals("进城", DirectorPrompts.headingTitle("## 第二集：进城"));
        assertEquals("回山", DirectorPrompts.headingTitle("【第3集】回山"));
        assertEquals("", DirectorPrompts.headingTitle("第4集"));
    }

    @Test
    void chineseEpisodeNumbers() {
        assertEquals(10, DirectorPrompts.number("十"));
        assertEquals(12, DirectorPrompts.number("十二"));
        assertEquals(20, DirectorPrompts.number("二十"));
        assertEquals(103, DirectorPrompts.number("一百零三"));
        assertEquals(2, DirectorPrompts.number("两"));
        assertEquals(12, DirectorPrompts.number("１２"));
    }
}
