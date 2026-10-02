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
        JsonNode sb = DramaCanvasPromptBuilder.parseStoryboard(content, 1, 10, ids);
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
                () -> DramaCanvasPromptBuilder.parseStoryboard("{\"segments\":[]}", 1, 10, ids)).getCode());
    }

    @Test
    void storyboard_needsScriptText_tableListsDocIds() {
        DramaCanvasPromptBuilder.TextPlan plan = builder.storyboard(sampleDoc(), 1, 10);
        String user = plan.calls().get(0).user();
        assertTrue(user.contains("@[林微·成年](look:lk1)"), user);
        assertTrue(user.contains("@[旧教室](scene:sc1)"));
        assertTrue(user.contains("单个片段不超过 10 秒"));
        assertEquals("[\"lk1\"]", plan.meta().path("ids").path("look").toString());

        ObjectNode doc = sampleDoc();
        ((ObjectNode) doc.path("script").path("episodes").get(0)).put("text", " ");
        assertEquals("DRAMA_CANVAS_SCRIPT_EMPTY",
                assertThrows(BusinessException.class, () -> builder.storyboard(doc, 1, 10)).getCode());
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
