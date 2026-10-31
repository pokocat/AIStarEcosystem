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
                List.of(), List.of("林小雅", "陈默"), new LinkedHashMap<>());
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
                List.of(new DirectorPrompts.VoiceRef("音频1", "林小雅")), List.of("陈默"), new LinkedHashMap<>());
        assertTrue(p.lines().anyMatch(l -> l.startsWith("声音参考：林小雅")), p);
        assertTrue(p.lines().anyMatch(l -> l.endsWith("没有声音参考，按人物身份自然配音。")), p);
    }

    @Test
    void legacyTemplateIsKeptOnlyForComparison() throws Exception {
        String legacy = DirectorPrompts.legacyVideoPrompt(OM.createObjectNode(), clip(), REFS, NAMES, List.of(), List.of("林小雅", "陈默"), new LinkedHashMap<>());
        assertTrue(legacy.contains("【语音轨】"));
        assertNotEquals(legacy, prompt(clip()));
    }
}
