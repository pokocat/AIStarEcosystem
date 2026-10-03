package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageTarget;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.aistareco.aep.service.DramaCanvasRunTestSupport.OM;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.resourcePrompts;
import static com.aistareco.aep.service.DramaCanvasRunTestSupport.sampleDoc;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 画布提示词拼装与输出校验（纯逻辑）：参考图收集与裁剪、各阶段的前置校验、模型输出的形状校验。
 * 模板用真 PromptService 走 resources 默认（顺带钉死 10 个 .md 都在 classpath 上、占位符都填得进去）。
 */
class DramaCanvasPromptBuilderTest {

    private final DramaCanvasPromptBuilder builder = new DramaCanvasPromptBuilder(resourcePrompts());

    /** 模板填充替身：把 vars 原样带出来，方便断言。 */
    private final Map<String, Map<String, String>> filled = new LinkedHashMap<>();
    private final DramaCanvasPromptBuilder.MediaFill fill = (key, vars, kind) -> {
        filled.put(key, new LinkedHashMap<>(vars));
        return key + "::" + vars;
    };

    // ── 模板 ──────────────────────────────────────────────────────────────────

    @Test
    void allCanvasTemplatesResolveFromResource() {
        PromptService ps = resourcePrompts();
        for (String key : List.of(PromptService.KEY_DRAMA_CANVAS_SCRIPT_SETTING, PromptService.KEY_DRAMA_CANVAS_SCRIPT_OUTLINE,
                PromptService.KEY_DRAMA_CANVAS_SCRIPT_EPISODE, PromptService.KEY_DRAMA_CANVAS_EXTRACT,
                PromptService.KEY_DRAMA_CANVAS_STORYBOARD, PromptService.KEY_DRAMA_CANVAS_LOOK_IMAGE,
                PromptService.KEY_DRAMA_CANVAS_SCENE_IMAGE, PromptService.KEY_DRAMA_CANVAS_MATERIAL_IMAGE,
                PromptService.KEY_DRAMA_CANVAS_FRAME_IMAGE, PromptService.KEY_DRAMA_CANVAS_SEGMENT_VIDEO)) {
            PromptService.ResolvedPrompt p = ps.resolve(key);
            assertEquals("resource", p.origin(), key + " 应能从 .md 解析（否则 503 PROMPT_NOT_CONFIGURED）");
            assertFalse(p.userTemplate().isBlank(), key);
            assertTrue(PromptService.KNOWN_KEYS.contains(key), key + " 要进 KNOWN_KEYS（后台列得出、seeder 会落库）");
        }
    }

    // ── 出图：参考图收集 ───────────────────────────────────────────────────────

    @Test
    void lookImage_collectsEdgeRefsInOrder_textMaterialGoesIntoPrompt_trimsToMax() {
        DramaCanvasPromptBuilder.ImageCompile ic = builder.image(sampleDoc(), "9:16",
                new CanvasImageTarget("look", "lk1", null, null), null, 1, k -> true, fill);

        assertEquals("look:lk1", ic.target());
        assertEquals("9:16", ic.ratio(), "造型缺省 9:16");
        // 连线顺序：sc1（场景图）→ m2（文字，不是图）→ m1（素材图）
        assertEquals(List.of("drama/canvas/scenes/b.png", "drama/canvas/materials/c.png"), ic.requestedKeys());
        assertEquals(List.of("drama/canvas/scenes/b.png"), ic.appliedKeys(), "按上限 1 张裁剪");
        assertTrue(ic.notes().stream().anyMatch(n -> n.contains("参考图超过 1 张")), ic.notes().toString());
        Map<String, String> vars = filled.get(PromptService.KEY_DRAMA_CANVAS_LOOK_IMAGE);
        assertTrue(vars.get("textClause").contains("盒子上有划痕"), "文字素材拼进提示词");
        assertEquals("林微·成年", vars.get("name"));
        assertTrue(vars.get("refClause").contains("图1 = 旧教室"));
        assertTrue(vars.get("styleClause").contains("90 年代写实电影风格"));
    }

    @Test
    void lookImage_undeliverableRefIsNotAppliedAndSaysSo() {
        DramaCanvasPromptBuilder.ImageCompile ic = builder.image(sampleDoc(), "9:16",
                new CanvasImageTarget("look", "lk1", null, null), "3:4", 6,
                k -> !k.contains("scenes"), fill);
        assertEquals("3:4", ic.ratio());
        assertEquals(2, ic.requestedKeys().size(), "取不到的也要进归属闸");
        assertEquals(List.of("drama/canvas/materials/c.png"), ic.appliedKeys());
        assertTrue(ic.notes().stream().anyMatch(n -> n.contains("地址模型取不到")), ic.notes().toString());
    }

    @Test
    void segmentFrame_refsFromAtMentionsInOrderDeduped_ratioForcedToCanvas() {
        DramaCanvasPromptBuilder.ImageCompile ic = builder.image(sampleDoc(), "16:9",
                new CanvasImageTarget("segment", null, 1, "sg1"), "1:1", 6, k -> true, fill);
        assertEquals("frame:1:sg1", ic.target());
        assertEquals("16:9", ic.ratio(), "首帧强制跟画布，忽略请求的画幅");
        // 文本里先 @ 场景、再 @ 造型（造型 @ 了两次只算一次）
        assertEquals(List.of("drama/canvas/scenes/b.png", "drama/canvas/looks/a.png"), ic.requestedKeys());
        Map<String, String> vars = filled.get(PromptService.KEY_DRAMA_CANVAS_FRAME_IMAGE);
        assertFalse(vars.get("firstShot").contains("秒"), "第一镜去掉时长前缀：" + vars.get("firstShot"));
        assertFalse(vars.get("segmentText").contains("@["), "拼提示词时 @ 标记换成名字");
        assertTrue(vars.get("segmentText").contains("（3 秒）"), "保留每行时长");
    }

    @Test
    void segmentFrame_unknownRefIdIsNotedNotCounted() {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("episodes").get(0).path("segments").get(1))
                .put("text", "（5 秒）远景，@[陌生人](look:lk_gone) 走过。");
        DramaCanvasPromptBuilder.ImageCompile ic = builder.image(doc, "9:16",
                new CanvasImageTarget("segment", null, 1, "sg2"), null, 6, k -> true, fill);
        assertTrue(ic.requestedKeys().isEmpty());
        assertTrue(ic.notes().stream().anyMatch(n -> n.contains("陌生人")), ic.notes().toString());
    }

    @Test
    void textMaterialCannotBeImaged_400() {
        BusinessException e = assertThrows(BusinessException.class, () -> builder.image(sampleDoc(), "9:16",
                new CanvasImageTarget("material", "m2", null, null), null, 6, k -> true, fill));
        assertEquals("DRAMA_CANVAS_MATERIAL_NOT_IMAGE", e.getCode());
    }

    @Test
    void invalidRatio_400() {
        BusinessException e = assertThrows(BusinessException.class, () -> builder.image(sampleDoc(), "9:16",
                new CanvasImageTarget("scene", "sc1", null, null), "21:9", 6, k -> true, fill));
        assertEquals("DRAMA_CANVAS_RATIO_INVALID", e.getCode());
    }

    // ── 文字类：前置校验 ───────────────────────────────────────────────────────

    @Test
    void lockedEpisode_409_missingEpisode_404() {
        BusinessException locked = assertThrows(BusinessException.class, () -> builder.episode(sampleDoc(), 2, null));
        assertEquals("DRAMA_CANVAS_EPISODE_LOCKED", locked.getCode());
        BusinessException missing = assertThrows(BusinessException.class, () -> builder.episode(sampleDoc(), 9, null));
        assertEquals("DRAMA_CANVAS_EPISODE_NOT_FOUND", missing.getCode());
        // 只在分集剧情里、还没有正文的集可以写
        DramaCanvasPromptBuilder.TextPlan plan = builder.episode(sampleDoc(), 3, "节奏再快一点");
        assertEquals("script:episode:3", plan.target());
        assertTrue(plan.calls().get(0).user().contains("节奏再快一点"));
        assertTrue(plan.calls().get(0).user().contains("梗概3"), "带上这一集的分集剧情");
        assertTrue(plan.calls().get(0).user().contains("现在写第 3 集"));
    }

    @Test
    void settingNeedsIdea_instructionMax200() {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("script")).remove("idea");
        assertEquals("DRAMA_CANVAS_IDEA_EMPTY",
                assertThrows(BusinessException.class, () -> builder.setting(doc, null)).getCode());
        String tooLong = "快".repeat(201);
        assertEquals("DRAMA_CANVAS_INSTRUCTION_TOO_LONG",
                assertThrows(BusinessException.class, () -> builder.setting(sampleDoc(), tooLong)).getCode());
    }

    @Test
    void outline_chunksBy20_laterChunksCarryPrevious() {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("script")).put("targetEpisodes", 45);
        DramaCanvasPromptBuilder.TextPlan plan = builder.outline(doc, null);
        assertEquals(3, plan.calls().size());
        assertTrue(plan.calls().get(0).user().contains("这次写第 1 到第 20 集"));
        assertFalse(plan.calls().get(0).user().contains(DramaCanvasPromptBuilder.CARRY));
        assertTrue(plan.calls().get(2).user().contains("这次写第 41 到第 45 集"));
        assertTrue(plan.calls().get(1).user().contains(DramaCanvasPromptBuilder.CARRY));
        assertEquals(41, plan.meta().path("chunks").get(2).path("fromNo").asInt());

        ObjectNode noSetting = sampleDoc();
        ((ObjectNode) noSetting.path("script")).remove("setting");
        assertEquals("DRAMA_CANVAS_SETTING_EMPTY",
                assertThrows(BusinessException.class, () -> builder.outline(noSetting, null)).getCode());
    }

    @Test
    void extract_emptyScript_400_andBatchesLongScripts() {
        ObjectNode empty = sampleDoc();
        ((ObjectNode) empty.path("script")).putArray("episodes");
        assertEquals("DRAMA_CANVAS_SCRIPT_EMPTY",
                assertThrows(BusinessException.class, () -> builder.extract(empty)).getCode());

        ObjectNode big = sampleDoc();
        var eps = ((ObjectNode) big.path("script")).putArray("episodes");
        for (int i = 1; i <= 3; i++) {
            eps.addObject().put("no", i).put("title", "t" + i).put("text", "字".repeat(7000));
        }
        DramaCanvasPromptBuilder.TextPlan plan = builder.extract(big);
        assertEquals(3, plan.calls().size(), "每批不超过 12000 字");
        assertTrue(plan.calls().get(1).user().contains("第 2 集"));
        assertEquals("林微", plan.meta().path("existing").path("characters").get(0).path("name").asText());
    }

    // ── 输出校验 ──────────────────────────────────────────────────────────────

    @Test
    void parseOutline_countMustMatch_andRenumbers() {
        String two = "{\"episodes\":[{\"no\":1,\"title\":\"a\",\"hook\":\"h\",\"summary\":\"s\"},"
                + "{\"no\":2,\"title\":\"b\",\"hook\":\"h\",\"summary\":\"s\"}]}";
        assertEquals("AI_CALL_FAILED",
                assertThrows(BusinessException.class, () -> DramaCanvasPromptBuilder.parseOutline(two, 21, 23)).getCode());
        var ok = DramaCanvasPromptBuilder.parseOutline("```json\n" + two + "\n```", 21, 22);
        assertEquals(21, ok.get(0).path("no").asInt());
        assertEquals(22, ok.get(1).path("no").asInt());
        assertEquals("AI_CALL_FAILED", assertThrows(BusinessException.class,
                () -> DramaCanvasPromptBuilder.parseOutline("这不是 JSON", 1, 1)).getCode());
    }

    @Test
    void parseSettingAndEpisode_requireText() {
        assertEquals("AI_CALL_FAILED",
                assertThrows(BusinessException.class, () -> DramaCanvasPromptBuilder.parseSetting("{\"text\":\"  \"}")).getCode());
        JsonNode ep = DramaCanvasPromptBuilder.parseEpisode("{\"text\":\"### 场3-1\"}", 3, "和解");
        assertEquals("和解", ep.path("title").asText(), "标题缺了用文档里已有的标题");
        assertEquals(3, ep.path("no").asInt());
    }

    @Test
    void parseExtract_validatesShape_dropsBadEpisodes_mergesByName() {
        String badRole = "{\"characters\":[{\"name\":\"林微\",\"role\":\"hero\",\"bio\":\"\",\"looks\":[{\"name\":\"基础造型\",\"prompt\":\"p\",\"episodes\":[1]}]}],\"scenes\":[]}";
        assertEquals("AI_CALL_FAILED", assertThrows(BusinessException.class,
                () -> DramaCanvasPromptBuilder.parseExtractBatch(badRole, 3)).getCode());
        String noLooks = "{\"characters\":[{\"name\":\"林微\",\"role\":\"lead\",\"looks\":[]}],\"scenes\":[]}";
        assertEquals("AI_CALL_FAILED", assertThrows(BusinessException.class,
                () -> DramaCanvasPromptBuilder.parseExtractBatch(noLooks, 3)).getCode());

        JsonNode a = DramaCanvasPromptBuilder.parseExtractBatch(
                "{\"characters\":[{\"name\":\"林微\",\"role\":\"support\",\"bio\":\"老师\",\"looks\":[{\"name\":\"基础造型\",\"prompt\":\"p1\",\"episodes\":[1,9]}]}],"
                        + "\"scenes\":[{\"name\":\"旧教室\",\"prompt\":\"s1\",\"episodes\":[1]}],\"notes\":[\"n1\"]}", 3);
        assertTrue(a.path("notes").toString().contains("9"), "超出集数的丢掉并说明");
        assertEquals("[1]", a.path("characters").get(0).path("looks").get(0).path("episodes").toString());
        JsonNode b = DramaCanvasPromptBuilder.parseExtractBatch(
                "{\"characters\":[{\"name\":\"林微\",\"role\":\"主角\",\"bio\":\"\",\"looks\":[{\"name\":\"基础造型\",\"prompt\":\"p2\",\"episodes\":[3]},"
                        + "{\"name\":\"学生时期\",\"prompt\":\"p3\",\"episodes\":[2]}]}],"
                        + "\"scenes\":[{\"name\":\"旧教室\",\"prompt\":\"s2\",\"episodes\":[2]}],\"notes\":[\"n1\"]}", 3);
        List<JsonNode> batches = new ArrayList<>(List.of(a, b));
        JsonNode m = DramaCanvasPromptBuilder.mergeExtract(batches);
        JsonNode ch = m.path("characters").get(0);
        assertEquals(1, m.path("characters").size());
        assertEquals("lead", ch.path("role").asText(), "角色定位取更重要的");
        assertEquals("老师", ch.path("bio").asText());
        assertEquals(2, ch.path("looks").size());
        assertEquals("p1", ch.path("looks").get(0).path("prompt").asText(), "先出现的描述保留");
        assertEquals("[1,3]", ch.path("looks").get(0).path("episodes").toString(), "出现集数取并集");
        assertEquals("[1,2]", m.path("scenes").get(0).path("episodes").toString());
        long n1 = 0;
        for (JsonNode n : m.path("notes")) if ("n1".equals(n.asText())) n1++;
        assertEquals(1, n1, "notes 去重");
    }

    @Test
    void parseStoryboard_fixesUnknownRefs_clampsAndSplitsByShot() {
        ObjectNode ids = OM.createObjectNode();
        ids.putArray("look").add("lk1");
        ids.putArray("scene").add("sc1");
        ids.putArray("material");
        String content = "{\"segments\":["
                + "{\"text\":\"(4秒)日，@[旧教室](scene:sc1)。@[林微·成年](look:lk1) 蹲着。\\n（时长：3.0 秒）特写，@[路人](look:lk_x) 走过。\",\"durationSec\":99},"
                + "{\"text\":\"（6 秒）一\\n（6 秒）二\\n（14 秒）三\",\"durationSec\":26}"
                + "],\"notes\":[]}";
        JsonNode sb = DramaCanvasPromptBuilder.parseStoryboard(content, 1, 10, 4, ids);
        JsonNode segs = sb.path("segments");
        assertEquals(7, segs.get(0).path("durationSec").asInt(), "片段时长 = 各行之和，不信模型报的数");
        String t0 = segs.get(0).path("text").asText();
        assertTrue(t0.startsWith("（4 秒）"), "行首时长规范成「（N 秒）」：" + t0);
        assertTrue(t0.contains("@[林微·成年](look:lk1)"), "合法引用保留");
        assertFalse(t0.contains("lk_x"), "文档里没有的 id 换成纯文字");
        assertTrue(t0.contains("路人"));
        // 第二段 6+6+14：14 秒的镜头超上限改成 10 秒；6+6=12 也超上限 → 按镜头拆成 6 / 6 / 10 三段
        assertEquals(4, segs.size());
        assertEquals(6, segs.get(1).path("durationSec").asInt());
        assertEquals(6, segs.get(2).path("durationSec").asInt());
        assertEquals(10, segs.get(3).path("durationSec").asInt());
        assertTrue(segs.get(3).path("text").asText().startsWith("（10 秒）"));
        String notes = sb.path("notes").toString();
        assertTrue(notes.contains("路人"), notes);
        assertTrue(notes.contains("拆成了"), notes);
        assertTrue(notes.contains("改成了 10 秒"), notes);
        for (JsonNode s : segs) assertTrue(s.path("durationSec").asInt() <= 10);

        assertEquals("AI_CALL_FAILED", assertThrows(BusinessException.class,
                () -> DramaCanvasPromptBuilder.parseStoryboard("{\"segments\":[]}", 1, 10, 4, ids)).getCode());
    }

    @Test
    void storyboard_needsScriptText_tableListsDocIds() {
        DramaCanvasPromptBuilder.TextPlan plan = builder.storyboard(sampleDoc(), 1, 10, 5);
        String user = plan.calls().get(0).user();
        assertTrue(user.contains("@[林微·成年](look:lk1)"), user);
        assertTrue(user.contains("@[旧教室](scene:sc1)"));
        assertTrue(user.contains("不少于 5 秒") && user.contains("不超过 10 秒"), "上下限都填进提示词：" + user);
        assertFalse(user.contains("{{"), "占位符都填上了");
        assertEquals("[\"lk1\"]", plan.meta().path("ids").path("look").toString());
        assertEquals(5, plan.meta().path("minSec").asInt(), "下限随 meta 带给装段校验");
        assertEquals(10, builder.storyboard(sampleDoc(), 1, 10, 30).meta().path("minSec").asInt(), "下限不超过上限");

        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("script").path("episodes").get(0)).put("text", " ");
        assertEquals("DRAMA_CANVAS_SCRIPT_EMPTY",
                assertThrows(BusinessException.class, () -> builder.storyboard(doc, 1, 10, 4)).getCode());
    }

    // ── 分镜：比视频模型下限短的片段并进相邻片段（v0.198.1） ─────────────────────

    private static ObjectNode noIds() {
        ObjectNode ids = OM.createObjectNode();
        ids.putArray("look");
        ids.putArray("scene");
        ids.putArray("material");
        return ids;
    }

    private static String segs(String... texts) {
        StringBuilder sb = new StringBuilder("{\"segments\":[");
        for (int i = 0; i < texts.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"text\":\"").append(texts[i]).append("\"}");
        }
        return sb.append("],\"notes\":[]}").toString();
    }

    private static List<Integer> durations(JsonNode sb) {
        List<Integer> out = new ArrayList<>();
        sb.path("segments").forEach(s -> out.add(s.path("durationSec").asInt()));
        return out;
    }

    @Test
    void parseStoryboard_shortSegmentMergesIntoNext_repeatedlyWhileStillShort() {
        // 2 + 2 = 4 还不够 5 → 再并进 6 → 10（不超过上限）；最后那段 6 秒够长不动
        JsonNode sb = DramaCanvasPromptBuilder.parseStoryboard(
                segs("（2 秒）甲", "（2 秒）乙", "（6 秒）丙", "（6 秒）丁"), 1, 10, 5, noIds());
        assertEquals(List.of(10, 6), durations(sb));
        assertEquals("（2 秒）甲\n（2 秒）乙\n（6 秒）丙", sb.path("segments").get(0).path("text").asText(),
                "按顺序接起来，内容不改");
        assertEquals(2, sb.path("notes").size(), "并了两次，各说一句");
    }

    @Test
    void parseStoryboard_shortLastSegmentMergesIntoPrevious() {
        JsonNode sb = DramaCanvasPromptBuilder.parseStoryboard(segs("（6 秒）甲", "（3 秒）乙"), 1, 10, 5, noIds());
        assertEquals(List.of(9), durations(sb));
        assertEquals("（6 秒）甲\n（3 秒）乙", sb.path("segments").get(0).path("text").asText());
        assertEquals(1, sb.path("notes").size());
    }

    @Test
    void parseStoryboard_shortSegmentThatFitsNowhere_isKeptAndNoted() {
        // 3 + 9 = 12 两边都超上限 10：保留原样，说明要写长一点
        JsonNode sb = DramaCanvasPromptBuilder.parseStoryboard(
                segs("（9 秒）甲", "（3 秒）乙", "（9 秒）丙"), 1, 10, 5, noIds());
        assertEquals(List.of(9, 3, 9), durations(sb));
        assertEquals("（3 秒）乙", sb.path("segments").get(1).path("text").asText());
        assertEquals(1, sb.path("notes").size());
    }

    // ── 模型输出的 JSON 修复（v0.198.1：拆角色线上每次都败在漏写的一个括号上） ─────────

    private static final String CHAR_B = "{\"name\":\"人物乙\",\"role\":\"support\",\"bio\":\"女儿\",\"looks\":["
            + "{\"name\":\"基础造型\",\"prompt\":\"基本信息：女，8 岁\",\"episodes\":[2]}]}";
    private static final String SCENES_NOTES = "\"scenes\":[{\"name\":\"旧街\",\"prompt\":\"老街，傍晚\",\"episodes\":[1]}],"
            + "\"notes\":[\"n1\"]";

    @Test
    void parseExtract_looksArrayMissingItsCloser_isRepaired() {
        // 线上原样的形状：第一个角色的 looks 没有 ]，后面跟着第二个角色、scenes、notes
        String broken = "{\"characters\":[{\"name\":\"人物甲\",\"role\":\"lead\",\"bio\":\"女侦探\",\"looks\":["
                + "{\"name\":\"基础造型\",\"prompt\":\"基本信息：女，30 岁\",\"episodes\":[1,2]}},"
                + CHAR_B + "]," + SCENES_NOTES + "}";
        JsonNode ex = DramaCanvasPromptBuilder.parseExtractBatch(broken, 3);
        assertEquals(2, ex.path("characters").size());
        assertEquals("人物乙", ex.path("characters").get(1).path("name").asText(), "后面的角色没被吞掉");
        assertEquals(1, ex.path("characters").get(0).path("looks").size());
        assertEquals(1, ex.path("scenes").size());
        assertEquals("n1", ex.path("notes").get(0).asText());
    }

    @Test
    void parseExtract_missingFinalBrace_keepsEverythingAfterTheLastInnerBrace() {
        // 只差最外层的 }：按「最后一个 }」截会丢掉 notes；从第一个 { 到结尾补括号才完整
        String noFinal = "```json\n{\"characters\":[" + CHAR_B + "]," + SCENES_NOTES + "\n```";
        JsonNode ex = DramaCanvasPromptBuilder.parseExtractBatch(noFinal, 3);
        assertEquals(1, ex.path("characters").size());
        assertEquals(1, ex.path("scenes").size());
        assertEquals("n1", ex.path("notes").get(0).asText());
    }

    @Test
    void readJsonObject_doesNotCutAtLastBraceWhenWhatFollowsIsUnfinishedJson() {
        // Codex 评审 P1：最后一个 } 是第一段的结尾，后面是没写完的第二段；切掉再补括号会得到只有一段的「合法」分镜
        String cut = "{\"segments\":[{\"text\":\"（5 秒）甲\",\"durationSec\":5},{\"text\":\"unfinished";
        assertEquals("AI_CALL_FAILED", assertThrows(BusinessException.class,
                () -> DramaCanvasPromptBuilder.readJsonObject(cut)).getCode());
        // 结尾跟的是纯说明文字时照样能修
        JsonNode ok = DramaCanvasPromptBuilder.readJsonObject("{\"a\":[{\"b\":1}} 以上是结果，供参考");
        assertEquals(1, ok.path("a").get(0).path("b").asInt());
    }

    @Test
    void parseStoryboard_mergeUsesExactSecondsAndRoundsOnce() {
        // Codex 评审 P2：两段 2.1 秒各自取整是 3 + 3 = 6 > 上限 5，并不进去；精确和 4.2 → 5 秒，并得进
        JsonNode sb = DramaCanvasPromptBuilder.parseStoryboard(segs("（2.1 秒）甲", "（2.1 秒）乙"), 1, 5, 5, noIds());
        assertEquals(List.of(5), durations(sb));
        // 2.1 + 4.1 = 6.2 → 7 秒，不是 3 + 5 = 8（按秒计费，多算一秒就多扣一秒的钱）
        JsonNode sb2 = DramaCanvasPromptBuilder.parseStoryboard(segs("（2.1 秒）甲", "（4.1 秒）乙"), 1, 10, 5, noIds());
        assertEquals(List.of(7), durations(sb2));
        assertTrue(sb2.path("segments").get(0).path("_exactSec").isMissingNode(), "内部字段不出 wire");
    }

    @Test
    void readJsonObject_unrepairable_stillAiCallFailed() {
        for (String bad : List.of("{\"a\":1]}", "{\"text\":\"没写完", "[1,2]", "就是一句话")) {
            assertEquals("AI_CALL_FAILED", assertThrows(BusinessException.class,
                    () -> DramaCanvasPromptBuilder.readJsonObject(bad)).getCode(), bad);
        }
    }

    // ── 提示词：拆角色看得到人物小传；上一集结尾只是前情 ─────────────────────────────

    @Test
    void extract_promptCarriesTheSettingSoGenderFollowsIt() {
        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("script").path("setting")).put("text", "人物小传：\n人物甲：女，30 岁，侦探");
        String user = builder.extract(doc).calls().get(0).user();
        assertTrue(user.contains("人物甲：女，30 岁，侦探"), user);
        assertTrue(user.indexOf("人物甲：女") < user.indexOf("### 场1-1"), "大纲放在剧本前面");

        ObjectNode noSetting = sampleDoc();
        ((ObjectNode) noSetting.path("script")).remove("setting");
        assertFalse(builder.extract(noSetting).calls().get(0).user().contains("{{"), "没有大纲时变量填空");
    }

    @Test
    void episode_previousTailIsAPremise_notSomethingToContinue() {
        // 写第 3 集：第 2 集有正文 → 带上它的结尾（第 2 集锁着不影响拿它当前情）
        String user = builder.episode(sampleDoc(), 3, null).calls().get(0).user();
        assertTrue(user.contains("陈屹走来"), "带上上一集结尾：" + user);
        assertFalse(user.contains("接着它往下写"), "不再让模型续写上一集那一场");
    }

    @Test
    void carryForOutline_usesLastEpisodesOfPreviousChunks() {
        ObjectNode meta = OM.createObjectNode().put("stage", "outline");
        var done = DramaCanvasPromptBuilder.parseOutline(
                "{\"episodes\":[{\"title\":\"甲\",\"hook\":\"h\",\"summary\":\"梗概甲\"}]}", 20, 20);
        String carry = DramaCanvasPromptBuilder.carryFor("script", meta, List.of(done));
        assertTrue(carry.contains("第 20 集《甲》：梗概甲"), carry);
        assertEquals("", DramaCanvasPromptBuilder.carryFor("script", meta, List.of()));
    }
}
