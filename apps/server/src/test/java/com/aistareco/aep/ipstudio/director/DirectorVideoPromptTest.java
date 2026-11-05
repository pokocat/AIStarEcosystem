package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 导演台视频提示词（中文、H3 结构）。片段照线上《敦煌飞仙》「飞仙之眼」：两人、四镜、三句台词，
 * 2026-10-26 对比实测就是用它跑的（docs/audits/director-h3-video-prompt-ab-2026-10.md）。
 * 这里断言的是结构：台词原文、画外与闭嘴、宫格只取构图、没有否定清单和画幅参数 —— 这些就是被测行为。
 */
class DirectorVideoPromptTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private static JsonNode clip() throws Exception {
        return OM.readTree("""
                {"durationSec":15,"shots":[
                 {"durationSec":4,"size":"全景","camera":"低角度仰拍","still":"陈默背影专注，林小雅侧面举相机","action":"陈默用细毛刷沿壁画底边慢慢刷；林小雅在侧后方举相机拍照","dialogue":[]},
                 {"durationSec":3,"size":"近景","camera":"平视，聚焦林小雅面部及手势","still":"林小雅手指指向壁画","action":"林小雅身体前倾，指着飞仙的眼睛","dialogue":[{"speakerId":"as6","text":"小哥，你看这个飞仙的眼睛，是不是特别有神？感觉她在看我。"}]},
                 {"durationSec":3,"size":"特写","camera":"侧面特写","still":"陈默侧脸，目光下垂盯着刷子","action":"陈默刷子停顿了一瞬，没抬头","dialogue":[{"speakerId":"as4","text":"那是光影效果。颜料氧化后会有这种视觉误差。"}]},
                 {"durationSec":5,"size":"中景","camera":"过肩镜头，从陈默背后看林小雅","still":"林小雅手指悬停在飞仙嘴角附近","action":"林小雅凑近壁画","dialogue":[{"speakerId":"as6","text":"真的吗？我怎么觉得她嘴角在笑呢？"}]}]}""");
    }

    private static final List<DirectorPrompts.Ref> REFS = List.of(
            new DirectorPrompts.Ref("图2", "character", "陈默"), new DirectorPrompts.Ref("图3", "character", "林小雅"));
    private static final Map<String, String> NAMES = Map.of("as4", "陈默", "as6", "林小雅", "as9", "旁白员");

    private static String prompt(JsonNode clip) {
        return DirectorPrompts.videoPrompt(OM.createObjectNode().put("style", "真人写实"), clip, REFS, NAMES,
                List.of(), List.of("林小雅", "陈默"), new LinkedHashMap<>(), Map.of());
    }

    private static String shot(String prompt, int n) {
        return prompt.lines().filter(l -> l.startsWith("第" + n + "镜")).findFirst().orElseThrow();
    }

    @Test
    void dialogueIsVerbatimInsideTheSpeakingShot() throws Exception {
        String p = prompt(clip());
        String shot2 = p.lines().filter(l -> l.startsWith("第2镜")).findFirst().orElseThrow();
        assertTrue(shot2.contains("林小雅说：「小哥，你看这个飞仙的眼睛，是不是特别有神？感觉她在看我。」"), shot2);
        assertTrue(shot2.contains("画面里只有林小雅。"), shot2);
        assertFalse(p.contains("【语音轨】"), "台词不再单独成段：浮在正文外的台词口型对不上");
    }

    @Test
    void listenerKeepsMouthClosedAndOffscreenSpeakerIsMarked() throws Exception {
        JsonNode clip = clip();
        String shot4 = prompt(clip).lines().filter(l -> l.startsWith("第4镜")).findFirst().orElseThrow();
        assertTrue(shot4.contains("陈默听着，嘴闭着。"), shot4);
        assertTrue(shot4.endsWith("最后保持这个画面到结束。"), shot4);

        // 说话人不在这一镜画面里（画面只点了陈默的名）→ 写成画外，画面里的人闭嘴
        ((com.fasterxml.jackson.databind.node.ObjectNode) clip.path("shots").get(2).path("dialogue").get(0)).put("speakerId", "as6");
        String shot3 = prompt(clip).lines().filter(l -> l.startsWith("第3镜")).findFirst().orElseThrow();
        assertTrue(shot3.contains("林小雅在画外说：「"), shot3);
        assertTrue(shot3.contains("画面里的人嘴闭着。"), shot3);
    }

    @Test
    void gridIsCompositionOnlyWithoutNegativeListsOrRequestParameters() throws Exception {
        String p = prompt(clip());
        assertTrue(p.contains("左上格对应第1镜，右上格对应第2镜，左下格对应第3镜，右下格对应第4镜"), p);
        assertFalse(p.contains("禁止"), "H3 没有负面提示词，旧写法写了「禁止出现格线」照样拍出宫格");
        assertFalse(p.contains("9:16") || p.contains("画幅"), "画幅走请求参数");
        assertTrue(p.contains("【配乐】\n无"), p);
        assertTrue(p.contains("陈默和林小雅在画面里各只出现一个"), p);
    }

    @Test
    void longerNamesWinWhenSpottingWhoIsInTheShot() throws Exception {
        JsonNode shot = OM.readTree("{\"camera\":\"\",\"still\":\"林小雅低头\",\"action\":\"\"}");
        assertEquals(List.of("林小雅"), DirectorPrompts.castOf(shot, List.of("小雅", "林小雅")));
        assertEquals(List.of(), DirectorPrompts.castOf(OM.readTree("{\"still\":\"空镜\"}"), List.of("陈默")));
    }

    @Test
    void voiceBindingLinesStayStrippableForTheStalenessCheck() throws Exception {
        String p = DirectorPrompts.videoPrompt(OM.createObjectNode(), clip(), REFS, NAMES,
                List.of(new DirectorPrompts.VoiceRef("音频1", "林小雅")), List.of("陈默"), new LinkedHashMap<>(), Map.of());
        assertTrue(p.lines().anyMatch(l -> l.startsWith("声音参考：林小雅")), p);
    }

    /**
     * 中文原文会整段交给 H3，H3 分不清哪些中文要念：《扣钱》cl45 成片末尾多出约 4 秒人声，转写对上「没有声音参考」；
     * A/B 实测 F3 念出「陈默的设定图」。新模板不许再有这类写给系统的话 —— 文案就是被测行为。
     */
    @Test
    void noNotesAddressedToTheSystem() throws Exception {
        String p = DirectorPrompts.videoPrompt(OM.createObjectNode(), clip(), REFS, NAMES,
                List.of(new DirectorPrompts.VoiceRef("音频1", "林小雅")), List.of("陈默"), new LinkedHashMap<>(Map.of("陈默", "低沉")), Map.of());
        for (String note : List.of("设定图", "图里的人像", "没有声音参考", "按人物身份自然配音", "只借声音", "说的是上面引号里的台词", "人物只说引号里的台词"))
            assertFalse(p.contains(note), note + "\n" + p);
        assertTrue(p.contains("陈默：长相、发型和衣服照参考图2。"), p);
        assertTrue(p.contains("声音参考：林小雅的音色、口音照音频1。"), p);
        assertTrue(p.contains("陈默的音色：低沉"), p);
        assertTrue(p.contains("真人写实风格，画面里没有字幕。"), p);
        assertTrue(p.endsWith("【配乐】\n无"), p);
    }

    /** 《扣钱》cl45 第三镜：资产叫「餐馆老板」、分镜写「老板」。按别名认出他在画面里，不再写「画面里只有静儿」「老板在画外说」。 */
    @Test
    void aliasPutsTheSpeakerOnScreen() throws Exception {
        JsonNode clip = OM.readTree("""
                {"durationSec":4,"shots":[{"durationSec":4,"size":"近景","camera":"低角度仰拍，固定机位",
                 "still":"老板站在静儿面前，下巴微抬，嘴张到一半。","action":"老板从后厨门洞走出，停在静儿面前，下巴微抬说完，转身走。",
                 "dialogue":[{"speakerId":"as4","text":"这个月迟到三回，扣了啊。"}]}]}""");
        List<DirectorPrompts.Ref> refs = List.of(new DirectorPrompts.Ref("图2", "character", "静儿"), new DirectorPrompts.Ref("图3", "character", "餐馆老板"));
        Map<String, String> names = Map.of("as2", "静儿", "as4", "餐馆老板");
        String p = DirectorPrompts.videoPrompt(OM.createObjectNode(), clip, refs, names, List.of(), List.of("餐馆老板"), new LinkedHashMap<>(),
                Map.of("餐馆老板", List.of("老板"), "静儿", List.of("静儿")));
        String s1 = shot(p, 1);
        assertTrue(s1.contains("餐馆老板说：「这个月迟到三回，扣了啊。」"), s1);
        assertTrue(s1.contains("静儿听着，嘴闭着。"), s1);
        assertFalse(s1.contains("画面里只有") || s1.contains("画外"), s1);
        assertFalse(p.contains("【声音】"), "有台词、没有声音参考也没有音色描述时，不留一个空的【声音】标题：" + p);
        // 改写时认得出这句台词、说话人和所在镜头，仍走「代码填台词」
        var src = com.aistareco.aep.ipstudio.h3.H3PromptRewrite.source(p, List.of("旁白", "静儿", "餐馆老板"));
        assertEquals(1, src.lines().size());
        assertEquals("餐馆老板", src.lines().get(0).speaker());
        assertFalse(src.lines().get(0).offscreen());
        assertEquals(List.of("{{L1}}"), com.aistareco.aep.ipstudio.h3.H3PromptRewrite.linesByShot(src.text()).get(1));
    }

    @Test
    void offscreenCueOrSharedAliasLeavesItUnsaid() throws Exception {
        JsonNode cue = OM.readTree("{\"still\":\"静儿低头看工资条\",\"action\":\"静儿手一顿，门外传来老板的声音\",\"dialogue\":[{\"speakerId\":\"as4\",\"text\":\"扣了啊。\"}]}");
        var cast = DirectorPrompts.castOfShot(cue, List.of("静儿", "餐馆老板"), Map.of("餐馆老板", List.of("老板")));
        assertEquals(List.of("静儿"), cast.on());
        assertEquals(List.of("餐馆老板"), cast.unsure());
        String p = DirectorPrompts.videoPrompt(OM.createObjectNode(), OM.readTree("{\"shots\":[" + cue + "]}"),
                List.of(new DirectorPrompts.Ref("图2", "character", "静儿")), Map.of("as4", "餐馆老板"), List.of(), List.of(), new LinkedHashMap<>(),
                Map.of("餐馆老板", List.of("老板")));
        String s1 = shot(p, 1);
        assertTrue(s1.contains("餐馆老板说：「扣了啊。」"), s1);
        assertFalse(s1.contains("画面里只有") || s1.contains("画外") || s1.contains("嘴闭着"), "分不清时不写强约束：" + s1);

        JsonNode shared = OM.readTree("{\"still\":\"面筋夫妻在摊前忙活\",\"action\":\"\"}");
        var both = DirectorPrompts.castOfShot(shared, List.of("丈夫", "妻子"), Map.of("丈夫", List.of("面筋夫妻"), "妻子", List.of("面筋夫妻")));
        assertEquals(List.of(), both.on());
        assertEquals(List.of("丈夫", "妻子"), both.unsure());
    }

    /** 第 3 版原样冻结：旧视频按它核对，换模板本身不算「镜头、台词已修改」。 */
    @Test
    void version3IsFrozenForComparison() throws Exception {
        String v3 = DirectorPrompts.videoPromptV3(OM.createObjectNode().put("style", "真人写实"), clip(), REFS, NAMES, List.of(), List.of("林小雅", "陈默"), new LinkedHashMap<>());
        assertTrue(v3.contains("参考图2 是陈默的设定图，图里的人像都是陈默一个人。"), v3);
        assertTrue(v3.contains("没有声音参考，按人物身份自然配音。"), v3);
        assertTrue(v3.endsWith("人物只说引号里的台词，画面里没有字幕。"), v3);
        assertNotEquals(v3, prompt(clip()));
    }

    @Test
    void legacyTemplateIsKeptOnlyForComparison() throws Exception {
        String legacy = DirectorPrompts.legacyVideoPrompt(OM.createObjectNode(), clip(), REFS, NAMES, List.of(), List.of("林小雅", "陈默"), new LinkedHashMap<>());
        assertTrue(legacy.contains("【语音轨】"));
        assertNotEquals(legacy, prompt(clip()));
    }

    /** AI 视频页的长视频：一段 30 秒可以到 8 镜，配两张分镜图（docs/studio-segmented-video.md）。不超过 4 镜时和导演台一字不差。 */
    @Test
    void moreThanFourShotsMapToTwoBoards() throws Exception {
        var base = OM.createObjectNode();
        var shots = base.put("durationSec", 30).putArray("shots");
        for (int i = 0; i < 6; i++) shots.addObject().put("durationSec", 5).put("size", "近景").put("camera", "固定机位").put("still", "画面" + (i + 1)).put("action", "动作");
        String text = DirectorPrompts.videoPrompt(OM.createObjectNode().put("style", "真人写实"), base, List.of(), Map.of(), List.of(), List.of(), new LinkedHashMap<>(), Map.of(), 8);
        assertTrue(text.contains("参考图1 是 2×2 分镜：左上格对应第1镜，右上格对应第2镜，左下格对应第3镜，右下格对应第4镜"), text);
        assertTrue(text.contains("参考图2 是 2×2 分镜：左上格对应第5镜，右上格对应第6镜，其余格子是空的"), text);
        assertTrue(text.contains("第6镜"), text);
        // 第一个重载不变：还是最多 4 镜
        String director = prompt(clip());
        assertEquals(director, DirectorPrompts.videoPrompt(OM.createObjectNode().put("style", "真人写实"), clip(), REFS, NAMES, List.of(), List.of("林小雅", "陈默"), new LinkedHashMap<>(), Map.of(), DirectorPrompts.MAX_SHOTS));
        assertFalse(director.contains("参考图2 是 2×2"), director);
    }
}
