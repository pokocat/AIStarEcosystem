package com.aistareco.aep.ipstudio.h3;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 提交 H3 视频前，把用户看到的中文提示词改写成 H3 官方写法（MiniMax 官方 skill 原文，{@code resources/h3-skill}）。
 * AI 导演台的片段视频、Studio 画布与创作助手出视频共用这一份。
 *
 * <p>为什么要改写：2026-10-26 同一片段对比实测（docs/audits/director-h3-video-prompt-ab-2026-10.md §6）——台词多时，
 * 中文正文会吞掉整句台词、还会把提示词里的中文念出来；英文正文 + 中文 {@code <d>} 台词都完整。官方 skill 正是这么要求的。
 *
 * <p>台词有两种处理：
 * <ul>
 *   <li><b>代码填</b>（{@code codeLines}）：原文按「某某说：「…」」写的（导演台、创作助手），台词换成 {@code {{L1}}} 占位交给模型，
 *       模型只写画面；提交时用当前台词填成 {@code (Sx) <d>[语言] 原文</d>}（{@link #fill}）。</li>
 *   <li><b>模型写</b>：画布上用户自己写的提示词认不出格式，由模型照官方写法自己写 {@code <d>}，这里逐句核对原文台词。</li>
 * </ul>
 *
 * <p>检查只给提示、不拦人（2026-10-26 用户定）：能修的就地修好并说明（漏了的台词补回所在镜头、零星没翻译的中文删掉、
 * 漏写环境声补一句中性默认），修不了的写进 {@code warnings}，用不了（超长）标 {@code usable=false}。
 * 只有模型的输出根本拼不出提示词时才判失败（{@code AI_BAD_OUTPUT}，全额退回）。
 */
public final class H3PromptRewrite {
    private H3PromptRewrite() {}

    /** 改写规则的版本：skill 原文或输出约定变了就加一，已存的英文稿随之失效、下次重新改写。 */
    public static final int VERSION = 1;
    /** 三个入口共用后台独立用途绑定；端点、密钥、售价均由后台管理。 */
    public static final com.aistareco.aep.model.AiModelPurpose PURPOSE = com.aistareco.aep.model.AiModelPurpose.DAP_VIDEO_PROMPT;
    public static final int MAX_TOKENS = 4_096;
    public static final int MAX_PROMPT_CHARS = 7_000;
    /** 镜头由模型定时（画布上的提示词没分镜头）最多这么多镜。 */
    public static final int MAX_FREE_SHOTS = 8;

    /** H3 的四种生成模式，对应官方 skill 的 T2VA / I2VA / FL2VA / Ref2VA。 */
    public enum Mode {
        T2V("T2VA", "text-to-video"), I2V("I2VA", "first-frame image-to-video"),
        FL2V("FL2VA", "first-and-last-frame"), REF("Ref2VA", "full-reference");
        final String code, label;
        Mode(String code, String label) { this.code = code; this.label = label; }

        /** 厂商 wire 值（{@code generationMode}）→ 模式；认不出按纯文字。 */
        public static Mode of(String generationMode) {
            return switch (generationMode == null ? "" : generationMode) {
                case "i2v" -> I2V;
                case "first_last_frame_video" -> FL2V;
                case "universal_reference_video" -> REF;
                default -> T2V;
            };
        }

        static Mode wire(String value) {
            for (Mode m : values()) if (m.name().equalsIgnoreCase(value)) return m;
            return REF; // 2026-10-26 首发的导演台只有全能参考，那时的任务输入没写模式
        }
    }

    /** 一句台词：L1… 是占位编号，S1… 是说话人编号（按第一次开口的顺序，同一个人跨镜头不变）。 */
    public record Line(String id, String speaker, String sid, String text, boolean offscreen) {}

    /** 交给模型的中文原文（台词已换成占位）与认出来的台词。 */
    public record Source(String text, List<Line> lines) {}

    /**
     * 一次改写的输入。{@code references} 是按提交顺序的参考素材说明（「&lt;Picture 1&gt;: …」）；
     * {@code shots} 为 null 时镜头由模型定；{@code storyboard} 表示原文由导演台的分镜生成。
     */
    public record Request(Mode mode, int seconds, List<String> references, Source source, boolean codeLines,
                          Integer shots, List<Double> starts, String language, boolean storyboard) {}

    /** 模板写法：「林小雅说：「…」」「旁白在画外说：「…」」。只匹配到开引号，台词到配对的收引号为止（见 {@link #closing}）。 */
    private static final Pattern LINE = Pattern.compile("([^\\s，。：；！？、「」“”（）()]{1,24}?)(在画外)?说：「");
    /** 2026-10-26 之前的导演台模板（用户改写过、还留着旧格式的提示词）：「第2镜 · @林小雅 · “…”」。 */
    private static final Pattern LEGACY_LINE = Pattern.compile("@([^\\s·]{1,24}) · “");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(L\\d+)}}");
    private static final Pattern SPOKEN = Pattern.compile("<d>[\\s\\S]*?</d>");
    private static final String SPOKEN_MARK = "\u0001";

    // ── 系统提示词 ─────────────────────────────────────────────────────────

    /** 导演台首发时的输出约定，原文不动（线上 74 次真实改写按它验过）：全能参考 + 镜头固定 + 台词代码填。 */
    private static final String CONTRACT_DIRECTOR = """

            # Output contract for this service

            This contract replaces the plain-text output format in the guide above. Follow the guide for what to write; follow this contract for how to return it.

            Return exactly one JSON object and nothing else: the JSON skeleton given at the end of the request, with every key kept and every value filled in.

            - Each value is the English body of that section, without the section name. Separate lines inside a value with \\n.
            - "style": the one or two sentences that open detailed_description, before [Shot 1].
            - "shot_1", "shot_2", ...: one key per shot of the request, in the same order; fill every one of them, the last shot included. Write only the body of each shot: no "[Shot N]" and no timestamp, the system adds them. Every shot after the first begins with "the camera cuts to" or "the shot cuts to".
            - Keep what the request says about who is in each shot. When it says only one character is in the frame, say so.
            - Spoken lines appear in the request as {{L1}}, {{L2}}, ... Put each one exactly once, in the shot where it is spoken, right after the words that introduce the speaker and how they speak, for example: <Subject 2>, the older guard, says in a rough, low voice: {{L1}}
              For a line spoken off screen, write: says in an off-screen voiceover: {{L2}} while the on-screen character's lips remain closed.
              Do not write the words of a line, quotation marks around it, <d> tags, or speaker IDs such as (S1); the system inserts them.
            - Apart from visible on-screen text, write no Chinese characters: write character names in pinyin. Visible on-screen text (a sign, a screen, a document) is the only exception: it goes in English double quotation marks in its original language, exactly as the guide says.
            - Output the JSON object directly. Do not write your reasoning, notes or any text before or after it.
            - non_diegetic_music: "N/A" unless the request asks for music.
            """;

    private static String skillRef, skillBase;

    /**
     * 系统提示词：官方 skill 原文（全能参考带两份写法规范，其余模式只带基础模式那份）+ 本服务的输出约定。
     * 导演台那一种组合（全能参考、镜头固定、台词代码填）的约定原样保留。
     */
    public static synchronized String system(Mode mode, boolean codeLines, boolean fixedShots) {
        if (skillRef == null) {
            skillBase = resource("SKILL.md") + "\n\n# references/base-en.txt\n\n" + resource("base-en.txt");
            skillRef = skillBase + "\n\n# references/ref-en.txt\n\n" + resource("ref-en.txt");
        }
        String skill = mode == Mode.REF ? skillRef : skillBase;
        if (mode == Mode.REF && codeLines && fixedShots) return skill + CONTRACT_DIRECTOR;
        return skill + contract(mode, codeLines, fixedShots);
    }

    private static String contract(Mode mode, boolean codeLines, boolean fixedShots) {
        String body = mode == Mode.REF ? "detailed_description" : "integrated_multimodal_description";
        StringBuilder c = new StringBuilder("""

                # Output contract for this service

                This contract replaces the plain-text output format in the guide above. Follow the guide for what to write; follow this contract for how to return it.

                Return exactly one JSON object and nothing else: the JSON skeleton given at the end of the request, with every key kept and every value filled in.

                - Each value is the English body of that section, without the section name. Separate lines inside a value with \\n.
                """);
        c.append("- \"style\": the one or two sentences that open ").append(body).append(", before [Shot 1].\n");
        if (mode == Mode.I2V || mode == Mode.FL2V)
            c.append("- Do not write the picture-alignment instruction line that opens the final prompt; the system adds it.\n");
        if (fixedShots) c.append("""
                - "shot_1", "shot_2", ...: one key per shot of the request, in the same order; fill every one of them, the last shot included. Write only the body of each shot: no "[Shot N]" and no timestamp, the system adds them. Every shot after the first begins with "the camera cuts to" or "the shot cuts to".
                - Keep what the request says about who is in each shot. When it says only one character is in the frame, say so.
                """);
        else c.append("""
                - "shots": the shots of the target video in order, one object each: {"start": seconds from the start of the video, "text": the body of the shot}. Decide the shots from the request; use one shot when the request describes one continuous take, and at most %d shots. The first shot starts at 0 and every start is earlier than the video ends. Write only the body: no "[Shot N]" and no timestamp, the system adds them. Every shot after the first begins with "the camera cuts to" or "the shot cuts to".
                """.formatted(MAX_FREE_SHOTS));
        if (codeLines) c.append("""
                - Spoken lines appear in the request as {{L1}}, {{L2}}, ... Put each one exactly once, in the shot where it is spoken, right after the words that introduce the speaker and how they speak, for example: <Subject 2>, the older guard, says in a rough, low voice: {{L1}}
                  For a line spoken off screen, write: says in an off-screen voiceover: {{L2}} while the on-screen character's lips remain closed.
                  Do not write the words of a line, quotation marks around it, <d> tags, or speaker IDs such as (S1); the system inserts them.
                - Apart from visible on-screen text, write no Chinese characters: write character names in pinyin. Visible on-screen text (a sign, a screen, a document) is the only exception: it goes in English double quotation marks in its original language, exactly as the guide says.
                """);
        else c.append("""
                - Write every line the request says someone speaks exactly as the guide says: speaker ID before it, and inside <d> only the language tag and the line, word for word in its original language, for example: (S1) says: <d>[Chinese] 你来了。</d> Do not translate, shorten or merge lines, and do not add lines the request does not have.
                - Apart from the words inside <d> and visible on-screen text, write no Chinese characters: write character names in pinyin. Visible on-screen text (a sign, a screen, a document) goes in English double quotation marks in its original language, exactly as the guide says.
                """);
        c.append("""
                - Output the JSON object directly. Do not write your reasoning, notes or any text before or after it.
                - non_diegetic_music: "N/A" unless the request asks for music.
                """);
        return c.toString();
    }

    private static String resource(String name) {
        try (InputStream in = H3PromptRewrite.class.getResourceAsStream("/h3-skill/" + name)) {
            if (in == null) throw new IllegalStateException("缺少 H3 写法资源 " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("读取 H3 写法资源失败 " + name, e);
        }
    }

    // ── 认台词 ─────────────────────────────────────────────────────────────

    /**
     * 从中文提示词里认出台词，换成 {@code {{Ln}}}。说话人名字以已知的名字为准（「画面里只有林小雅。林小雅说」只认「林小雅」）。
     * 说话人编号按第一次开口的顺序分配，旁白也算一个说话人。
     */
    public static Source source(String zh, List<String> knownNames) {
        List<String> names = new ArrayList<>(knownNames);
        names.sort(Comparator.comparingInt(String::length).reversed());
        List<Line> lines = new ArrayList<>();
        Map<String, String> sids = new LinkedHashMap<>();
        StringBuilder out = new StringBuilder();
        Matcher m = LINE.matcher(zh);
        int last = 0, pos = 0;
        while (pos < zh.length() && m.find(pos)) {
            int open = m.end(), end = closing(zh, open, '「', '」');
            pos = end < 0 ? open : end + 1;
            if (end < 0) continue; // 引号没配上：不算台词，句数核对会拦下
            String speaker = known(m.group(1), names);
            String id = "L" + (lines.size() + 1);
            String sid = sids.computeIfAbsent(speaker, k -> "S" + (sids.size() + 1));
            lines.add(new Line(id, speaker, sid, zh.substring(open, end), m.group(2) != null));
            out.append(zh, last, open - 1).append("{{").append(id).append("}}");
            last = end + 1;
        }
        out.append(zh.substring(last));
        if (!lines.isEmpty()) return new Source(out.toString(), lines);
        // 旧格式：台词集中在【语音轨】里，按同样的规则换成占位。
        out.setLength(0); last = 0; pos = 0;
        m = LEGACY_LINE.matcher(zh);
        while (pos < zh.length() && m.find(pos)) {
            int open = m.end(), end = closing(zh, open, '“', '”');
            pos = end < 0 ? open : end + 1;
            if (end < 0) continue;
            String speaker = known(m.group(1), names);
            String id = "L" + (lines.size() + 1);
            String sid = sids.computeIfAbsent(speaker, k -> "S" + (sids.size() + 1));
            lines.add(new Line(id, speaker, sid, zh.substring(open, end), "旁白".equals(speaker)));
            out.append(zh, last, open - 1).append("{{").append(id).append("}}");
            last = end + 1;
        }
        out.append(zh.substring(last));
        return new Source(out.toString(), lines);
    }

    /**
     * 认完台词后剩下的正文里，台词引号是否都成对。用户改写过的提示词只能核对句数，「甲说：「把」这个符号念出来。」」
     * 会只认出「把」、句数照样对得上，后半句留给模型（2026-10-26 Codex 复核）。
     */
    public static boolean quotesBalanced(String text, boolean legacy) {
        char open = legacy ? '“' : '「', close = legacy ? '”' : '」';
        int depth = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == open) depth++;
            else if (ch == close && --depth < 0) return false;
        }
        return depth == 0;
    }

    /**
     * 开引号之后配对的收引号位置，台词里可以再套一层同样的引号（「他喊「别走」，然后离开。」）；配不上返回 -1。
     * 2026-10-26 评审：原来用非贪婪的「(.+?)」」，这样的台词只认出「他喊「别走」，剩下半句进了交给模型的正文。
     */
    static int closing(String s, int from, char open, char close) {
        int depth = 1;
        for (int i = from; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == open) depth++;
            else if (ch == close && --depth == 0) return i;
        }
        return -1;
    }

    private static String known(String captured, List<String> namesLongestFirst) {
        for (String n : namesLongestFirst) if (!n.isBlank() && captured.endsWith(n)) return n;
        return captured;
    }

    /** 中文原文里每一镜（「第N镜（」或旧语音轨「第N镜 · 」开头的一段）有哪几个台词占位；不按这个格式写的原文返回空。 */
    public static Map<Integer, List<String>> linesByShot(String source) {
        Map<Integer, List<String>> out = new LinkedHashMap<>();
        // 「第N镜（」是新格式的画面段；「第N镜 · 」是旧格式语音轨里每句台词的开头，台词集中在末尾时按它归到各自的镜头。
        Matcher shot = Pattern.compile("第(\\d+)镜(?:（| · )").matcher(source);
        List<int[]> marks = new ArrayList<>();
        while (shot.find()) marks.add(new int[]{Integer.parseInt(shot.group(1)), shot.start()});
        for (int k = 0; k < marks.size(); k++) {
            int end = k + 1 < marks.size() ? marks.get(k + 1)[1] : source.length();
            Matcher m = PLACEHOLDER.matcher(source.substring(marks.get(k)[1], end));
            while (m.find()) out.computeIfAbsent(marks.get(k)[0], x -> new ArrayList<>()).add("{{" + m.group(1) + "}}");
        }
        return out;
    }

    private static final Pattern SHOT_HEAD = Pattern.compile("第(\\d+)镜（\\s*(\\d+(?:\\.\\d+)?)\\s*(?:秒|[–\\-~～至到])");

    /**
     * 原文自己分了镜头（「第1镜（0–3 秒）」「第2镜（3 秒切）」）时的镜头开始时间；没分、或编号不连续、时间不递增、超出总时长时返回 null，
     * 由模型自己定镜头。创作助手照导演台的格式写，就走这里。
     */
    public static List<Double> shotStarts(String zh, int seconds) {
        Matcher m = SHOT_HEAD.matcher(zh);
        List<Double> starts = new ArrayList<>();
        while (m.find()) {
            if (Integer.parseInt(m.group(1)) != starts.size() + 1) return null;
            double at = Double.parseDouble(m.group(2));
            if (!starts.isEmpty() && at <= starts.get(starts.size() - 1) || at >= seconds) return null;
            starts.add(at);
        }
        if (starts.isEmpty() || starts.get(0) != 0) return null;
        return starts;
    }

    /** 台词的语言标签：作品设置里的语言，认不出按中文。 */
    public static String languageTag(String language) {
        if (language == null) return "Chinese";
        String l = language.trim().toLowerCase(Locale.ROOT);
        if (l.startsWith("英") || l.startsWith("en")) return "English";
        if (l.startsWith("粤") || l.contains("cantonese")) return "Cantonese";
        return "Chinese";
    }

    // ── 用户消息 ───────────────────────────────────────────────────────────

    /**
     * 用户消息：目标视频、按提交顺序的参考素材清单、带占位的中文原文、（镜头固定时）每镜有哪几句台词，最后是要填的 JSON 骨架。
     * 骨架把 shot_1…shot_N 的键都列出来：2026-10-26 真模型试跑，让模型自己往数组里写镜头，3 段里 2 段只写了第 1 镜就收尾。
     */
    public static String user(Request r) {
        boolean fixed = r.shots() != null;
        // 环境声、配乐排在镜头前：2026-10-26 线上 21 段评测，排在后面时 4 镜的片段 7/36 次写完 shot_4 就收尾、漏了这两项。
        StringBuilder perShot = new StringBuilder(), skeleton = new StringBuilder("{");
        if (r.mode() == Mode.REF) skeleton.append("\"subject_definitions\":\"\",\"summary\":\"\",\"retention_analysis\":\"\",");
        skeleton.append("\"style\":\"\",\"overall_soundscape\":\"\",\"non_diegetic_music\":\"\"");
        if (fixed) {
            Map<Integer, List<String>> byShot = linesByShot(r.source().text());
            for (int i = 1; i <= r.shots(); i++) {
                List<String> ids = byShot.getOrDefault(i, List.of());
                perShot.append("Shot ").append(i).append(": ").append(ids.isEmpty() ? "no spoken lines" : String.join(", ", ids)).append('\n');
                skeleton.append(",\"shot_").append(i).append("\":\"\"");
            }
        } else skeleton.append(",\"shots\":[{\"start\":0,\"text\":\"\"}]");
        skeleton.append('}');
        boolean audio = r.references().stream().anyMatch(x -> x.startsWith("<Audio "));
        if (r.mode() == Mode.REF && fixed && r.codeLines() && r.storyboard()) {
            // 导演台首发时的原文，不动。
            return """
                    Rewrite the following request into the H3 full-reference (Ref2VA) format, following the guide and the output contract.

                    Target video: %d seconds, %d shot%s, full-reference generation.

                    Reference assets, in the exact order they are attached:
                    %s

                    The reference images are authoritative for appearance; use the written notes only where they agree with the images.

                    Request (Chinese, written by our storyboard step; %s):
                    <<<
                    %s
                    >>>

                    Spoken lines in each shot of the request:
                    %s
                    Fill in this JSON skeleton and return it (all %d shot keys):
                    %s
                    """.formatted(r.seconds(), r.shots(), r.shots() == 1 ? "" : "s", String.join("\n", r.references()),
                    // 没有音频参考就别提「音频N」：2026-10-26 线上评测里模型据此编出一个 <Audio 1> 给画外音用。
                    audio ? "参考图N means <Picture N>, 音频N means <Audio N>"
                            : "参考图N means <Picture N>; no reference audio is attached, so use no <Audio N> label",
                    r.source().text().strip(), perShot, r.shots(), skeleton);
        }
        StringBuilder u = new StringBuilder("Rewrite the following request into the H3 ").append(r.mode().label).append(" (").append(r.mode().code)
                .append(") format, following the guide and the output contract.\n\n");
        u.append("Target video: ").append(r.seconds()).append(" seconds");
        if (fixed) u.append(", ").append(r.shots()).append(r.shots() == 1 ? " shot" : " shots");
        u.append(", ").append(r.mode().label).append(" generation.\n\n");
        if (!r.references().isEmpty()) {
            u.append("Reference assets, in the exact order they are attached:\n").append(String.join("\n", r.references())).append("\n\n");
            if (r.mode() == Mode.REF) u.append("The reference images are authoritative for appearance; use the written notes only where they agree with the images.\n\n");
        }
        u.append("Request (Chinese, written by ").append(r.storyboard() ? "our storyboard step" : "the user").append("; ")
                .append(labelNote(r.mode(), r.references())).append("):\n<<<\n").append(r.source().text().strip()).append("\n>>>\n\n");
        if (fixed && r.codeLines()) u.append("Spoken lines in each shot of the request:\n").append(perShot).append('\n');
        u.append("Fill in this JSON skeleton and return it").append(fixed ? " (all " + r.shots() + " shot keys)" : "").append(":\n").append(skeleton).append('\n');
        return u.toString();
    }

    /** 中文原文里怎么称呼参考素材：画布上是「@图1」「@视频1」「@音频1」，导演台是「参考图N」「音频N」。 */
    private static String labelNote(Mode mode, List<String> references) {
        boolean audio = references.stream().anyMatch(x -> x.startsWith("<Audio ")), video = references.stream().anyMatch(x -> x.startsWith("<Video "));
        return switch (mode) {
            case T2V -> "no reference is attached, so use no <Picture N>, <Video N> or <Audio N> label";
            case I2V -> "the attached first frame is <Picture 1>";
            case FL2V -> "the attached first frame is Picture 1 and the last frame is Picture 2";
            case REF -> "图N, 参考图N or @图N means <Picture N>"
                    + (video ? ", 视频N or @视频N means <Video N>" : "")
                    + (audio ? ", 音频N or @音频N means <Audio N>" : "; no reference audio is attached, so use no <Audio N> label");
        };
    }

    // ── 核对信息（存进任务输入，worker 校验时用）──────────────────────────────

    /** 写进任务输入的核对信息：模式、镜头、每镜开始时间、参考素材数量、台词（带所在镜头）。 */
    public static ObjectNode meta(ObjectMapper om, Request r, int pictures, int videos, int audios) {
        boolean fixed = r.shots() != null;
        ObjectNode meta = om.createObjectNode().put("task", "videoPrompt").put("mode", r.mode().name()).put("codeLines", r.codeLines())
                .put("shots", fixed ? r.shots() : 0).put("seconds", r.seconds())
                .put("pictures", pictures).put("videos", videos).put("audios", audios).put("language", languageTag(r.language()));
        ArrayNode cuts = meta.putArray("starts");
        if (fixed) r.starts().forEach(cuts::add);
        Map<String, Integer> shotOf = new HashMap<>();
        linesByShot(r.source().text()).forEach((shot, ids) -> ids.forEach(id -> shotOf.put(id.substring(2, id.length() - 2), shot)));
        ArrayNode ls = meta.putArray("lines");
        for (Line l : r.source().lines()) {
            ObjectNode x = ls.addObject().put("id", l.id()).put("sid", l.sid()).put("text", l.text());
            if (shotOf.containsKey(l.id())) x.put("shot", shotOf.get(l.id()));
        }
        // 模型写台词时，核对用原文里看着像台词的句子（与前端「台词提醒」同一套认法）。
        if (!r.codeLines()) {
            ArrayNode spoken = meta.putArray("spoken");
            for (String[] line : spokenLines(r.source().text())) spoken.addObject().put("speaker", line[0]).put("text", line[1]);
        }
        return meta;
    }

    /** 任务输入里的台词（填占位用）。 */
    public static List<Line> lines(JsonNode meta) {
        List<Line> out = new ArrayList<>();
        meta.path("lines").forEach(l -> out.add(new Line(l.path("id").asText(), "", l.path("sid").asText(), l.path("text").asText(), false)));
        return out;
    }

    // ── 校验与组装（worker 内执行）─────────────────────────────────────────────

    /**
     * 把模型的 JSON 拼成 H3 提示词。返回 {@code {template, warnings[], notes[], usable}}：{@code template} 里台词还是占位（代码填时）；
     * {@code warnings} 是要用户判断的提示（台词漏了 / 放错镜头 / 模型加了台词 / 缺镜头 / 大段没翻译 / 太长），有它时画布与导演台手动生成先停下来让用户选；
     * {@code notes} 是已经自动处理好的小事（零星中文删掉、引用不存在素材的句子删掉），只记一笔不打扰（2026-10-27 用线上 74 次真实改写看过：
     * 7 次只有这类小事，不该为它停下来）。{@code usable=false} 表示这一稿不能直接用（超长）。拼不出提示词时才抛 {@code AI_BAD_OUTPUT}（全额退回）。
     */
    public static ObjectNode validate(ObjectMapper om, JsonNode meta, JsonNode out) {
        if (out == null || !out.isObject()) throw bad("没有返回 JSON");
        Mode mode = Mode.wire(meta.path("mode").asText(null));
        boolean codeLines = !meta.has("codeLines") || meta.path("codeLines").asBoolean();
        int fixedShots = meta.path("shots").asInt(0), seconds = meta.path("seconds").asInt(0);
        Set<String> warnings = new LinkedHashSet<>(), notes = new LinkedHashSet<>();
        int[] strayHan = {0};

        // 镜头
        List<String> bodies = new ArrayList<>();
        List<Double> starts = new ArrayList<>();
        meta.path("starts").forEach(x -> starts.add(x.asDouble()));
        JsonNode arr = out.path("shots");
        if (fixedShots > 0) {
            if (arr.isArray()) arr.forEach(x -> bodies.add(x.isTextual() ? x.asText() : x.path("text").asText("")));
            else for (int i = 1; i <= fixedShots; i++) bodies.add(text(out, "shot_" + i));
            while (bodies.size() > fixedShots) bodies.remove(bodies.size() - 1);
            while (bodies.size() < fixedShots) bodies.add("");
        } else {
            if (arr.isArray()) for (JsonNode x : arr) {
                if (bodies.size() == MAX_FREE_SHOTS) break;
                String t = x.isTextual() ? x.asText() : x.path("text").asText("");
                if (t.isBlank()) continue;
                bodies.add(t);
                starts.add(x.isObject() ? seconds(x.path("start")) : -1);
            }
            else if (out.hasNonNull("shot_1")) for (int i = 1; i <= MAX_FREE_SHOTS && out.hasNonNull("shot_" + i); i++) { bodies.add(text(out, "shot_" + i)); starts.add(-1.0); }
            if (bodies.isEmpty()) throw bad("没有写镜头");
            fixStarts(starts, seconds);
        }
        for (int i = 0; i < bodies.size(); i++) bodies.set(i, clean(stripShotPrefix(bodies.get(i).strip()), strayHan, codeLines));

        String defs = "", summary = "", retention = "";
        if (mode == Mode.REF) {
            defs = clean(text(out, "subject_definitions"), strayHan, codeLines);
            summary = clean(text(out, "summary"), strayHan, codeLines);
            retention = clean(text(out, "retention_analysis"), strayHan, codeLines);
        }
        String style = clean(text(out, "style"), strayHan, codeLines), sound = clean(text(out, "overall_soundscape"), strayHan, codeLines),
                music = clean(text(out, "non_diegetic_music"), strayHan, codeLines);

        // 引用了不存在的参考素材的句子删掉（不含台词时）：2026-10-26 线上评测，模型给画外音编了一个 <Audio 1>。
        Map<String, Integer> limits = Map.of("Picture", meta.path("pictures").asInt(), "Video", meta.path("videos").asInt(), "Audio", meta.path("audios").asInt());
        String[] fields = {defs, summary, retention, style, sound, music};
        for (int i = 0; i < fields.length; i++) {
            String kept = dropUnknownLabels(fields[i], limits);
            if (!kept.equals(fields[i])) notes.add("去掉了引用不存在素材的句子");
            fields[i] = kept;
        }
        defs = fields[0]; summary = fields[1]; retention = fields[2]; style = fields[3]; sound = fields[4]; music = fields[5];
        for (int i = 0; i < bodies.size(); i++) {
            String kept = dropUnknownLabels(bodies.get(i), limits);
            if (!kept.equals(bodies.get(i))) notes.add("去掉了引用不存在素材的句子");
            bodies.set(i, kept);
        }
        // 漏写环境声不算错：用中性的一句补上，不让它编声音；配乐漏写就是没有。
        if (sound.isEmpty()) sound = DEFAULT_SOUNDSCAPE;
        if (music.isEmpty()) music = "N/A";
        if (mode == Mode.REF) {
            if (defs.isEmpty() && summary.isEmpty() && retention.isEmpty()) throw bad("缺少主体说明");
            if (defs.isEmpty()) warnings.add("优化稿缺少主体说明（subject_definitions），人物可能对不上参考图");
            if (summary.isEmpty()) warnings.add("优化稿缺少概述（summary）");
            if (retention.isEmpty()) warnings.add("优化稿缺少保留说明（retention_analysis），人物外观可能不一致");
        }
        boolean anyShot = false;
        for (int i = 0; i < bodies.size(); i++) {
            if (!bodies.get(i).isEmpty()) { anyShot = true; continue; }
            bodies.set(i, i == 0 ? "The shot opens on the scene described in the request." : "the camera cuts to the next shot of the request.");
            warnings.add("第 " + (i + 1) + " 镜模型没写画面，只补了一句过渡");
        }
        if (!anyShot) throw bad("没有写镜头");

        if (codeLines) {
            // 台词只能在镜头里：放到镜头外的先摘掉，下面当作漏了的补回所在镜头。
            String[] outside = {defs, summary, retention, style, sound, music};
            for (int i = 0; i < outside.length; i++) if (PLACEHOLDER.matcher(outside[i]).find()) {
                outside[i] = PLACEHOLDER.matcher(outside[i]).replaceAll("").replaceAll("[ \\t]{2,}", " ").strip();
                warnings.add("有台词被放到了镜头以外，已移回所在镜头");
            }
            defs = outside[0]; summary = outside[1]; retention = outside[2]; style = outside[3]; sound = outside[4]; music = outside[5];
            placeLines(meta, bodies, warnings);
        } else checkSpoken(meta, bodies, warnings);
        if (strayHan[0] > MAX_STRAY_HAN) warnings.add("优化稿里有 " + strayHan[0] + " 个汉字没翻译，已删掉，画面描述可能缺了内容");
        else if (strayHan[0] > 0) notes.add("删掉了优化稿里零星没翻译的中文");

        String template = assemble(mode, bodies, starts, seconds, defs, summary, retention, style, sound, music);
        boolean usable = true;
        if (fill(template, lines(meta), meta.path("language").asText("Chinese")).length() > MAX_PROMPT_CHARS) {
            usable = false;
            warnings.add("优化稿超过 " + MAX_PROMPT_CHARS + " 字符，H3 收不下，请缩短提示词或按原文生成");
        }
        ObjectNode result = om.createObjectNode().put("template", template).put("usable", usable);
        ArrayNode w = result.putArray("warnings");
        warnings.forEach(w::add);
        ArrayNode n = result.putArray("notes");
        notes.forEach(n::add);
        return result;
    }

    private static String assemble(Mode mode, List<String> bodies, List<Double> starts, int seconds,
                                   String defs, String summary, String retention, String style, String sound, String music) {
        StringBuilder detail = new StringBuilder();
        String gap = mode == Mode.REF ? "\n" : " ";
        if (!style.isEmpty()) detail.append(style).append(gap);
        for (int i = 0; i < bodies.size(); i++) {
            if (i > 0) detail.append(gap);
            detail.append("[Shot ").append(i + 1).append("] ");
            if (i > 0) detail.append("At ").append(clock(i < starts.size() ? starts.get(i) : 0)).append(", ");
            detail.append(bodies.get(i));
        }
        if (mode == Mode.REF) return "subject_definitions:\n" + defs + "\n\nsummary:\n" + summary + "\n\nretention_analysis:\n" + retention
                + "\n\ndetailed_description:\n" + detail + "\n\noverall_soundscape:\n" + sound + "\n\nnon_diegetic_music:\n" + music;
        String instruction = switch (mode) {
            case I2V -> "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.\n\n";
            case FL2V -> "How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot "
                    + bodies.size() + ") aligns with the " + String.format(Locale.ROOT, "%.2f", (double) seconds) + "-second mark of the target video.\n\n";
            default -> "";
        };
        return instruction + "integrated_multimodal_description: " + detail + "\n\noverall_soundscape: " + sound + "\n\nnon_diegetic_music: " + music;
    }

    /**
     * 台词代码填时的放置核对：每句恰好一次、在它所在的镜头里。漏了的补到所在镜头末尾，重复的去掉多余的，放到镜头外的挪回去，
     * 模型自己写的 {@code <d>} 去掉；放错镜头的只提示（挪动会打乱模型写好的画面）。
     */
    private static void placeLines(JsonNode meta, List<String> bodies, Set<String> warnings) {
        Map<String, JsonNode> lines = new LinkedHashMap<>();
        meta.path("lines").forEach(l -> lines.put(l.path("id").asText(), l));
        Map<String, Integer> seen = new HashMap<>();
        boolean wrote = false;
        for (int i = 0; i < bodies.size(); i++) {
            String body = bodies.get(i);
            // 模型自己写的台词先换成记号：这一镜漏了的台词就放回这个位置（说话的人和语气已经写在前面了）。
            if (SPOKEN.matcher(body).find()) { body = SPOKEN.matcher(body).replaceAll(SPOKEN_MARK); wrote = true; }
            StringBuilder kept = new StringBuilder();
            Matcher m = PLACEHOLDER.matcher(body);
            int last = 0;
            while (m.find()) {
                kept.append(body, last, m.start());
                last = m.end();
                JsonNode line = lines.get(m.group(1));
                if (line == null) continue;
                if (seen.merge(m.group(1), 1, Integer::sum) > 1) { warnings.add("第 " + number(m.group(1)) + " 句台词出现了两次，已去掉多余的"); continue; }
                kept.append(m.group());
                int shot = line.path("shot").asInt(0);
                if (shot >= 1 && shot <= bodies.size() && shot != i + 1)
                    warnings.add("第 " + number(m.group(1)) + " 句台词「" + excerpt(line.path("text").asText()) + "」放在了第 " + (i + 1) + " 镜，原文在第 " + shot + " 镜");
            }
            kept.append(body.substring(last));
            bodies.set(i, kept.toString().replaceAll("[ \\t]{2,}", " ").strip());
        }
        boolean leftover = wrote;
        for (var e : lines.entrySet()) {
            if (seen.containsKey(e.getKey())) continue;
            int shot = e.getValue().path("shot").asInt(0);
            int at = shot >= 1 && shot <= bodies.size() ? shot - 1 : bodies.size() - 1;
            if (bodies.get(at).contains(SPOKEN_MARK)) {
                bodies.set(at, bodies.get(at).replaceFirst(SPOKEN_MARK, "{{" + e.getKey() + "}}"));
                continue; // 模型把台词写成了自己的版本：换回原文，不用打扰用户
            }
            bodies.set(at, (bodies.get(at) + " The speaker says: {{" + e.getKey() + "}}").strip());
            warnings.add("第 " + number(e.getKey()) + " 句台词「" + excerpt(e.getValue().path("text").asText()) + "」模型漏了，已补在第 " + (at + 1) + " 镜末尾");
        }
        for (int i = 0; i < bodies.size(); i++) {
            if (!bodies.get(i).contains(SPOKEN_MARK)) continue;
            bodies.set(i, bodies.get(i).replace(SPOKEN_MARK, "").replaceAll("[ \\t]{2,}", " ").replaceAll(" ([,.;:!?])", "$1").strip());
            if (leftover) { warnings.add("去掉了模型自己加的台词"); leftover = false; }
        }
    }

    /**
     * 模型写台词时，按整句核对：原文里看着像台词的句子，要在优化稿的某一句 {@code <d>} 里原样出现（拆成几句连着说也算）；
     * 优化稿里多出来的台词也提示。不能把所有台词拼在一起找子串 ——「同意」会在「不同意」里找到（Codex 评审 2026-10-27）。
     * 原文一句都没认出来时不查多出来的台词：用户可能用叙述写了对白，模型照着补出 {@code <d>} 是对的。
     */
    private static void checkSpoken(JsonNode meta, List<String> bodies, Set<String> warnings) {
        List<String> said = new ArrayList<>(), saidRaw = new ArrayList<>();
        for (String b : bodies) {
            Matcher m = SPOKEN.matcher(b);
            while (m.find()) {
                String raw = m.group().substring(3, m.group().length() - 4).replaceFirst("^\\s*\\[[^\\]]*]", "").strip();
                if (squash(raw).isEmpty()) continue;
                saidRaw.add(raw);
                said.add(squash(raw));
            }
        }
        List<String> wanted = new ArrayList<>(), wantedRaw = new ArrayList<>();
        for (JsonNode line : meta.path("spoken")) if (!squash(line.path("text").asText()).isEmpty()) {
            wantedRaw.add(line.path("text").asText());
            wanted.add(squash(line.path("text").asText()));
        }
        if (String.join("", said).equals(String.join("", wanted))) return; // 一字不差（拆句、合句都算）
        // 按顺序配对：每句原文台词在后面的 <d> 里找连着的一句或几句正好拼成它，配上的就用掉；
        // 配不上的原文台词、没被用掉的 <d> 都提示。不能逐句做子串放行：原文「不同意」，优化稿先说「不同意」再加一句「同意」也得报出来。
        boolean[] used = new boolean[said.size()];
        List<String> unmatched = new ArrayList<>();
        int from = 0;
        for (int i = 0; i < wanted.size(); i++) {
            int[] hit = consecutive(said, from, wanted.get(i));
            if (hit == null) {
                unmatched.add(wanted.get(i));
                warnings.add("原文台词「" + excerpt(wantedRaw.get(i)) + "」在优化稿里没有原样出现，可能被改了或漏了");
                continue;
            }
            for (int k = hit[0]; k <= hit[1]; k++) used[k] = true;
            from = hit[1] + 1;
        }
        if (wanted.isEmpty()) return;
        // 剩下的 <d> 是某句没配上的原文台词的一截（说了半句），上面已经报过；其余算多出来的。
        for (int i = 0; i < said.size(); i++) {
            String one = said.get(i);
            if (used[i] || unmatched.stream().anyMatch(w -> w.contains(one))) continue;
            warnings.add("优化稿多了一句原文没有的台词「" + excerpt(saidRaw.get(i)) + "」");
        }
    }

    /** 从 {@code from} 往后，连着的一句或几句 {@code <d>} 正好拼成这句台词：返回首尾下标，找不到返回 null。 */
    private static int[] consecutive(List<String> said, int from, String line) {
        for (int start = from; start < said.size(); start++) {
            StringBuilder run = new StringBuilder();
            for (int k = start; k < said.size() && run.length() < line.length(); k++) {
                run.append(said.get(k));
                if (run.toString().equals(line)) return new int[]{start, k};
            }
        }
        return null;
    }

    // ── 原文里的台词（模型写台词时核对用）：与前端 studio-video-prompt.ts 的 studioPromptLines 同一套认法 ──────────

    private static final Pattern DIRECTION = Pattern.compile("时间|地点|场景|画面|镜头|景别|机位|运镜|构图|光线|灯光|色调|风格|氛围|背景|环境|表情|动作|神态|情绪|声音|音效|音乐|配乐|bgm|切镜|转场|节奏|时长|首帧|尾帧|参考|服装|造型|道具|字幕|备注|要求|注意|说明|提示|描述|内容|主题|画幅|比例|清晰度|定位|开场|结尾|结局|细节|特写|近景|远景|中景|全景|口型|音色|语气|语速|人物|角色|主体", Pattern.CASE_INSENSITIVE);
    private static final Pattern SPEECH_LABEL = Pattern.compile("^(台词|对白|旁白|独白|画外音)$");
    private static final Pattern SPEECH_LABEL_TEXT = Pattern.compile("(^|[\\s。！？!?；;，,…」』”）)\\]】])([^\\s：:，,。！？!?；;、“”\"「」『』（）()【】\\[\\]<>]{1,12})(?:[（(][^）)\\n]{0,16}[）)])?\\s*[：:](?!\\d)");
    private static final Map<Character, Character> OPEN_QUOTE = Map.of('“', '”', '「', '」', '『', '』', '"', '"');

    /** 「名字：台词」「名字说：“台词”」「台词：……」。引号里的整段算一句，没引号的到第一个句号为止。返回 [说话人, 台词]。 */
    static List<String[]> spokenLines(String prompt) {
        Matcher m = SPEECH_LABEL_TEXT.matcher(prompt);
        List<int[]> labels = new ArrayList<>();
        List<String> names = new ArrayList<>();
        while (m.find()) { labels.add(new int[]{m.start() + m.group(1).length(), m.end()}); names.add(m.group(2)); }
        List<String[]> out = new ArrayList<>();
        for (int i = 0; i < labels.size(); i++) {
            String raw = names.get(i).trim();
            boolean speechLabel = SPEECH_LABEL.matcher(raw).matches();
            if (!speechLabel && (raw.length() > 8 || raw.matches(".*\\d.*") || DIRECTION.matcher(raw).find())) continue;
            String speaker = speechLabel ? "" : raw.length() > 1 ? raw.replaceAll("(说道|说|道|问|喊|答|讲|叫|喃喃)$", "") : raw;
            if (speaker.isEmpty() && !speechLabel) speaker = raw;
            int end = i + 1 < labels.size() ? labels.get(i + 1)[0] : prompt.length();
            String body = prompt.substring(labels.get(i)[1], Math.max(labels.get(i)[1], end)).stripLeading();
            Character close = body.isEmpty() ? null : OPEN_QUOTE.get(body.charAt(0));
            if (close != null) {
                int stop = body.indexOf(close, 1);
                body = stop < 0 ? body.substring(1) : body.substring(1, stop);
            } else body = body.split("[。\\n]")[0];
            String text = body.strip();
            if (squash(text).codePointCount(0, squash(text).length()) >= 2) out.add(new String[]{speaker, text});
        }
        return out;
    }

    static String squash(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replaceAll("[\\s\\p{P}\\p{S}]", "");
    }

    // ── 填台词 / 清理 ───────────────────────────────────────────────────────

    /** 把台词填进英文稿：{@code {{Ln}}} → {@code (Sx) <d>[语言] 原文</d>}。台词按官方写法规整标点，字不改。 */
    public static String fill(String template, List<Line> lines, String languageTag) {
        String out = template;
        for (Line l : lines) out = out.replace("{{" + l.id() + "}}", "(" + l.sid() + ") <d>[" + languageTag + "] " + tidy(l.text()) + "</d>");
        return out;
    }

    /** 模型漏写环境声时补的一句：只说跟画面一致，不替它编具体声源。 */
    public static final String DEFAULT_SOUNDSCAPE = "Natural ambient sound of the location that matches the actions on screen.";
    /** 零星漏翻的汉字由代码删掉；超过这个数提示用户画面描述可能缺了内容。 */
    static final int MAX_STRAY_HAN = 20;
    private static final Pattern HAN_IN_PARENS = Pattern.compile("\\s*[(（][\\p{IsHan}\\u3000-\\u303F\\uFF00-\\uFFEF\\s]+[)）]");
    private static final Pattern HAN_RUN = Pattern.compile("[\\p{IsHan}\\u3000-\\u303F\\uFF00-\\uFFEF]+");

    /**
     * 模型写的一段英文的清理：删掉零星漏翻的中文（{@code Steve Chou (史蒂芬周)}、{@code his狼狈 figure}，2026-10-26 线上评测 3/36 次），
     * 计数给调用方提示。英文双引号里的画面文字、台词占位和模型写的 {@code <d>} 不动。台词代码填时顺便去掉模型自己写的说话人编号。
     */
    static String clean(String s, int[] strayHan, boolean codeLines) {
        StringBuilder out = new StringBuilder();
        Matcher d = SPOKEN.matcher(s);
        int last = 0;
        while (d.find()) { out.append(cleanOutside(s.substring(last, d.start()), strayHan)).append(d.group()); last = d.end(); }
        out.append(cleanOutside(s.substring(last), strayHan));
        String cleaned = out.toString();
        return (codeLines ? withoutIds(cleaned) : cleaned).strip();
    }

    private static String cleanOutside(String s, int[] strayHan) {
        String[] parts = s.split("\"", -1);
        for (int i = 0; i < parts.length; i += 2) { // 偶数段在引号外
            String part = parts[i];
            Matcher m = HAN_RUN.matcher(part);
            while (m.find()) strayHan[0] += m.group().codePointCount(0, m.group().length());
            part = HAN_RUN.matcher(HAN_IN_PARENS.matcher(part).replaceAll("")).replaceAll(" ");
            parts[i] = part.replaceAll("[ \\t]{2,}", " ").replaceAll(" ([,.;:!?])", "$1");
        }
        return String.join("\"", parts);
    }

    private static final Pattern SPEAKER_ID = Pattern.compile("\\s?\\(S\\d+(?:\\s*,\\s*S\\d+)*\\)");

    /**
     * 模型照官方范例写的说话人编号（{@code <Subject 1> (S1) says}）去掉：台词代码填时编号统一由 {@link #fill} 写在台词前，
     * 免得两处不一致（2026-10-26 真模型试跑，6 次里 1 次这么写）。
     */
    static String withoutIds(String s) {
        return SPEAKER_ID.matcher(s).replaceAll("");
    }

    /** 模型不听话写了「[Shot 2] At 00:05.000,」也不算错：去掉，统一由这里加。 */
    static String stripShotPrefix(String s) {
        return s.replaceFirst("^\\[Shot \\d+]\\s*", "").replaceFirst("^At \\d{1,2}:\\d{2}(\\.\\d+)?,?\\s*", "").strip();
    }

    /** 台词标点按官方写法规整：去掉重复和装饰性的标点（「……」→「…」「！！」→「！」、波浪号），字不改。 */
    static String tidy(String line) {
        return line.replaceAll("([…！？。，、!?.,])\\1+", "$1").replaceAll("[～~]+", "").strip();
    }

    /** 切镜时间：00:05.000。 */
    static String clock(double sec) {
        long ms = Math.round(sec * 1000);
        return String.format(Locale.ROOT, "%02d:%02d.%03d", ms / 60_000, (ms / 1000) % 60, ms % 1000);
    }

    /** 模型给的开始时间：秒数或「MM:SS.mmm」；认不出返回 -1。 */
    private static double seconds(JsonNode v) {
        if (v.isNumber()) return v.asDouble();
        Matcher m = Pattern.compile("^(?:(\\d{1,2}):)?(\\d{1,2}(?:\\.\\d+)?)$").matcher(v.asText("").strip());
        if (!m.find()) return -1;
        return (m.group(1) == null ? 0 : Integer.parseInt(m.group(1)) * 60) + Double.parseDouble(m.group(2));
    }

    /** 模型定的镜头时间不像样（不从 0 开始、不递增、超出时长）就按镜头数平均分。 */
    private static void fixStarts(List<Double> starts, int seconds) {
        boolean ok = !starts.isEmpty() && starts.get(0) == 0;
        for (int i = 1; ok && i < starts.size(); i++) ok = starts.get(i) > starts.get(i - 1) && (seconds <= 0 || starts.get(i) < seconds);
        if (ok) return;
        double step = seconds > 0 ? (double) seconds / starts.size() : 3;
        for (int i = 0; i < starts.size(); i++) starts.set(i, Math.round(step * i * 10) / 10.0);
    }

    private static final Pattern SENTENCE = Pattern.compile("[^.!?\\n]*(?:[.!?]+|$)\\s*");

    /**
     * 删掉引用了不存在的 {@code <Picture N>} / {@code <Video N>} / {@code <Audio N>} 的句子；含台词的句子不删（删了台词就丢了）。
     * 按「. ! ? 换行」切句，retention_analysis 一行一条也就按行删。
     */
    static String dropUnknownLabels(String text, Map<String, Integer> limits) {
        if (!hasUnknownLabel(text, limits)) return text;
        StringBuilder out = new StringBuilder();
        for (String line : text.split("\n", -1)) {
            StringBuilder kept = new StringBuilder();
            Matcher m = SENTENCE.matcher(line);
            while (m.find() && !m.group().isEmpty()) {
                String sentence = m.group();
                if (hasUnknownLabel(sentence, limits) && !PLACEHOLDER.matcher(sentence).find() && !sentence.contains("<d>")) continue;
                kept.append(sentence);
            }
            String k = kept.toString().strip();
            if (!k.isEmpty()) out.append(out.length() > 0 ? "\n" : "").append(k);
        }
        return out.toString();
    }

    private static boolean hasUnknownLabel(String text, Map<String, Integer> limits) {
        for (var e : limits.entrySet()) {
            Matcher m = Pattern.compile("<" + e.getKey() + " (\\d+)>").matcher(text);
            while (m.find()) { int n = Integer.parseInt(m.group(1)); if (n < 1 || n > e.getValue()) return true; }
        }
        return false;
    }

    private static String number(String id) { return id.substring(1); }

    private static String excerpt(String text) {
        String t = text.strip();
        return t.codePointCount(0, t.length()) <= 12 ? t : t.substring(0, t.offsetByCodePoints(0, 12)) + "…";
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isTextual() ? v.asText().strip() : "";
    }

    public static BusinessException bad(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "视频提示词优化没成功（" + message + "），本次未扣积分，请重试或按原文生成");
    }
}
