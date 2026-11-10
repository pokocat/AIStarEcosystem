package com.aistareco.aep.ipstudio.h3;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 2026-11-10 线上：用户在没有台词的镜头里自己加了一句（「咂了下嘴说：“味道还是不行”」），一句没认出却按「认全了」处理，
 * 对改写模型说这一镜没有台词，台词被删。这里钉住认台词、说话人、「还有没认出的台词」与最后的矛盾检查。
 */
class H3UnrecognizedSpeechTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final List<String> NAMES = List.of("旁白", "静儿", "林小雅");

    private static H3PromptRewrite.Source src(String zh) { return H3PromptRewrite.source(zh, NAMES); }

    private static List<String> texts(H3PromptRewrite.Source s) { return s.lines().stream().map(H3PromptRewrite.Line::text).toList(); }

    private static List<String> speakers(H3PromptRewrite.Source s) { return s.lines().stream().map(H3PromptRewrite.Line::speaker).toList(); }

    @Test
    void curlyAsciiAndColonlessQuotesAreLines() {
        var s = src("第3镜（8 秒切）：近景。静儿用勺尖蘸一点底料抿进嘴里，咂了下嘴说：“味道还是不行”转身伸手去够辣椒面。画面里只有静儿。");
        assertEquals(List.of("味道还是不行"), texts(s));
        assertTrue(s.text().contains("咂了下嘴说：{{L1}}转身"), s.text());
        assertEquals(List.of("好香"), texts(src("第1镜（0–3 秒）：静儿说“好香”")));
        assertEquals(List.of("走吧"), texts(src("第1镜（0–3 秒）：林小雅说: \"走吧\"")));
        assertEquals(List.of("嗯"), texts(src("第1镜（0–3 秒）：林小雅说『嗯』")));
        // 台词里的引号不拆开：「他说“别走”」是一句台词的一部分
        assertEquals(List.of("他说“别走”，然后离开。"), texts(src("第1镜（0–3 秒）：静儿说：「他说“别走”，然后离开。」")));
    }

    @Test
    void theSpeakerIsTheCharacterOfTheSentenceNotTheActionBeforeSay() {
        assertEquals(List.of("静儿"), speakers(src("第3镜（8 秒切）：近景。静儿用勺尖蘸一点底料抿进嘴里，咂了下嘴说：“味道还是不行”")));
        assertEquals(List.of("静儿"), speakers(src("第1镜（0–3 秒）：静儿笑着说：「来了」")));
        assertEquals(List.of("林小雅"), speakers(src("第1镜（0–3 秒）：林小雅对静儿说：「走吧」")), "「对」后面的是听的人");
        assertEquals(List.of("林小雅"), speakers(src("第1镜（0–3 秒）：静儿身后的林小雅说：「嗯」")));
        assertEquals(List.of("静儿"), speakers(src("第1镜（0–3 秒）：近景，画面里只有静儿。低头说：「嗯」")), "同一句里没有人：看这一镜只提到谁");
        assertEquals(List.of("店小二"), speakers(src("第1镜（0–3 秒）：静儿推门进来，店小二说：「客官里边请」")),
                "「店小二」不像动作：可能是没建资产的人，不拿前面提到的静儿顶替");
        assertEquals(List.of("旁白"), speakers(src("第1镜（0–3 秒）：画面里只有静儿。旁白在画外说：「那一夜」")));
        // 别名开口归到本名，编号和本名一致
        var alias = H3PromptRewrite.source("第1镜（0–3 秒）：老板说：「扣了啊」\n第2镜（3 秒切）：餐馆老板说：「下不为例」", List.of("旁白", "餐馆老板"), Map.of("老板", "餐馆老板"));
        assertEquals(List.of("餐馆老板", "餐馆老板"), alias.lines().stream().map(H3PromptRewrite.Line::speaker).toList());
        assertEquals(List.of("S1", "S1"), alias.lines().stream().map(H3PromptRewrite.Line::sid).toList());
    }

    @Test
    void speechThatWasNotRecognisedIsReported() {
        for (String zh : List.of(
                "第3镜（8 秒切）：静儿咂了下嘴说：不好吃，转身去够辣椒面。",
                "第1镜（0–3 秒）：老赵问：你昨晚听见啥没？",
                "第1镜（0–3 秒）：近景。\n台词：你来了",
                "第1镜（0–3 秒）：静儿：「味道还是不行」",
                "第1镜（0–3 秒）：静儿：“味道还是不行”",
                "第1镜（0–3 秒）：静儿说：“味道还是不行",
                "两张相同的脸静静对望一拍，她开口说一句话。",
                "第1镜（0–4 秒）：静儿走来。\n第2镜（4 秒切）：她小声说味道还是不行。"))
            assertTrue(H3PromptRewrite.unrecognizedSpeech(src(zh).text()), zh);
        for (String zh : List.of(
                // 认出了台词的镜头里，分镜动作描述的就是这句台词（2026-11-10 线上 cl208）
                "第1镜（0–4 秒）：静儿低头看钱，话说到一半。静儿看着桌上的钱，说出自己的判断。静儿说：「不能收」\n第2镜（4 秒切）：一口气说完。静儿说：「我们先免费尝」",
                "第1镜（0–4 秒）：据说这家店开了三十年，静儿推门进来。画面里只有静儿。",
                "【声音】\n声音参考：静儿的音色、口音照音频1，只借声音，说的是上面引号里的台词。\n\n【配乐】\n无\n\n人物只说引号里的台词，画面里没有字幕。",
                "【人物】\n静儿：长相、发型和衣服照参考图2。\n\n【画面】\n第1镜（0–4 秒）：静儿走进厨房。"))
            assertFalse(H3PromptRewrite.unrecognizedSpeech(src(zh).text()), zh);
    }

    @Test
    void linesAreCompleteOnlyWhenEveryOneSitsInAShot() {
        assertTrue(H3PromptRewrite.complete(src("第1镜（0–3 秒）：静儿说：「好」\n第2镜（3 秒切）：林小雅说：「行」"), true));
        assertTrue(H3PromptRewrite.complete(src("第1镜(0–3 秒)：静儿说：「好」"), true), "半角括号的镜头头也算");
        assertFalse(H3PromptRewrite.complete(src("静儿说：「好」\n第1镜（0–3 秒）：近景。"), true), "不在任何一镜的台词，没法告诉模型放哪一镜");
        assertFalse(H3PromptRewrite.complete(src("第1镜（0–3 秒）：静儿说：「好」\n第2镜（3 秒切）：林小雅回答：「行」"), true));
        assertTrue(H3PromptRewrite.complete(src("第1镜（0–3 秒）：静儿走进厨房。"), true), "真没有台词：照旧由代码处理");
    }

    // ── 最后的核对：有台词的镜头里不能同时写「没人说话」──────────────────────────

    private static final String ZH = """
            【画面】
            第1镜（0–4 秒）：中景。静儿关火。画面里只有静儿。
            第2镜（4 秒切）：近景。静儿闻了闻。画面里只有静儿。
            第3镜（8 秒切）：近景。静儿用勺尖蘸一点底料抿进嘴里，咂了下嘴说：“味道还是不行”转身伸手去够辣椒面。画面里只有静儿。
            """;

    private static ObjectNode meta(String zh, boolean codeLines) {
        var s = codeLines ? src(zh) : new H3PromptRewrite.Source(zh, List.of());
        var req = new H3PromptRewrite.Request(H3PromptRewrite.Mode.REF, 12, List.of("<Picture 1>: the storyboard frame of this clip."), s, codeLines, 3,
                List.of(0.0, 4.0, 8.0), "中文", true);
        return H3PromptRewrite.meta(OM, req, 1, 0, 0);
    }

    private static ObjectNode out(String shot3) {
        ObjectNode o = OM.createObjectNode().put("subject_definitions", "<Subject 1> is Jing'er.").put("summary", "[reference generation] Jing'er cooks.")
                .put("retention_analysis", "<Picture 1> ([Shot 1]–[Shot 3]): fully_preserved.").put("style", "Live-action.")
                .put("overall_soundscape", "Bubbling broth.").put("non_diegetic_music", "N/A");
        ArrayNode shots = o.putArray("shots");
        shots.add("A medium shot as <Subject 1> switches off the stove.");
        shots.add("the camera cuts to <Subject 1> smelling the broth.");
        shots.add(shot3);
        return o;
    }

    private static List<String> warnings(JsonNode r) { List<String> w = new ArrayList<>(); r.path("warnings").forEach(x -> w.add(x.asText())); return w; }

    @Test
    void aShotWithALineDropsNoDialogueClaimsAndFlagsASilentSpeaker() {
        ObjectNode meta = meta(ZH, true);
        assertEquals(3, meta.path("lines").get(0).path("shot").asInt());
        JsonNode r = H3PromptRewrite.validate(OM, meta, out(
                "the camera cuts to <Subject 1> tasting the broth; she smacks her lips and says: {{L1}} No speech is audible. She does not speak."));
        String filled = H3PromptRewrite.fill(r.path("template").asText(), H3PromptRewrite.lines(meta), "Chinese");
        String shot3 = filled.substring(filled.indexOf("[Shot 3]"));
        assertTrue(shot3.contains("(S1) <d>[Chinese] 味道还是不行</d>"), filled);
        assertFalse(shot3.contains("No speech is audible"), "与台词矛盾的「没有对白」删掉：" + filled);
        assertTrue(warnings(r).contains("第 3 镜有台词，优化稿却写了没有对白，已删掉这句"), warnings(r).toString());
        assertTrue(warnings(r).contains("第 3 镜有台词，优化稿却写了人物不说话，可能与台词冲突"), warnings(r).toString());
        // 没有台词的镜头写「没有对白」是对的，不动；时间里的小数点不当句号
        ObjectNode calm = out("");
        calm.set("shots", OM.createArrayNode().add("A medium shot. No speech is audible.").add("the camera cuts to her.")
                .add("the camera cuts to <Subject 1> at 1.5 m, who says: {{L1}}"));
        JsonNode quiet = H3PromptRewrite.validate(OM, meta, calm);
        assertTrue(quiet.path("template").asText().contains("No speech is audible."), quiet.toString());
        assertTrue(quiet.path("template").asText().contains("at 1.5 m, who says: {{L1}}"), quiet.toString());
        assertTrue(warnings(quiet).isEmpty(), warnings(quiet).toString());
    }

    @Test
    void anOffscreenLineInASoloShotMayKeepTheOnScreenPersonSilent() {
        String zh = ZH.replace("咂了下嘴说：“味道还是不行”", "旁白在画外说：「味道还是不行」");
        JsonNode r = H3PromptRewrite.validate(OM, meta(zh, true), out(
                "the camera cuts to <Subject 1>, who does not speak, while a narrator says in an off-screen voiceover: {{L1}}. She remains silent."));
        assertTrue(warnings(r).isEmpty(), warnings(r).toString());
    }

    @Test
    void anUnquotedLineMatchesWhenTheModelSpeaksItsLeadingWords() {
        String zh = "【人物】\n静儿：长相、发型和衣服照参考图2。\n\n" + ZH.replace("咂了下嘴说：“味道还是不行”转身", "咂了下嘴说：不好吃，转身");
        ObjectNode meta = meta(zh, false);
        assertEquals(1, meta.path("spoken").size(), "【人物】里的素材说明不当台词：" + meta.path("spoken"));
        assertTrue(meta.path("spoken").get(0).path("unquoted").asBoolean());
        JsonNode said = H3PromptRewrite.validate(OM, meta, out("the camera cuts to <Subject 1>, who smacks her lips and (S1) says: <d>[Chinese] 不好吃</d>"));
        assertTrue(warnings(said).isEmpty(), warnings(said).toString());
        JsonNode dropped = H3PromptRewrite.validate(OM, meta, out("the camera cuts to <Subject 1>, who smacks her lips and turns away."));
        assertEquals(1, warnings(dropped).size(), warnings(dropped).toString());
        assertTrue(warnings(dropped).get(0).startsWith("原文台词「不好吃"), warnings(dropped).toString());
    }

    @Test
    void sentencesSplitOnlyAtSentenceEnds() {
        String t = "At 00:08.000, she lifts a 1.5 m pole. No speech is audible.\nThen she turns!";
        assertEquals(List.of("At 00:08.000, she lifts a 1.5 m pole. ", "No speech is audible.\n", "Then she turns!"), H3PromptRewrite.sentences(t));
        assertEquals(t, String.join("", H3PromptRewrite.sentences(t)));
        String spoken = "She says: {{L1}} No speech is audible. He replies: <d>[Chinese] 好</d> Then silence.";
        assertEquals(List.of("She says: {{L1}} ", "No speech is audible. ", "He replies: <d>[Chinese] 好</d> ", "Then silence."), H3PromptRewrite.sentences(spoken));
    }
}
