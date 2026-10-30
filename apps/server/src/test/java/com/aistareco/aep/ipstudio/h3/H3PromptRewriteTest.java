package com.aistareco.aep.ipstudio.h3;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 提交 H3 前的中文 → 官方英文写法改写：台词能认就由代码认、由代码填，认不出由模型照官方写法写、逐句核对；
 * 检查只给提示不拦人（docs/audits/director-h3-video-prompt-ab-2026-10.md §6，2026-10-26 用户定）。
 * 这里断言的是组装结果、给用户的提示和仍然判失败的那几种情况 —— 它们就是被测行为。
 */
class H3PromptRewriteTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final List<String> NAMES = List.of("旁白", "陈默", "老赵", "林小雅");

    private static final String ZH = """
            【画面】
            第1镜（0–5 秒）：全景，固定机位。陈默提着饼干盒走出洞窟。
            第2镜（5 秒切）：中景，越过陈默肩膀拍老赵。老赵说：「又熬通宵？小陈啊……」陈默说：「赵叔，我这人吧，就是闲不住。」老赵说：「难受？那你昨晚听见啥动静没？」
            第3镜（9 秒切）：近景。画面里只有林小雅。旁白在画外说：「那一夜，洞窟里没有人。」画面里的人嘴闭着。
            """;

    @Test
    void linesAreTakenOutAndNumberedBySpeaker() {
        var src = H3PromptRewrite.source(ZH, NAMES);
        assertEquals(4, src.lines().size());
        assertEquals(List.of("S1", "S2", "S1", "S3"), src.lines().stream().map(H3PromptRewrite.Line::sid).toList(), "同一个人跨镜头编号不变");
        assertEquals("陈默", src.lines().get(1).speaker());
        assertTrue(src.lines().get(3).offscreen());
        assertTrue(src.text().contains("老赵说：{{L1}}陈默说：{{L2}}老赵说：{{L3}}"), src.text());
        assertTrue(src.text().contains("旁白在画外说：{{L4}}画面里的人嘴闭着"), src.text());
        assertFalse(src.text().contains("又熬通宵"), "台词原文不交给模型");
    }

    @Test
    void legacyVoiceTrackFormatIsStillRecognised() {
        var src = H3PromptRewrite.source("【语音轨】\n第2镜 · @林小雅 · “小哥，你看这个飞仙的眼睛。”\n第3镜 · @陈默 · “那是光影效果。”\n", NAMES);
        assertEquals(2, src.lines().size());
        assertEquals("那是光影效果。", src.lines().get(1).text());
        assertTrue(src.text().contains("@陈默 · {{L2}}"), src.text());
    }

    @Test
    void quotesInsideALineArePairedNotCutShort() {
        // 2026-10-26 评审：非贪婪匹配只认出「他喊「别走」，后半句进了交给模型的正文
        var src = H3PromptRewrite.source("第1镜（0–5 秒）：近景。陈默说：「他喊「别走」，然后离开。」画面里的人嘴闭着。", NAMES);
        assertEquals(List.of("他喊「别走」，然后离开。"), src.lines().stream().map(H3PromptRewrite.Line::text).toList());
        assertTrue(src.text().contains("陈默说：{{L1}}画面里的人嘴闭着"), src.text());
        var legacy = H3PromptRewrite.source("【语音轨】\n第1镜 · @陈默 · “他说“别走”，然后离开。”\n", NAMES);
        assertEquals(List.of("他说“别走”，然后离开。"), legacy.lines().stream().map(H3PromptRewrite.Line::text).toList());
        assertTrue(H3PromptRewrite.source("第1镜（0–5 秒）：陈默说：「好啊", NAMES).lines().isEmpty());
        var stray = H3PromptRewrite.source("第1镜（0–5 秒）：陈默说：「把」这个符号念出来。」", NAMES);
        assertEquals(List.of("把"), stray.lines().stream().map(H3PromptRewrite.Line::text).toList());
        assertFalse(H3PromptRewrite.quotesBalanced(stray.text(), false), "落单的收引号：调用方据此改由模型写台词");
        assertTrue(H3PromptRewrite.quotesBalanced(H3PromptRewrite.source(ZH, NAMES).text(), false));
    }

    @Test
    void legacyVoiceTrackLinesBelongToTheShotTheyAreLabelledWith() {
        String zh = "【画面】\n第1镜（0–5 秒）：全景。\n第2镜（5 秒切）：近景。\n【语音轨】\n第1镜 · @陈默 · “你来了。”\n第2镜 · @林小雅 · “嗯。”\n";
        var src = H3PromptRewrite.source(zh, NAMES);
        ObjectNode meta = H3PromptRewrite.meta(OM, director(src, 2, List.of(0.0, 5.0)), 1, 0, 0);
        assertEquals(1, meta.path("lines").get(0).path("shot").asInt());
        assertEquals(2, meta.path("lines").get(1).path("shot").asInt());
    }

    private static H3PromptRewrite.Request director(H3PromptRewrite.Source src, int shots, List<Double> starts) {
        return new H3PromptRewrite.Request(H3PromptRewrite.Mode.REF, 15, List.of("<Picture 1>: storyboard."), src, true, shots, starts, "中文", true);
    }

    private static ObjectNode meta() {
        return H3PromptRewrite.meta(OM, director(H3PromptRewrite.source(ZH, NAMES), 3, List.of(0.0, 5.0, 9.0)), 3, 0, 0);
    }

    private static ObjectNode out() {
        ObjectNode o = OM.createObjectNode().put("subject_definitions", "<Subject 1> is Chen Mo in <Picture 2>.")
                .put("summary", "[reference generation] A night scene.").put("retention_analysis", "<Subject 1> (appears in [Shot 1]): fully_preserved - face.")
                .put("style", "Live-action, cinematic, cold blue night.").put("overall_soundscape", "Wind and sand.").put("non_diegetic_music", "N/A");
        ArrayNode shots = o.putArray("shots");
        shots.add("A static wide shot as <Subject 1> walks out of the cave.");
        shots.add("[Shot 2] At 00:05.000, the camera cuts to Lao Zhao, who says in a rough voice: {{L1}} Chen Mo replies: {{L2}} Lao Zhao asks: {{L3}}");
        shots.add("the camera cuts to Lin Xiaoya alone. The narrator says in an off-screen voiceover: {{L4}} while her lips remain closed.");
        return o;
    }

    private static JsonNode check(ObjectNode out) { return H3PromptRewrite.validate(OM, meta(), out); }
    private static String template(ObjectNode out) { return check(out).path("template").asText(); }
    private static List<String> warnings(JsonNode result) { List<String> w = new ArrayList<>(); result.path("warnings").forEach(x -> w.add(x.asText())); return w; }
    private static String warned(ObjectNode out) { return String.join("；", warnings(check(out))); }
    private static List<String> notes(JsonNode result) { List<String> n = new ArrayList<>(); result.path("notes").forEach(x -> n.add(x.asText())); return n; }

    @Test
    void assemblesTheOfficialSixSectionsWithLinesFilledByCode() {
        JsonNode r = check(out());
        assertTrue(r.path("usable").asBoolean());
        assertTrue(warnings(r).isEmpty(), warnings(r).toString());
        String template = r.path("template").asText();
        assertTrue(template.contains("who says in a rough voice: {{L1}}"), "存下的是带占位的模板，提交时按当前台词填：" + template);
        String p = H3PromptRewrite.fill(template, H3PromptRewrite.source(ZH, NAMES).lines(), "Chinese");
        assertTrue(p.startsWith("subject_definitions:\n"), p);
        assertTrue(p.contains("\n\ndetailed_description:\nLive-action, cinematic, cold blue night.\n[Shot 1] A static wide shot"), p);
        assertTrue(p.contains("\n[Shot 2] At 00:05.000, the camera cuts to Lao Zhao, who says in a rough voice: (S1) <d>[Chinese] 又熬通宵？小陈啊…</d>"), "前缀去重、时间由代码加、「……」规整为「…」：" + p);
        assertTrue(p.contains("Chen Mo replies: (S2) <d>[Chinese] 赵叔，我这人吧，就是闲不住。</d>"), p);
        assertTrue(p.contains("[Shot 3] At 00:09.000, the camera cuts to Lin Xiaoya alone."), p);
        assertTrue(p.contains("(S3) <d>[Chinese] 那一夜，洞窟里没有人。</d> while her lips remain closed."), p);
        assertTrue(p.endsWith("\n\nnon_diegetic_music:\nN/A"), p);
    }

    @Test
    void misplacedLinesAreRepairedAndExplainedNotRejected() {
        // 漏了第 3 句：补回原文所在的第 2 镜末尾
        ObjectNode o = out();
        ((ArrayNode) o.path("shots")).set(1, OM.getNodeFactory().textNode("the camera cuts to Lao Zhao, who says: {{L1}} Chen Mo replies: {{L2}}"));
        JsonNode r = check(o);
        assertTrue(r.path("template").asText().contains("Chen Mo replies: {{L2}} The speaker says: {{L3}}"), r.toString());
        assertTrue(warnings(r).get(0).contains("第 3 句台词「难受？那你昨晚听见啥动静…」模型漏了，已补在第 2 镜末尾"), warnings(r).toString());
        // 重复：留第一处
        o = out();
        ((ArrayNode) o.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot. {{L1}}"));
        r = check(o);
        assertEquals(1, r.path("template").asText().split("\\{\\{L1}}", -1).length - 1, "只留一处");
        assertTrue(String.join("；", warnings(r)).contains("出现了两次"), warnings(r).toString());
        assertTrue(String.join("；", warnings(r)).contains("放在了第 1 镜，原文在第 2 镜"), "第一处在第 1 镜，提示放错：" + warnings(r));
        // 放到镜头以外：移回所在镜头
        r = check(out().put("summary", "Lao Zhao says {{L1}}."));
        assertFalse(r.path("template").asText().contains("summary:\nLao Zhao says {{L1}}"), r.toString());
        // 编出来的台词编号：去掉
        o = out();
        ((ArrayNode) o.path("shots")).set(2, OM.getNodeFactory().textNode("the camera cuts to her: {{L4}} {{L9}}"));
        assertFalse(template(o).contains("{{L9}}"));
        // 挪到别的镜头、总数不变：错的时间、错的人开口 —— 不动模型写好的画面，提示用户
        o = out();
        ((ArrayNode) o.path("shots")).set(1, OM.getNodeFactory().textNode("the camera cuts to Lao Zhao, who says: {{L1}} Chen Mo replies: {{L2}}"));
        ((ArrayNode) o.path("shots")).set(2, OM.getNodeFactory().textNode("the camera cuts to Lao Zhao, who asks: {{L3}} The narrator says off screen: {{L4}}"));
        assertTrue(warned(o).contains("第 3 句台词「难受？那你昨晚听见啥动静…」放在了第 3 镜，原文在第 2 镜"), warned(o));
    }

    @Test
    void linesWrittenByTheModelAreRemovedAndItsOwnSpeakerIdsDropped() {
        ObjectNode o = out();
        ((ArrayNode) o.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot. <d>[Chinese] 你好。</d>"));
        JsonNode r = check(o);
        assertFalse(r.path("template").asText().contains("你好"), r.toString());
        assertTrue(warnings(r).contains("去掉了模型自己加的台词"));
        // 模型把这一镜的台词写成了自己的版本：换回原文占位，放在它写台词的位置，不提示
        o = out();
        ((ArrayNode) o.path("shots")).set(2, OM.getNodeFactory().textNode("the camera cuts to Lin Xiaoya. The narrator says: <d>[Chinese] 那一夜。</d> while her lips remain closed."));
        r = check(o);
        assertTrue(r.path("template").asText().contains("The narrator says: {{L4}} while her lips remain closed."), r.toString());
        assertTrue(warnings(r).isEmpty(), warnings(r).toString());
        // 照官方范例写「<Subject 2> (S1) says」：编号去掉，由代码统一写在台词前
        o = out();
        ((ArrayNode) o.path("shots")).set(1, OM.getNodeFactory().textNode(
                "the camera cuts to Lao Zhao (S1), who says in a rough voice: {{L1}} Chen Mo (S2) replies: {{L2}} Lao Zhao (S1) asks: {{L3}}"));
        String t = template(o);
        assertTrue(t.contains("the camera cuts to Lao Zhao, who says in a rough voice: {{L1}} Chen Mo replies: {{L2}}"), t);
        assertFalse(t.contains("(S"), t);
    }

    @Test
    void untranslatedChineseIsDroppedAndExplained() {
        // 2026-10-26 线上评测里真实出现过的三种零星漏翻
        ObjectNode o = out().put("subject_definitions", "<Subject 1> is Steve Chou (史蒂芬周) in <Picture 2>, holding a bowl of 杂碎面.");
        ((ArrayNode) o.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot. Firelight flickers across his狼狈 figure."));
        JsonNode r = check(o);
        String t = r.path("template").asText();
        assertTrue(t.contains("<Subject 1> is Steve Chou in <Picture 2>, holding a bowl of."), t);
        assertTrue(t.contains("[Shot 1] A wide shot. Firelight flickers across his figure."), t);
        assertTrue(warnings(r).isEmpty(), "已经自动处理好的小事不打扰用户：" + warnings(r));
        assertTrue(notes(r).contains("删掉了优化稿里零星没翻译的中文"));
        // 画面里的文字按官方写法放在英文双引号里，保留原文，不算漏翻
        r = check(out().put("style", "A red neon sign reading \"营业中\" glows."));
        assertTrue(r.path("template").asText().contains("\"营业中\""));
        assertTrue(warnings(r).isEmpty(), warnings(r).toString());
        // 大段没翻：照样删掉，提示画面描述可能缺了内容（不再拒收）
        assertTrue(warned(out().put("style", "真人写实风格，冷色调，光线昏暗，画面压抑，人物神情紧张。")).contains("个汉字没翻译，已删掉"));
    }

    @Test
    void missingSoundscapeGetsANeutralLineAndMissingMusicIsNone() {
        ObjectNode o = out();
        o.remove("overall_soundscape");
        o.remove("non_diegetic_music");
        String t = template(o);
        assertTrue(t.contains("overall_soundscape:\n" + H3PromptRewrite.DEFAULT_SOUNDSCAPE), t);
        assertTrue(t.endsWith("non_diegetic_music:\nN/A"), t);
    }

    @Test
    void missingShotsUnknownReferencesAndOversizedDraftsAreExplained() {
        // 少写一镜：补一句过渡并提示，第 4 句台词补回第 3 镜
        ObjectNode o = out();
        ((ArrayNode) o.path("shots")).remove(2);
        JsonNode r = check(o);
        assertTrue(r.path("template").asText().contains("[Shot 3] At 00:09.000, the camera cuts to the next shot of the request. The speaker says: {{L4}}"), r.toString());
        assertTrue(warnings(r).contains("第 3 镜模型没写画面，只补了一句过渡"), warnings(r).toString());
        // 一镜只写了一句、引用的还是不存在的图：删掉之后这一镜是空的，同样补过渡
        ObjectNode empty = out();
        ((ArrayNode) empty.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot using <Picture 99>."));
        assertTrue(warned(empty).contains("第 1 镜模型没写画面"), warned(empty));
        // 编出来的参考素材：那句删掉（不含台词时）；含台词的句子不删
        r = check(out().put("summary", "[reference generation] A night scene. <Audio 1> provides the narrator's voice."));
        assertTrue(r.path("template").asText().contains("summary:\n[reference generation] A night scene.\n"), r.toString());
        assertTrue(notes(r).contains("去掉了引用不存在素材的句子"));
        assertTrue(warnings(r).isEmpty(), warnings(r).toString());
        // 太长：标成不能直接用，提示按原文生成
        r = check(out().put("retention_analysis", "x".repeat(7_000)));
        assertFalse(r.path("usable").asBoolean());
        assertTrue(String.join("；", warnings(r)).contains("H3 收不下"));
    }

    @Test
    void onlyUnusableOutputStillFails() {
        assertEquals("AI_BAD_OUTPUT", assertThrows(BusinessException.class, () -> H3PromptRewrite.validate(OM, meta(), OM.createArrayNode())).getCode());
        ObjectNode noSubjects = out();
        noSubjects.remove(List.of("subject_definitions", "summary", "retention_analysis"));
        assertThrows(BusinessException.class, () -> H3PromptRewrite.validate(OM, meta(), noSubjects));
        ObjectNode noShots = out();
        noShots.putArray("shots").add("").add("").add("");
        assertThrows(BusinessException.class, () -> H3PromptRewrite.validate(OM, meta(), noShots));
        // 少了一段说明不算失败，提示用户
        assertTrue(warned(out().put("summary", "")).contains("缺少概述"));
    }

    @Test
    void directorRequestKeepsItsReleasedWording() {
        var src = H3PromptRewrite.source(ZH, NAMES);
        String user = H3PromptRewrite.user(director(src, 3, List.of(0.0, 5.0, 9.0)));
        // 导演台首发时的原文（线上 74 次真实改写按它验过），一个字都不能变：已存的英文稿指纹靠它对上。
        String expected = """
                Rewrite the following request into the H3 full-reference (Ref2VA) format, following the guide and the output contract.

                Target video: 15 seconds, 3 shots, full-reference generation.

                Reference assets, in the exact order they are attached:
                <Picture 1>: storyboard.

                The reference images are authoritative for appearance; use the written notes only where they agree with the images.

                Request (Chinese, written by our storyboard step; 参考图N means <Picture N>; no reference audio is attached, so use no <Audio N> label):
                <<<
                %s
                >>>

                Spoken lines in each shot of the request:
                Shot 1: no spoken lines
                Shot 2: {{L1}}, {{L2}}, {{L3}}
                Shot 3: {{L4}}

                Fill in this JSON skeleton and return it (all 3 shot keys):
                {"subject_definitions":"","summary":"","retention_analysis":"","style":"","overall_soundscape":"","non_diegetic_music":"","shot_1":"","shot_2":"","shot_3":""}
                """.formatted(src.text().strip());
        assertEquals(expected, user);
        String system = H3PromptRewrite.system(H3PromptRewrite.Mode.REF, true, true);
        assertTrue(system.startsWith("---\nname: h3-prompt-writing"), "官方 SKILL.md 原文在最前");
        assertTrue(system.contains("# Full-Reference Mode Rewrite Output Format Guide"), "ref-en.txt");
        assertTrue(system.contains("# Video Prompt Writing Guide (T2VA / I2VA / FL2VA / L2VA)"), "base-en.txt");
        assertTrue(system.endsWith("- non_diegetic_music: \"N/A\" unless the request asks for music.\n"));
        assertTrue(system.contains("Do not write the words of a line, quotation marks around it, <d> tags, or speaker IDs such as (S1); the system inserts them."));
    }

    // ── 画布：用户自己写的提示词、基础模式 ──────────────────────────────────

    private static ObjectNode freeMeta(H3PromptRewrite.Mode mode, String zh, int seconds) {
        var src = new H3PromptRewrite.Source(zh, List.of());
        var refs = mode == H3PromptRewrite.Mode.FL2V ? List.of("<Picture 1>: the first frame.", "<Picture 2>: the last frame.")
                : mode == H3PromptRewrite.Mode.I2V ? List.of("<Picture 1>: the first frame.") : List.<String>of();
        var req = new H3PromptRewrite.Request(mode, seconds, refs, src, false, null, null, null, false);
        return H3PromptRewrite.meta(OM, req, refs.size(), 0, 0);
    }

    @Test
    void baseModesUseTheThreeCoreFieldsWithTheAlignmentLineAddedByCode() {
        ObjectNode o = OM.createObjectNode().put("style", "Live-action, cinematic.").put("overall_soundscape", "Rain on glass.").put("non_diegetic_music", "N/A");
        o.putArray("shots").add(OM.createObjectNode().put("start", 0).put("text", "A woman looks out of the train window."))
                .add(OM.createObjectNode().put("start", "00:03.000").put("text", "the camera cuts to her hands folding a letter."));
        String t = H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, "女人看着窗外，然后折起信。", 6), o).path("template").asText();
        assertEquals("integrated_multimodal_description: Live-action, cinematic. [Shot 1] A woman looks out of the train window. [Shot 2] At 00:03.000, the camera cuts to her hands folding a letter."
                + "\n\noverall_soundscape: Rain on glass.\n\nnon_diegetic_music: N/A", t);
        t = H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.I2V, "让她回头。", 6), o).path("template").asText();
        assertTrue(t.startsWith("For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.\n\nintegrated_multimodal_description: "), t);
        t = H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.FL2V, "从坐着到站起来。", 6), o).path("template").asText();
        assertTrue(t.startsWith("How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; "
                + "Picture 2 (from Shot 2) aligns with the 6.00-second mark of the target video.\n\n"), t);
        // 模型给的时间不像样：按镜头数平均分
        ObjectNode bad = o.deepCopy();
        ((ObjectNode) bad.path("shots").get(1)).put("start", 9);
        assertTrue(H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, "x", 6), bad).path("template").asText().contains("[Shot 2] At 00:03.000"));
    }

    @Test
    void userWrittenLinesAreCheckedAgainstWhatTheModelWrote() {
        String zh = "咖啡店里，女孩对店员说：「一杯热美式，谢谢。」店员笑着回答：「好的，马上就来。」";
        ObjectNode o = OM.createObjectNode().put("style", "Live-action.").put("overall_soundscape", "Cafe chatter.").put("non_diegetic_music", "N/A");
        o.putArray("shots").add(OM.createObjectNode().put("start", 0).put("text",
                "A young woman (S1) says: <d>[Chinese] 一杯热美式，谢谢。</d> The barista (S2) smiles and replies: <d>[Chinese] 好的。</d>"));
        JsonNode r = H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, zh, 5), o);
        String t = r.path("template").asText();
        assertTrue(t.contains("(S1) says: <d>[Chinese] 一杯热美式，谢谢。</d>"), "模型写的台词和编号原样保留：" + t);
        assertEquals(List.of("原文台词「好的，马上就来。」在优化稿里没有原样出现，可能被改了或漏了"), warnings(r));
    }

    @Test
    void spokenLinesAreMatchedWholeNotAsSubstrings() {
        // Codex 评审 2026-10-27：「同意」能在「不同意」里找到，拼在一起找子串会放过意思相反的改动
        String zh = "会议室里，经理：“同意。”";
        ObjectNode o = OM.createObjectNode().put("style", "Live-action.").put("overall_soundscape", "Office hum.").put("non_diegetic_music", "N/A");
        o.putArray("shots").add(OM.createObjectNode().put("start", 0).put("text", "The manager (S1) says: <d>[Chinese] 不同意。</d>"));
        List<String> w = warnings(H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, zh, 5), o));
        assertTrue(w.contains("原文台词「同意。」在优化稿里没有原样出现，可能被改了或漏了"), w.toString());
        assertTrue(w.contains("优化稿多了一句原文没有的台词「不同意。」"), w.toString());
        // 原句在，后面又加了一句意思相反的：也要报出来
        ObjectNode added = o.deepCopy();
        ((ObjectNode) added.path("shots").get(0)).put("text", "The manager (S1) says: <d>[Chinese] 同意。</d> Then he adds: <d>[Chinese] 不同意。</d>");
        assertEquals(List.of("优化稿多了一句原文没有的台词「不同意。」"), warnings(H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, zh, 5), added)));
        // 一句拆成两句说：照样算原样
        String two = "门口，女孩：“你来了。我等你很久了。”";
        ObjectNode split = o.deepCopy();
        ((ObjectNode) split.path("shots").get(0)).put("text", "The girl (S1) says: <d>[Chinese] 你来了。</d> She pauses, then says: <d>[Chinese] 我等你很久了。</d>");
        assertTrue(warnings(H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, two, 5), split)).isEmpty());
        // 原文没写成「名字：“…”」时，模型从叙述里补出的台词不算多出来的
        ObjectNode narrated = o.deepCopy();
        ((ObjectNode) narrated.path("shots").get(0)).put("text", "The girl (S1) whispers: <d>[Chinese] 谢谢。</d>");
        assertTrue(warnings(H3PromptRewrite.validate(OM, freeMeta(H3PromptRewrite.Mode.T2V, "女孩轻声道了谢。", 5), narrated)).isEmpty());
    }

    @Test
    void shotStartsAreReadFromTheDirectorStyleHeadings() {
        assertEquals(List.of(0.0, 3.0, 6.5), H3PromptRewrite.shotStarts("第1镜（0–3 秒）：a。第2镜（3–6.5 秒）：b。第3镜（6.5 秒切）：c。", 10));
        assertNull(H3PromptRewrite.shotStarts("第1镜（2–3 秒）：a。", 10), "不从 0 开始");
        assertNull(H3PromptRewrite.shotStarts("第2镜（0–3 秒）：a。", 10), "编号不连续");
        assertNull(H3PromptRewrite.shotStarts("一个女孩在跳舞。", 10));
    }

    @Test
    void contractsDifferByModeAndHowLinesAreWritten() {
        String base = H3PromptRewrite.system(H3PromptRewrite.Mode.I2V, false, false);
        assertFalse(base.contains("# references/ref-en.txt"), "基础模式不带全能参考的规范");
        assertTrue(base.contains("Do not write the picture-alignment instruction line"));
        assertTrue(base.contains("(S1) says: <d>[Chinese] 你来了。</d>"), "模型写台词时按官方写法");
        assertTrue(base.contains("\"shots\": the shots of the target video in order"));
        String user = H3PromptRewrite.user(new H3PromptRewrite.Request(H3PromptRewrite.Mode.T2V, 5, List.of(), new H3PromptRewrite.Source("跳舞", List.of()), false, null, null, null, false));
        assertTrue(user.startsWith("Rewrite the following request into the H3 text-to-video (T2VA) format"), user);
        assertTrue(user.contains("written by the user; no reference is attached"), user);
        assertTrue(user.strip().endsWith("{\"style\":\"\",\"overall_soundscape\":\"\",\"non_diegetic_music\":\"\",\"shots\":[{\"start\":0,\"text\":\"\"}]}"), user);
    }

    @Test
    void languageTags() {
        assertEquals("English", H3PromptRewrite.languageTag("英文"));
        assertEquals("Chinese", H3PromptRewrite.languageTag(null));
    }

    // 2026-10-30 审查 F04：场景页编导写的脚本原来是「镜头1（0–5秒）：…；台词：…」，H3 改写一行都认不出（零调用探针 0/3），
    // 只能交给模型重新分镜、重写台词。现在编导按这个格式写，镜头时间固定、台词由代码原样填回。
    @Test
    void aSceneDirectorScriptKeepsItsShotsAndItsLinesWordForWord() {
        String script = """
                第1镜（0–5 秒）：画面：一只手拿起面霜，指腹轻点膏体。旁白说：「干皮涂它，不紧绷。」
                第2镜（5–10 秒）：画面：面霜在手背上推开，质地润泽。店员说：「双人套餐九十九，周末能用。」
                第3镜（10–15 秒）：画面：门头和套餐全景。旁白说：「点本视频团购，提前预约。」
                """;
        var built = com.aistareco.aep.ipstudio.h3.H3StudioPrompt.build(script, 15,
                new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings("t2v", "768p", null, null, null, List.of(), null), null);
        assertEquals(List.of(0.0, 5.0, 10.0), built.request().starts());
        assertTrue(built.request().codeLines());
        assertEquals(List.of("干皮涂它，不紧绷。", "双人套餐九十九，周末能用。", "点本视频团购，提前预约。"),
                built.request().source().lines().stream().map(H3PromptRewrite.Line::text).toList());
        assertEquals(List.of("旁白", "店员", "旁白"), built.request().source().lines().stream().map(H3PromptRewrite.Line::speaker).toList());
        // 原来的场景写法：一个镜头、一句台词都认不出来。
        var old = com.aistareco.aep.ipstudio.h3.H3StudioPrompt.build("镜头1（0–5秒）：画面：拿起面霜；台词：干皮涂它\n镜头2（5–10秒）：画面：推开；台词：好吸收", 10,
                new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings("t2v", "768p", null, null, null, List.of(), null), null);
        assertNull(old.request().starts());
        assertFalse(old.request().codeLines());
    }
}
