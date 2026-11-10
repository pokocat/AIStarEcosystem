package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Caption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownClip;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.KnownLine;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 成片自动字幕的排版和对时（2026-11-07）：纯函数，不碰文件和网络，便于测试。
 *
 * <ul>
 *   <li>已知台词（导演台）：先按镜头时间排出预计时间；有语音识别结果时，把台词和识别出的字逐字对齐，用识别到的时间校正。
 *       识别错个别字不影响，字幕内容始终是台词原文。</li>
 *   <li>未知台词（一键成片）：字幕内容来自识别结果，去掉近静音时常见的幻听句。</li>
 * </ul>
 */
public final class StudioCaptionAligner {
    private StudioCaptionAligner() {}

    /** 一段识别结果（时间是整条音频里的秒）；words 是更细的逐词时间，接口不给就是 null。 */
    public record Segment(double start, double end, String text, List<Segment> words) {
        public Segment(double start, double end, String text) { this(start, end, text, null); }
    }
    /** recognized = 大部分片段的时间来自语音识别；否则是按镜头时间估算的。 */
    public record Aligned(List<Caption> captions, boolean recognized) {}

    private static final class Screen {
        final String text; double start, end; boolean matched;
        Screen(String text, double start, double end) { this.text = text; this.start = start; this.end = end; }
    }

    private static final double MIN_SECONDS = 0.5;
    /** 相邻字幕间隔小于这个值就连上，不让字幕闪一下。 */
    private static final double JOIN_GAP = 0.3;
    /** 单个片段对齐的规模上限（字数相乘），超过就按估算时间。 */
    private static final long MAX_ALIGN_CELLS = 4_000_000;
    /** 一个片段里至少这么多字对上了，才相信这段的识别时间。 */
    private static final double MIN_MATCH_RATIO = 0.35;
    /**
     * Whisper 系模型在近静音处常见的幻听（docs/audits/director-h3-cl45-prompt-review-2026-10.md 第 32 行实测过）。
     * 只用于没有已知台词的情况；有台词时这些字对不上，本来就不会进字幕。
     */
    private static final List<String> HALLUCINATIONS = List.of("请不吝点赞", "点赞订阅", "订阅转发", "打赏支持", "明镜与点点", "字幕由", "字幕提供", "感谢观看", "谢谢观看", "下期再见");

    /** 一屏最多几个字：竖屏窄，横屏宽。 */
    public static int maxChars(int width, int height) {
        if (width < height) return 15;
        return width == height ? 18 : 24;
    }

    /** 把一句台词切成一屏一屏：按标点断句，同一句里太短的逗号段并起来（句号、问号之后不并），太长的硬切。句末的逗号句号不显示，问号叹号保留。 */
    public static List<String> screens(String raw, int maxChars) {
        List<String> pieces = new ArrayList<>();
        List<Boolean> sentenceEnds = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        String text = raw == null ? "" : raw.strip();
        int[] cps = text.codePoints().toArray();
        for (int i = 0; i < cps.length; i++) {
            int cp = cps[i];
            if ("「」『』“”\"".indexOf(cp) >= 0) continue;
            boolean decimal = (cp == '.' || cp == ',') && i > 0 && i + 1 < cps.length && Character.isDigit(cps[i - 1]) && Character.isDigit(cps[i + 1]);
            if (!decimal && isBreak(cp)) {
                if ((cp == '？' || cp == '！' || cp == '?' || cp == '!') && cur.length() > 0) cur.appendCodePoint(cp);
                if (!cur.toString().isBlank()) { pieces.add(cur.toString().strip()); sentenceEnds.add("。.！!？?；;…\n\r".indexOf(cp) >= 0); }
                else if (!sentenceEnds.isEmpty() && "。.！!？?；;…\n\r".indexOf(cp) >= 0) sentenceEnds.set(sentenceEnds.size() - 1, true);
                cur.setLength(0);
            } else cur.appendCodePoint(cp);
        }
        if (!cur.toString().isBlank()) { pieces.add(cur.toString().strip()); sentenceEnds.add(true); }
        List<String> out = new ArrayList<>();
        String buffer = "";
        boolean closed = false;
        for (int i = 0; i < pieces.size(); i++) {
            String piece = pieces.get(i);
            if (buffer.isEmpty()) buffer = piece;
            else if (!closed && len(buffer) + 1 + len(piece) <= maxChars) buffer = buffer + "，" + piece;
            else { hardWrap(buffer, maxChars, out); buffer = piece; }
            closed = sentenceEnds.get(i);
        }
        if (!buffer.isEmpty()) hardWrap(buffer, maxChars, out);
        return out;
    }

    private static boolean isBreak(int cp) { return "，,。.！!？?；;、：:…—\n\r".indexOf(cp) >= 0; }
    private static int len(String s) { return s.codePointCount(0, s.length()); }

    private static void hardWrap(String text, int maxChars, List<String> out) {
        int[] cps = text.codePoints().toArray();
        for (int i = 0; i < cps.length; i += maxChars) out.add(new String(cps, i, Math.min(maxChars, cps.length - i)));
    }

    /**
     * 已知台词。
     *
     * @param clips  每个片段的台词和预计时间
     * @param actual 每个片段实际的秒数（和 clips 一一对应）
     * @param heard  语音识别结果；null 表示没有（没配置或失败）
     */
    public static Aligned fromKnown(List<KnownClip> clips, List<Double> actual, List<Segment> heard, int maxChars) {
        List<Screen> all = new ArrayList<>();
        double offset = 0;
        int withLines = 0, aligned = 0;
        for (int i = 0; i < clips.size(); i++) {
            KnownClip clip = clips.get(i);
            double planned = clip.plannedSec() == null ? 0 : clip.plannedSec();
            double seconds = i < actual.size() && actual.get(i) != null && actual.get(i) > 0 ? actual.get(i) : planned;
            double scale = planned > 0 && seconds > 0 ? seconds / planned : 1;
            List<Screen> screens = new ArrayList<>();
            if (clip.lines() != null) for (KnownLine line : clip.lines()) {
                double start = offset + (line.start() == null ? 0 : line.start()) * scale;
                double end = offset + (line.end() == null ? planned : line.end()) * scale;
                estimate(line.text(), start, Math.min(end, offset + seconds), maxChars, screens);
            }
            if (!screens.isEmpty()) {
                withLines++;
                if (heard != null && alignClip(screens, heard, offset, offset + seconds)) aligned++;
                polish(screens, offset, offset + seconds);
                all.addAll(screens);
            }
            offset += seconds;
        }
        return new Aligned(toCaptions(all), withLines > 0 && aligned * 2 >= withLines);
    }

    /** 未知台词：字幕内容就是识别出来的字。 */
    public static List<Caption> fromHeard(List<Segment> heard, int maxChars, double total) {
        List<Screen> out = new ArrayList<>();
        for (Segment s : heard) {
            if (s.text() == null || s.text().isBlank() || hallucination(s.text())) continue;
            List<Screen> screens = new ArrayList<>();
            estimate(s.text(), s.start(), s.end(), maxChars, screens);
            // 一段里有好几句时，有逐词时间就按词对时，比按字数平分准。
            if (s.words() != null && !s.words().isEmpty()) alignClip(screens, s.words(), s.start(), s.end());
            out.addAll(screens);
        }
        polish(out, 0, total);
        return toCaptions(out);
    }

    /**
     * 用静音检测校正识别时间：Whisper 系模型的段落起点常粘在 0 秒（docs/audits/director-h3-video-prompt-ab-2026-10.md 第 34 行），
     * 所以把每段收缩到真正有声音的范围。整段都落在静音里的是幻听，直接去掉。没有静音（比如有环境声）时不起作用。
     *
     * @param silences 静音区间 {开始, 结束}，按时间排序
     */
    public static List<Segment> fitToVoice(List<Segment> segments, List<double[]> silences) {
        if (silences.isEmpty()) return segments;
        List<Segment> out = new ArrayList<>();
        for (Segment s : segments) {
            double start = s.start(), end = s.end();
            for (double[] gap : silences) if (start >= gap[0] && start < gap[1]) start = gap[1];
            for (int i = silences.size() - 1; i >= 0; i--) { double[] gap = silences.get(i); if (end > gap[0] && end <= gap[1]) end = gap[0]; }
            if (end - start < 0.15) continue;
            List<Segment> words = null;
            if (s.words() != null) {
                words = new ArrayList<>();
                double span = s.end() - s.start(), scale = span > 0 ? (end - start) / span : 1;
                for (Segment w : s.words()) words.add(new Segment(start + (w.start() - s.start()) * scale, start + (w.end() - s.start()) * scale, w.text()));
            }
            out.add(new Segment(start, end, s.text(), words));
        }
        return out;
    }

    static boolean hallucination(String text) {
        String t = text.replaceAll("\\s", "");
        return HALLUCINATIONS.stream().anyMatch(t::contains);
    }

    /** 一句话在 [start, end] 里按字数分给每一屏。 */
    private static void estimate(String text, double start, double end, int maxChars, List<Screen> out) {
        List<String> parts = screens(text, maxChars);
        if (parts.isEmpty()) return;
        int chars = parts.stream().mapToInt(StudioCaptionAligner::len).sum();
        double span = Math.max(end - start, parts.size() * MIN_SECONDS), at = start;
        for (String part : parts) {
            double d = span * len(part) / chars;
            out.add(new Screen(part, at, at + d));
            at += d;
        }
    }

    /** 逐字最长公共子序列：台词里的字对到识别结果的字，取每屏第一个、最后一个对上的字的时间。 */
    private static boolean alignClip(List<Screen> screens, List<Segment> heard, double from, double to) {
        List<int[]> known = new ArrayList<>(); // {codePoint, screenIndex}
        for (int i = 0; i < screens.size(); i++) for (int cp : screens.get(i).text.codePoints().toArray())
            if (Character.isLetterOrDigit(cp)) known.add(new int[]{Character.toLowerCase(cp), i});
        List<Integer> chars = new ArrayList<>();
        List<Double> times = new ArrayList<>();
        for (Segment s : heard) {
            if (s.end() <= from || s.start() >= to || s.text() == null) continue;
            for (Segment piece : s.words() != null && !s.words().isEmpty() ? s.words() : List.of(s)) {
                int[] cps = piece.text().codePoints().filter(Character::isLetterOrDigit).map(Character::toLowerCase).toArray();
                for (int i = 0; i < cps.length; i++) {
                    chars.add(cps[i]);
                    times.add(piece.start() + (piece.end() - piece.start()) * (i + 0.5) / cps.length);
                }
            }
        }
        int n = known.size(), m = chars.size();
        if (n == 0 || m == 0 || (long) n * m > MAX_ALIGN_CELLS) return false;
        int[][] dp = new int[n + 1][m + 1];
        for (int i = n - 1; i >= 0; i--) for (int j = m - 1; j >= 0; j--)
            dp[i][j] = known.get(i)[0] == chars.get(j) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        if ((double) dp[0][0] / n < MIN_MATCH_RATIO) return false;
        double[] first = new double[screens.size()], last = new double[screens.size()];
        java.util.Arrays.fill(first, -1);
        for (int i = 0, j = 0; i < n && j < m; ) {
            if (known.get(i)[0] == chars.get(j)) {
                int screen = known.get(i)[1];
                double t = times.get(j);
                if (first[screen] < 0) first[screen] = t;
                last[screen] = t;
                i++; j++;
            } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
            else j++;
        }
        for (int i = 0; i < screens.size(); i++) if (first[i] >= 0) {
            Screen s = screens.get(i);
            s.start = Math.max(from, first[i] - 0.08);
            s.end = Math.min(to, last[i] + 0.25);
            s.matched = true;
        }
        // 没对上的屏放在前后对上的屏之间，不跑到别的句子时间里。
        for (int i = 0; i < screens.size(); i++) if (!screens.get(i).matched) {
            double lo = from, hi = to;
            for (int k = i - 1; k >= 0; k--) if (screens.get(k).matched) { lo = screens.get(k).end; break; }
            for (int k = i + 1; k < screens.size(); k++) if (screens.get(k).matched) { hi = screens.get(k).start; break; }
            Screen s = screens.get(i);
            double d = s.end - s.start;
            s.start = Math.min(Math.max(lo, s.start), Math.max(lo, hi - d));
            s.end = Math.min(hi, s.start + d);
        }
        return true;
    }

    /** 收尾：按顺序不重叠、每屏至少显示一会儿、放不下时整体等比压缩（不丢字幕）、短间隔连上。 */
    private static void polish(List<Screen> screens, double from, double to) {
        if (screens.isEmpty()) return;
        double at = from;
        for (Screen s : screens) {
            s.start = Math.max(s.start, at);
            s.end = Math.max(s.end, s.start + MIN_SECONDS);
            at = s.end;
        }
        if (at > to && to > from) {
            double scale = (to - from) / (at - from);
            for (Screen s : screens) { s.start = from + (s.start - from) * scale; s.end = from + (s.end - from) * scale; }
        }
        for (int i = 0; i + 1 < screens.size(); i++) {
            Screen s = screens.get(i), next = screens.get(i + 1);
            if (next.start - s.end < JOIN_GAP) s.end = next.start;
        }
    }

    private static List<Caption> toCaptions(List<Screen> screens) {
        List<Caption> out = new ArrayList<>(screens.size());
        for (Screen s : screens) out.add(new Caption(round(s.start), round(s.end), s.text));
        return out;
    }

    private static double round(double v) { return Double.parseDouble(String.format(Locale.ROOT, "%.3f", v)); }
}
