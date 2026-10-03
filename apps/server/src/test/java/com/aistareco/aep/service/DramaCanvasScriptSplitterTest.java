package com.aistareco.aep.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 粘贴剧本按「第 X 集」切集：各种标题写法、没有标记、前言、空行、集号重排、正文里的「第一集」不误切。
 * notes 是给用户看的话，这里只断「有没有这条说明」的关键词，不断整句（AGENTS.md §8.0.1 ⑩）。
 */
class DramaCanvasScriptSplitterTest {

    private static List<DramaCanvasScriptSplitter.Episode> eps(String text) {
        return DramaCanvasScriptSplitter.split(text).episodes();
    }

    private static boolean noteMentions(DramaCanvasScriptSplitter.Result r, String word) {
        return r.notes().stream().anyMatch(n -> n.contains(word));
    }

    @Test
    void arabicChineseAndTitledHeadings_allSplit() {
        String text = String.join("\n",
                "第 1 集",
                "### 场1-1",
                "日 内 旧教室",
                "第一集：旧教室重逢",
                "林微（语气温和）：我习惯一个人了。",
                "第1集：十七年真相",
                "△ 陈屹推门进来。");
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split(text);
        List<DramaCanvasScriptSplitter.Episode> e = r.episodes();
        assertEquals(3, e.size());
        assertEquals(new DramaCanvasScriptSplitter.Episode(1, "", "### 场1-1\n日 内 旧教室"), e.get(0));
        assertEquals(new DramaCanvasScriptSplitter.Episode(2, "旧教室重逢", "林微（语气温和）：我习惯一个人了。"), e.get(1));
        assertEquals(new DramaCanvasScriptSplitter.Episode(3, "十七年真相", "△ 陈屹推门进来。"), e.get(2));
        assertTrue(noteMentions(r, "3 集"));
        // 原文集号是 1、1、1 → 重排成 1..3 并说明
        assertTrue(noteMentions(r, "改成第 1 到第 3 集"), r.notes().toString());
    }

    @Test
    void headingVariants_markdownBracketsSeparatorsFullWidthAndBigChineseNumbers() {
        String text = String.join("\n",
                "## 第1集 开端",
                "a",
                "【第2集】转折",
                "b",
                "第３集 - 高潮",
                "c",
                "  第 四 集 · 余波",
                "d",
                "第五集旧楼夜话",
                "e");
        List<DramaCanvasScriptSplitter.Episode> e = eps(text);
        assertEquals(List.of("开端", "转折", "高潮", "余波", "旧楼夜话"), e.stream().map(DramaCanvasScriptSplitter.Episode::title).toList());
        assertEquals(List.of("a", "b", "c", "d", "e"), e.stream().map(DramaCanvasScriptSplitter.Episode::text).toList());
        assertEquals(List.of(1, 2, 3, 4, 5), e.stream().map(DramaCanvasScriptSplitter.Episode::no).toList());
        // 1..5 连续，不出「改号」说明
        assertFalse(noteMentions(DramaCanvasScriptSplitter.split(text), "改成"));
    }

    @Test
    void titleWrappedInQuotesOrBookMarks_isUnwrapped() {
        List<DramaCanvasScriptSplitter.Episode> e = eps("第1集：《旧教室》\nx\n第2集 「重逢」\ny");
        assertEquals("旧教室", e.get(0).title());
        assertEquals("重逢", e.get(1).title());
    }

    @Test
    void noMarkers_wholeTextIsEpisodeOne_withNote() {
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split("\n\n  日 内 旧教室  \n\n林微：你好。\n\n");
        assertEquals(1, r.episodes().size());
        assertEquals(new DramaCanvasScriptSplitter.Episode(1, "", "  日 内 旧教室\n\n林微：你好。"), r.episodes().get(0));
        assertTrue(noteMentions(r, "没找到"), r.notes().toString());
    }

    @Test
    void prefaceBeforeFirstHeading_goesToTopOfEpisodeOne_withNote() {
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split(String.join("\n",
                "《旧教室》",
                "人物：林微、陈屹",
                "",
                "第1集 重逢",
                "正文一",
                "第2集 真相",
                "正文二"));
        assertEquals(2, r.episodes().size());
        assertEquals("《旧教室》\n人物：林微、陈屹\n\n正文一", r.episodes().get(0).text());
        assertEquals("正文二", r.episodes().get(1).text());
        assertTrue(noteMentions(r, "第 1 集开头"), r.notes().toString());
    }

    @Test
    void blankOnlyPreface_isIgnored_silently() {
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split("\n   \n第1集\n正文");
        assertEquals("正文", r.episodes().get(0).text());
        assertFalse(noteMentions(r, "开头"));
    }

    @Test
    void blankLines_trimmedAndCollapsed_trailingSpacesRemoved_crlfNormalized() {
        String text = "﻿第1集\r\n\r\n\r\n第一行   \r\n\r\n\r\n\r\n第二行　\r\n\r\n";
        List<DramaCanvasScriptSplitter.Episode> e = eps(text);
        assertEquals(1, e.size());
        assertEquals("第一行\n\n第二行", e.get(0).text());
    }

    @Test
    void headingWithoutBody_keptEmpty_withNote() {
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split("第1集 甲\n\n第2集 乙\n内容");
        assertEquals("", r.episodes().get(0).text());
        assertEquals("内容", r.episodes().get(1).text());
        assertTrue(noteMentions(r, "没有正文"), r.notes().toString());
    }

    @Test
    void proseMentioningAnEpisode_isNotAHeading() {
        String text = String.join("\n",
                "第1集",
                "第一集的时候，他还不认识她。",
                "第二集里他们会重逢",
                "第三集的故事",
                "第2集完",
                "第2集 完",
                "旁白：在第3集之前，一切都很平静。");
        List<DramaCanvasScriptSplitter.Episode> e = eps(text);
        assertEquals(1, e.size(), e.toString());
        assertTrue(e.get(0).text().startsWith("第一集的时候"));
    }

    @Test
    void outOfOrderNumbers_renumberedSequentially_withNote() {
        DramaCanvasScriptSplitter.Result r = DramaCanvasScriptSplitter.split("第3集 a\nx\n第5集 b\ny\n第十二集 c\nz");
        assertEquals(List.of(1, 2, 3), r.episodes().stream().map(DramaCanvasScriptSplitter.Episode::no).toList());
        String note = r.notes().stream().filter(n -> n.contains("改成")).findFirst().orElseThrow();
        assertTrue(note.contains("3、5、12"), note);
    }

    @Test
    void chineseNumerals_parse() {
        assertEquals(1, DramaCanvasScriptSplitter.parseNumber("一"));
        assertEquals(10, DramaCanvasScriptSplitter.parseNumber("十"));
        assertEquals(12, DramaCanvasScriptSplitter.parseNumber("十二"));
        assertEquals(20, DramaCanvasScriptSplitter.parseNumber("二十"));
        assertEquals(23, DramaCanvasScriptSplitter.parseNumber("二十三"));
        assertEquals(105, DramaCanvasScriptSplitter.parseNumber("一百零五"));
        assertEquals(110, DramaCanvasScriptSplitter.parseNumber("一百一十"));
        assertEquals(2, DramaCanvasScriptSplitter.parseNumber("两"));
        assertEquals(5, DramaCanvasScriptSplitter.parseNumber("〇五"));
        assertEquals(12, DramaCanvasScriptSplitter.parseNumber("１２"));
        assertEquals(7, DramaCanvasScriptSplitter.parseNumber("07"));
    }

    @Test
    void hugeWhitespaceLines_doNotBacktrack() {
        // 一行 10 万个空格（+ 一个字）不能让标题正则回溯到平方级
        String text = " ".repeat(100_000) + "x\n" + "　".repeat(50_000) + "第1集\n正文";
        java.util.List<DramaCanvasScriptSplitter.Episode> e = assertTimeoutPreemptively(java.time.Duration.ofSeconds(3),
                () -> eps(text));
        assertEquals(1, e.size());
        assertTrue(e.get(0).text().endsWith("正文"));
    }

    @Test
    void longTitle_truncated() {
        String title = "长".repeat(60);
        List<DramaCanvasScriptSplitter.Episode> e = eps("第1集：" + title + "\n正文");
        assertEquals(DramaCanvasScriptSplitter.TITLE_MAX, e.get(0).title().length());
    }
}
