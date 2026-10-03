package com.aistareco.aep.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 粘贴来的剧本按「第 X 集」切集（v0.198，docs/drama-canvas-plan.md §2.3）。<b>纯规则、不调模型、免费</b>，
 * 新建画布（source=paste）与 {@code POST /me/drama/canvases/{id}/script/split} 共用这一份。
 *
 * <p>规则：
 * <ol>
 *   <li>集标题行：一行开头（可带 {@code #} 标题记号、{@code 【} / {@code [} / {@code （} 括号）是「第 N 集」，
 *       N 可以是阿拉伯数字（含全角）或中文数字（一、十二、一百零五、两）。后面可以跟 {@code ：: · 、 - — |} 或空格再跟集名；
 *       「第一集的时候……」这种正文里的说法不算（集字后面紧跟的不是分隔符、又像一句话）。</li>
 *   <li>集号<b>一律按出现顺序重排成 1..N</b>：原文漏号、重号、从第 3 集开始都照样切，但在 notes 里说清楚。
 *       doc 里的集号要和逐集制作一一对应，不能有洞。</li>
 *   <li>第一个集标题之前的文字（剧名、人物表、简介）<b>放进第 1 集开头</b>并在 notes 里说明（不丢内容，用户自己删）；
 *       只有空白则忽略。</li>
 *   <li>一个集标题都没找到 → 整篇当第 1 集，notes 说明。</li>
 *   <li>每集正文：统一换行、去每行行尾空白、去首尾空行、连续多个空行压成一个。只有标题没有正文的集保留（正文为空）并说明。</li>
 * </ol>
 */
public final class DramaCanvasScriptSplitter {

    private DramaCanvasScriptSplitter() {
    }

    /** 一集：集号（1 起、连续）、集名（没有时为空串）、正文。 */
    public record Episode(int no, String title, String text) {
    }

    public record Result(List<Episode> episodes, List<String> notes) {
    }

    /** 集名最长多少字（超出截断）。 */
    static final int TITLE_MAX = 40;
    /** 标题行最长多少字；更长的是一段正文，不当标题。 */
    private static final int HEADING_LINE_MAX = 80;
    /** 集字后面没有分隔符、直接接名字时，名字最长多少字才算标题（「第1集旧教室重逢」算，「第一集的时候他……」不算）。 */
    private static final int GLUED_TITLE_MAX = 20;

    /**
     * group(1) 数字、group(2) 集字后面紧跟的分隔（可空）、group(3) 剩下的（集名）。
     * 行首允许空白、{@code #} 标题记号、左括号；集字后允许右括号。
     */
    private static final Pattern HEADING = Pattern.compile(
            "^[\\s\\u3000]*(?:#{1,6}[\\s\\u3000]*)?[【\\[（(〔]?[\\s\\u3000]*第[\\s\\u3000]*"
                    + "([0-9０-９]{1,4}|[零〇一二两三四五六七八九十百千]{1,8})[\\s\\u3000]*集"
                    + "([\\s\\u3000]*[】\\]）)〕]?[\\s\\u3000]*[:：·•、\\-—–|｜.．]?[\\s\\u3000]*)"
                    + "(.*)$");

    /** 「第 X 集 完 / 终 / 结束」是上一集的结尾标记。 */
    private static final Pattern END_MARK = Pattern.compile("^(完|终|结束|完结|剧终|end|END|End)$");

    /** 集名里出现这些就更像一句正文。 */
    private static final Pattern SENTENCE_PUNCT = Pattern.compile("[。！？!?；;，,]");

    public static Result split(String raw) {
        List<String> notes = new ArrayList<>();
        String text = normalize(raw);

        List<String> lines = List.of(text.split("\n", -1));
        List<int[]> headings = new ArrayList<>();      // {lineIndex, parsedNumber}
        List<String> titles = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            Heading h = heading(lines.get(i));
            if (h != null) {
                headings.add(new int[]{i, h.number});
                titles.add(h.title);
            }
        }

        List<Episode> episodes = new ArrayList<>();
        if (headings.isEmpty()) {
            episodes.add(new Episode(1, "", cleanBody(lines, 0, lines.size())));
            notes.add("没找到「第 X 集」标记，整篇当作第 1 集");
            return new Result(episodes, notes);
        }

        String preface = cleanBody(lines, 0, headings.get(0)[0]);
        for (int h = 0; h < headings.size(); h++) {
            int from = headings.get(h)[0] + 1;
            int to = h + 1 < headings.size() ? headings.get(h + 1)[0] : lines.size();
            String body = cleanBody(lines, from, to);
            if (h == 0 && !preface.isEmpty()) {
                body = body.isEmpty() ? preface : preface + "\n\n" + body;
            }
            episodes.add(new Episode(h + 1, titles.get(h), body));
        }

        notes.add("按「第 X 集」切成了 " + episodes.size() + " 集");
        if (!preface.isEmpty()) {
            notes.add("第 1 集之前的 " + preface.codePointCount(0, preface.length())
                    + " 个字（剧名、人物介绍等）放在了第 1 集开头，不需要的话删掉");
        }
        boolean sequential = true;
        List<String> original = new ArrayList<>();
        for (int h = 0; h < headings.size(); h++) {
            int n = headings.get(h)[1];
            original.add(n > 0 ? String.valueOf(n) : "?");
            if (n != h + 1) sequential = false;
        }
        if (!sequential) {
            notes.add("原文的集号是 " + String.join("、", abbreviateList(original))
                    + "，已按出现顺序改成第 1 到第 " + episodes.size() + " 集");
        }
        List<String> empty = new ArrayList<>();
        for (Episode e : episodes) if (e.text().isEmpty()) empty.add(String.valueOf(e.no()));
        if (!empty.isEmpty()) {
            notes.add("第 " + String.join("、", abbreviateList(empty)) + " 集只有标题、没有正文");
        }
        return new Result(episodes, notes);
    }

    // ── 标题行 ──────────────────────────────────────────────────────────────────

    private record Heading(int number, String title) {
    }

    private static Heading heading(String line) {
        if (line == null) return null;
        String trimmed = line.strip();
        if (trimmed.isEmpty() || trimmed.codePointCount(0, trimmed.length()) > HEADING_LINE_MAX) return null;
        // 只拿去掉首尾空白、且已限长的那一段去匹配：原始行可能带上万个前导空格，
        // 几个相邻的 \s* 在匹配失败时会回溯到平方级，一篇 10 万字的剧本就能把请求线程卡死。
        Matcher m = HEADING.matcher(trimmed);
        if (!m.matches()) return null;
        String sep = m.group(2);
        String rest = m.group(3).strip();
        if (!rest.isEmpty()) {
            if (SENTENCE_PUNCT.matcher(rest).find()) return null;
            boolean glued = sep.isEmpty();
            if (glued && (rest.codePointCount(0, rest.length()) > GLUED_TITLE_MAX || startsLikeProse(rest))) return null;
        }
        String title = cleanTitle(rest);
        if (END_MARK.matcher(title).matches()) return null; // 「第一集 完」是结尾标记，不是新的一集
        return new Heading(parseNumber(m.group(1)), title);
    }

    /** 「第一集的……」「第二集里……」这类正文开头。 */
    private static boolean startsLikeProse(String rest) {
        return rest.matches("^[的里中时后前开结完播和与跟到在是就也都还要会].*");
    }

    private static String cleanTitle(String rest) {
        String t = rest.strip();
        // 去掉整体包着的书名号 / 引号 / 括号：《旧教室》、「重逢」、"xx"
        while (t.length() >= 2 && isWrapped(t)) t = t.substring(1, t.length() - 1).strip();
        t = t.replaceAll("[\\s\\u3000]+", " ");
        if (t.codePointCount(0, t.length()) > TITLE_MAX) {
            t = t.substring(0, t.offsetByCodePoints(0, TITLE_MAX));
        }
        return t;
    }

    private static boolean isWrapped(String t) {
        char a = t.charAt(0);
        char b = t.charAt(t.length() - 1);
        return (a == '《' && b == '》') || (a == '「' && b == '」') || (a == '『' && b == '』')
                || (a == '“' && b == '”') || (a == '"' && b == '"') || (a == '【' && b == '】')
                || (a == '（' && b == '）') || (a == '(' && b == ')');
    }

    /** 阿拉伯数字（含全角）或中文数字 → int；认不出返回 0。 */
    static int parseNumber(String s) {
        if (s == null || s.isEmpty()) return 0;
        StringBuilder ascii = new StringBuilder();
        boolean digits = true;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '0' && c <= '9') ascii.append(c);
            else if (c >= '０' && c <= '９') ascii.append((char) ('0' + (c - '０')));
            else {
                digits = false;
                break;
            }
        }
        if (digits) {
            try {
                return Integer.parseInt(ascii.toString());
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return parseChinese(s);
    }

    /** 一 / 十 / 十二 / 二十 / 一百零五 / 两千 / 〇五（逐位读）→ int；认不出返回 0。 */
    static int parseChinese(String s) {
        int total = 0;
        int section = 0;
        int digit = -1;
        boolean sawUnit = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int d = digitOf(c);
            if (d >= 0) {
                if (digit >= 0 && !sawUnit) {
                    // 连续数字没有单位（「〇五」「一二」）：逐位读
                    section = section * 10 + digit;
                }
                digit = d;
                continue;
            }
            int unit = switch (c) {
                case '十' -> 10;
                case '百' -> 100;
                case '千' -> 1000;
                default -> -1;
            };
            if (unit < 0) return 0;
            sawUnit = true;
            section += (digit < 0 ? 1 : digit) * unit;
            digit = -1;
        }
        if (digit >= 0) {
            section = sawUnit ? section + digit : section * 10 + digit;
        }
        total += section;
        return total;
    }

    private static int digitOf(char c) {
        return switch (c) {
            case '零', '〇' -> 0;
            case '一' -> 1;
            case '二', '两' -> 2;
            case '三' -> 3;
            case '四' -> 4;
            case '五' -> 5;
            case '六' -> 6;
            case '七' -> 7;
            case '八' -> 8;
            case '九' -> 9;
            default -> -1;
        };
    }

    // ── 正文 ────────────────────────────────────────────────────────────────────

    /** 统一换行、去 BOM。 */
    static String normalize(String raw) {
        if (raw == null) return "";
        String t = raw.replace("\r\n", "\n").replace('\r', '\n');
        if (!t.isEmpty() && t.charAt(0) == '﻿') t = t.substring(1);
        return t;
    }

    /** [from, to) 这几行：去行尾空白、去首尾空行、连续空行压成一个。 */
    private static String cleanBody(List<String> lines, int from, int to) {
        List<String> out = new ArrayList<>();
        boolean lastBlank = true; // 开头的空行直接丢
        for (int i = from; i < to; i++) {
            String l = stripTrailing(lines.get(i));
            boolean blank = l.isBlank();
            if (blank) {
                if (!lastBlank) out.add("");
            } else {
                out.add(l);
            }
            lastBlank = blank;
        }
        while (!out.isEmpty() && out.get(out.size() - 1).isEmpty()) out.remove(out.size() - 1);
        return String.join("\n", out);
    }

    private static String stripTrailing(String s) {
        int end = s.length();
        while (end > 0 && (Character.isWhitespace(s.charAt(end - 1)) || s.charAt(end - 1) == '　')) end--;
        return s.substring(0, end);
    }

    private static List<String> abbreviateList(List<String> xs) {
        if (xs.size() <= 10) return xs;
        List<String> out = new ArrayList<>(xs.subList(0, 10));
        out.add("…");
        return out;
    }
}
