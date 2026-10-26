package com.aistareco.aep.ipstudio.director;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 提交 H3 前的中文 → 官方英文写法改写：台词由代码认、由代码填，模型只写画面（docs/audits/director-h3-video-prompt-ab-2026-10.md §6）。
 * 这里断言的是组装结果和每条拒绝规则 —— 它们就是被测行为。
 */
class DirectorH3RewriteTest {
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
        var src = DirectorH3Rewrite.source(ZH, NAMES);
        assertEquals(4, src.lines().size());
        assertEquals(List.of("S1", "S2", "S1", "S3"), src.lines().stream().map(DirectorH3Rewrite.Line::sid).toList(), "同一个人跨镜头编号不变");
        assertEquals("陈默", src.lines().get(1).speaker());
        assertTrue(src.lines().get(3).offscreen());
        assertTrue(src.text().contains("老赵说：{{L1}}陈默说：{{L2}}老赵说：{{L3}}"), src.text());
        assertTrue(src.text().contains("旁白在画外说：{{L4}}画面里的人嘴闭着"), src.text());
        assertFalse(src.text().contains("又熬通宵"), "台词原文不交给模型");
    }

    @Test
    void legacyVoiceTrackFormatIsStillRecognised() {
        var src = DirectorH3Rewrite.source("【语音轨】\n第2镜 · @林小雅 · “小哥，你看这个飞仙的眼睛。”\n第3镜 · @陈默 · “那是光影效果。”\n", NAMES);
        assertEquals(2, src.lines().size());
        assertEquals("那是光影效果。", src.lines().get(1).text());
        assertTrue(src.text().contains("@陈默 · {{L2}}"), src.text());
    }

    private static ObjectNode meta() {
        var src = DirectorH3Rewrite.source(ZH, NAMES);
        return DirectorH3Rewrite.meta(OM, 3, List.of(0.0, 5.0, 9.0), 3, 0, "中文", src.lines());
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

    @Test
    void assemblesTheOfficialSixSectionsWithLinesFilledByCode() {
        String template = DirectorH3Rewrite.validate(OM, meta(), out()).path("template").asText();
        assertTrue(template.contains("who says in a rough voice: {{L1}}"), "存下的是带占位的模板，提交时按当前台词填：" + template);
        String p = DirectorH3Rewrite.fill(template, DirectorH3Rewrite.source(ZH, NAMES).lines(), "Chinese");
        assertTrue(p.startsWith("subject_definitions:\n"), p);
        assertTrue(p.contains("\n\ndetailed_description:\nLive-action, cinematic, cold blue night.\n[Shot 1] A static wide shot"), p);
        assertTrue(p.contains("\n[Shot 2] At 00:05.000, the camera cuts to Lao Zhao, who says in a rough voice: (S1) <d>[Chinese] 又熬通宵？小陈啊…</d>"), "前缀去重、时间由代码加、「……」规整为「…」：" + p);
        assertTrue(p.contains("Chen Mo replies: (S2) <d>[Chinese] 赵叔，我这人吧，就是闲不住。</d>"), p);
        assertTrue(p.contains("[Shot 3] At 00:09.000, the camera cuts to Lin Xiaoya alone."), p);
        assertTrue(p.contains("(S3) <d>[Chinese] 那一夜，洞窟里没有人。</d> while her lips remain closed."), p);
        assertTrue(p.endsWith("\n\nnon_diegetic_music:\nN/A"), p);
    }

    private static String rejected(JsonNode out) {
        BusinessException e = assertThrows(BusinessException.class, () -> DirectorH3Rewrite.validate(OM, meta(), out));
        assertEquals("AI_BAD_OUTPUT", e.getCode());
        return e.getMessage();
    }

    @Test
    void rejectsMissingDuplicatedOrMisplacedLines() {
        ObjectNode o = out();
        ((ArrayNode) o.path("shots")).set(1, OM.getNodeFactory().textNode("the camera cuts to Lao Zhao, who says: {{L1}} Chen Mo replies: {{L2}}"));
        rejected(o);
        o = out();
        ((ArrayNode) o.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot. {{L1}}"));
        rejected(o);
        o = out().put("summary", "Lao Zhao says {{L1}}.");
        rejected(o);
        o = out();
        ((ArrayNode) o.path("shots")).set(2, OM.getNodeFactory().textNode("the camera cuts to her: {{L4}} {{L9}}"));
        rejected(o);
    }

    @Test
    void rejectsLinesWrittenByTheModelButDropsItsOwnSpeakerIds() {
        ObjectNode o = out();
        ((ArrayNode) o.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot. <d>[Chinese] 你好。</d>"));
        rejected(o);
        // 照官方范例写「<Subject 2> (S1) says」：编号去掉，由代码统一写在台词前
        o = out();
        ((ArrayNode) o.path("shots")).set(1, OM.getNodeFactory().textNode(
                "the camera cuts to Lao Zhao (S1), who says in a rough voice: {{L1}} Chen Mo (S2) replies: {{L2}} Lao Zhao (S1) asks: {{L3}}"));
        String t = DirectorH3Rewrite.validate(OM, meta(), o).path("template").asText();
        assertTrue(t.contains("the camera cuts to Lao Zhao, who says in a rough voice: {{L1}} Chen Mo replies: {{L2}}"), t);
        assertFalse(t.contains("(S"), t);
    }

    @Test
    void strayChineseIsDroppedButLargeUntranslatedChunksAreRejected() {
        // 2026-10-26 线上评测里真实出现过的三种零星漏翻
        ObjectNode o = out().put("subject_definitions", "<Subject 1> is Steve Chou (史蒂芬周) in <Picture 2>, holding a bowl of 杂碎面.");
        ((ArrayNode) o.path("shots")).set(0, OM.getNodeFactory().textNode("A wide shot. Firelight flickers across his狼狈 figure."));
        String t = DirectorH3Rewrite.validate(OM, meta(), o).path("template").asText();
        assertTrue(t.contains("<Subject 1> is Steve Chou in <Picture 2>, holding a bowl of."), t);
        assertTrue(t.contains("[Shot 1] A wide shot. Firelight flickers across his figure."), t);
        // 画面里的文字按官方写法放在英文双引号里，保留原文
        t = DirectorH3Rewrite.validate(OM, meta(), out().put("style", "A red neon sign reading \"营业中\" glows.")).path("template").asText();
        assertTrue(t.contains("\"营业中\""), t);
        // 大段没翻：拒收
        assertTrue(rejected(out().put("style", "真人写实风格，冷色调，光线昏暗，画面压抑，人物神情紧张。")).contains("没翻译"));
    }

    @Test
    void missingSoundscapeGetsANeutralLineAndMissingMusicIsNone() {
        ObjectNode o = out();
        o.remove("overall_soundscape");
        o.remove("non_diegetic_music");
        String t = DirectorH3Rewrite.validate(OM, meta(), o).path("template").asText();
        assertTrue(t.contains("overall_soundscape:\n" + DirectorH3Rewrite.DEFAULT_SOUNDSCAPE), t);
        assertTrue(t.endsWith("non_diegetic_music:\nN/A"), t);
    }

    @Test
    void rejectsWrongShotCountUnknownReferencesAndOversizedPrompts() {
        ObjectNode o = out();
        ((ArrayNode) o.path("shots")).remove(2);
        rejected(o);
        rejected(out().put("subject_definitions", "<Subject 1> is Chen Mo in <Picture 4>."));
        // 编出来的参考素材：那句删掉（不含台词时）；含台词的句子删不得，拒收
        String t = DirectorH3Rewrite.validate(OM, meta(), out().put("summary", "[reference generation] A night scene. <Audio 1> provides the narrator's voice.")).path("template").asText();
        assertTrue(t.contains("summary:\n[reference generation] A night scene.\n"), t);
        assertFalse(t.contains("<Audio 1>"), t);
        ObjectNode withLine = out();
        ((ArrayNode) withLine.path("shots")).set(2, OM.getNodeFactory().textNode("the camera cuts to Lin Xiaoya. Using <Audio 2>, the narrator says: {{L4}}"));
        rejected(withLine);
        rejected(out().put("retention_analysis", "x".repeat(7_000)));
    }

    @Test
    void userMessageListsTheLinesPerShotAndEndsWithTheSkeletonToFill() {
        String user = DirectorH3Rewrite.user(15, 3, List.of("<Picture 1>: storyboard."), DirectorH3Rewrite.source(ZH, NAMES).text());
        assertTrue(user.contains("no reference audio is attached, so use no <Audio N> label"), "没有音频就别诱导模型编一个");
        assertTrue(user.contains("Shot 1: no spoken lines\nShot 2: {{L1}}, {{L2}}, {{L3}}\nShot 3: {{L4}}"), user);
        assertTrue(user.strip().endsWith("{\"subject_definitions\":\"\",\"summary\":\"\",\"retention_analysis\":\"\",\"style\":\"\","
                + "\"overall_soundscape\":\"\",\"non_diegetic_music\":\"\",\"shot_1\":\"\",\"shot_2\":\"\",\"shot_3\":\"\"}"),
                "环境声、配乐排在镜头前，免得写完最后一镜就收尾漏掉：" + user);
    }

    @Test
    void shotsAreReadFromTheSkeletonKeysAndEveryShotMustBeFilled() {
        ObjectNode o = out();
        ArrayNode arr = (ArrayNode) o.remove("shots");
        for (int i = 0; i < arr.size(); i++) o.put("shot_" + (i + 1), arr.get(i).asText());
        String t = DirectorH3Rewrite.validate(OM, meta(), o).path("template").asText();
        assertTrue(t.contains("[Shot 3] At 00:09.000, the camera cuts to Lin Xiaoya alone."), t);
        o.remove("shot_3"); // 2026-10-26 真模型试跑：只写了第 1 镜就收尾
        assertTrue(rejected(o).contains("缺少第 3 镜"));
    }

    @Test
    void systemPromptIsTheOfficialSkillPlusTheOutputContract() {
        String system = DirectorH3Rewrite.system();
        assertTrue(system.startsWith("---\nname: h3-prompt-writing"), "官方 SKILL.md 原文在最前");
        assertTrue(system.contains("# Full-Reference Mode Rewrite Output Format Guide"), "ref-en.txt");
        assertTrue(system.contains("# Video Prompt Writing Guide (T2VA / I2VA / FL2VA / L2VA)"), "base-en.txt");
        assertTrue(system.contains("# Output contract for this service"));
        assertEquals("English", DirectorH3Rewrite.languageTag("英文"));
        assertEquals("Chinese", DirectorH3Rewrite.languageTag(null));
    }
}
