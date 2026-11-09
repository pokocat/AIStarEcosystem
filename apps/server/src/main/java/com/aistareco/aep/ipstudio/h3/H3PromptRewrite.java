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
import java.util.HashSet;
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
    public static final int MAX_PROMPT_CHARS = 7_000;
    /**
     * 输出约定的修订号，写进任务输入方便追查是哪套规则出的稿；不进指纹，已经能用的英文稿不因它失效。
     * 2026-10-31：加篇幅预算。《扣钱》cl45 的优化稿 8198 字符，主体说明 2403、保留说明 1551，五个资产的中文描述被逐条翻译又列了一遍。
     * 2026-11-07：最终稿目标 6000 字符，字符预算优先于英文词数；马记大排档真实模型两份稿均低于 6000。
     * 2026-11-07：写明模型看不到素材。线上 Sonnet 对「把@图1 衣着穿在模特身上」这类短要求 10 次拒绝 7 次（「看不到附件」），关思考的 DeepSeek 则直接编人物和背景。
     * 2026-11-10：认台词放宽（“”、半角冒号、不写冒号）、说话人按上下文认；还有认不出的台词时改由模型写，不再对模型说「这一镜没有台词」。
     */
    public static final String RULES = "2026-11-10-unrecognized-speech";
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

    /**
     * 模板写法：「林小雅说：「…」」「旁白在画外说：「…」」。只匹配到开引号，台词到配对的收引号为止（见 {@link #closing}）。
     * 用户改写时常用中文双引号、半角冒号或不写冒号（「静儿咂了下嘴说：“味道还是不行”」，2026-11-10 线上），同样认：
     * 第 3 组是「说」和引号之间的冒号与空白，换成占位时统一写成「说：」；第 4 组是开引号。
     */
    private static final Pattern LINE = Pattern.compile("([^\\s，。：；！？、「」“”『』\"（）()]{1,24}?)(在画外)?说(\\s*[：:]?\\s*)([「“『\"])");
    /** 2026-10-26 之前的导演台模板（用户改写过、还留着旧格式的提示词）：「第2镜 · @林小雅 · “…”」。 */
    private static final Pattern LEGACY_LINE = Pattern.compile("@([^\\s·]{1,24}) · “");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(L\\d+)}}");
    private static final Pattern SPOKEN = Pattern.compile("<d>[\\s\\S]*?</d>");
    private static final String SPOKEN_MARK = "\u0001";

    // ── 系统提示词 ─────────────────────────────────────────────────────────

    /**
     * 导演台的输出约定：全能参考 + 镜头固定 + 台词代码填。首发原文线上 74 次真实改写验过；
     * 2026-10-31 只追加了篇幅预算（{@link #LENGTH_REF}），其余不动。
     */
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
            """ + H3PromptRewrite.LENGTH_REF; // 限定名：常量在下面声明，简单名会报前向引用

    /**
     * 全能参考的篇幅预算。官方只给了 detailed_description 350–500 词，主体说明和保留说明没有上限，
     * 而资产描述越写越细，模型就逐条翻译、在三处各写一遍，超过视频模型 7000 字符的上限（cl45：8198）。
     * 只是给模型的目标，是否收得下仍以填完台词后的全文为准（{@link #validate}）。
     */
    private static final String LENGTH_REF = """
            - Length: the video model accepts at most 7,000 characters for the whole prompt, every section and the spoken lines included. This is a hard character limit, not a word or token limit. Aim for at most 6,000 characters in the FINAL assembled prompt, leaving at least 1,000 characters of headroom. Spaces, punctuation, section headings, reference labels, shot markers, timestamps, speaker IDs and dialogue tags all count. Replacing {{Ln}} with the original dialogue also increases the length; reserve room for it.
            - Every attached reference (each <Picture N>, <Video N> and <Audio N>, the storyboard or frame picture included) keeps its own line in subject_definitions and in retention_analysis. Keeping it short never means leaving a reference out.
            - "subject_definitions": one line per item, at most two sentences: the label, its source picture, and only the few features that identify it in the images (for example age and gender, hair, main clothing colors, one signature item). Do not translate the written notes item by item.
            - "retention_analysis": one short line per label: the label, where it appears, the relationship marker, and at most one short phrase. Do not list the features from subject_definitions again.
            - "summary": one or two short sentences, at most 250 characters. "overall_soundscape": at most 250 characters. "non_diegetic_music": at most 150 characters, or "N/A" when no music is requested.
            - detailed_description: budget at most 3,000 characters for the style and ALL shots together, not per shot. Divide the space between the shots; use concise, observable actions. Describe a subject's identifying features once, then use its label. The whole-prompt character budget takes priority over every recommended or minimum English word count in the guide, including 350–500 words; use fewer words when necessary.
            - Before returning JSON, review the WHOLE result against the character budget. If it is too long, shorten repeated appearance descriptions, repeated reference explanations, decorative adjectives and camera prose first. Preserve every shot and its timing, each reference label and its use, speaker identity, on-screen versus off-screen speech, all dialogue placeholders and every original spoken word. Never meet the limit by cutting off the JSON, dropping a shot or reference, or shortening dialogue.
            """;

    /** 其余模式：官方没给篇幅，只说总长上限。 */
    private static final String LENGTH_BASE = """
            - Length: the video model accepts at most 7,000 characters for the FINAL assembled prompt, not 7,000 words or tokens. Aim for at most 6,000 characters including spaces, punctuation, section headings, picture-alignment instructions, shot markers, timestamps, speaker IDs, dialogue tags and the complete original dialogue that replaces {{Ln}}. The character budget takes priority over recommended or minimum word counts in the guide.
            - Keep descriptions concise and do not repeat appearance details. Before returning JSON, review the whole result; shorten repeated descriptions, decorative adjectives and camera prose if needed. Preserve every shot and its timing, reference alignment, speaker identity, on-screen versus off-screen speech, all dialogue placeholders and every original spoken word. Never truncate the JSON or shorten dialogue to meet the limit.
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
        if (mode != Mode.T2V) c.append("""
                - The attached images, videos and audio are not available to you: only their labels and the notes in the request reach you. That is expected, so never ask for them, never refuse and never explain it; always return the JSON object. Refer to each one by its label, for example "as in <Video 1>". Do not invent what they show (a person's looks, clothing, setting, actions, cuts or sound) beyond what the request and the notes say. When the request only changes part of <Video 1>, write one shot that follows <Video 1> and say only what changes.
                """);
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
        c.append(mode == Mode.REF ? LENGTH_REF : LENGTH_BASE);
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

    private static final Pattern CURLY_SPEECH = Pattern.compile("说：“([^”\\n]*)”");
    private static final Pattern ASCII_SHOT = Pattern.compile("第(\\d+)镜\\s*\\(([^)\\n]*秒)\\)");
    private static final Pattern ASCII_SPEECH = Pattern.compile("说:\\s*(?=[「“])");

    /**
     * 模型常把台词写成「博主说：“……”」（2026-11-04 线上手表脚本，要求写「」也照样），只认「」就一句都认不出，台词改由改写模型写，
     * 原话可能被改。这里统一成「」；只动「说：」后面紧跟的这对引号，画面描述里引用的话不碰。
     * Sonnet 用半角标点（「第1镜(0–3 秒)」「小夏说:「…」」，2026-11-04），镜头和台词同样认不出，一起统一成全角。
     * terra 反过来把数字和字母写成全角（「第１镜（０—４秒）」「ＳＡＭＩＡ」，2026-11-09 线上 8 篇里 6 篇），{@code \\d} 认不出，先换回半角。
     */
    public static String normalizeSpeechQuotes(String zh) {
        String out = ASCII_SHOT.matcher(halfWidthAlnum(zh)).replaceAll(m -> Matcher.quoteReplacement("第" + m.group(1) + "镜（" + m.group(2) + "）"));
        out = ASCII_SPEECH.matcher(out).replaceAll("说：");
        return CURLY_SPEECH.matcher(out).replaceAll(m -> Matcher.quoteReplacement("说：「" + m.group(1) + "」"));
    }

    /**
     * 从中文提示词里认出台词，换成 {@code {{Ln}}}。说话人名字以已知的名字为准（「画面里只有林小雅。林小雅说」只认「林小雅」）。
     * 说话人编号按第一次开口的顺序分配，旁白也算一个说话人。
     */
    public static Source source(String zh, List<String> knownNames) {
        return source(zh, knownNames, Map.of());
    }

    /**
     * 同上；{@code canonical} 是别名 → 名字（「老板」→「餐馆老板」），别名开口的台词归到本名，编号与本名一致。
     * 「说」前面不是名字（「咂了下嘴说」「笑着说」）时按上下文认说话人，见 {@link #speaker}。
     */
    public static Source source(String zh, List<String> knownNames, Map<String, String> canonical) {
        List<String> names = new ArrayList<>(knownNames);
        names.addAll(canonical.keySet());
        names.sort(Comparator.comparingInt(String::length).reversed());
        List<Line> lines = new ArrayList<>();
        Map<String, String> sids = new LinkedHashMap<>();
        StringBuilder out = new StringBuilder();
        // 旧格式（台词写在「@名字 · “…”」里）直接按旧格式认：台词里的「他说“别走”」不能被当成新写法的一句台词。
        boolean legacyFormat = !zh.contains("说：「") && LEGACY_LINE.matcher(zh).find();
        Matcher m = LINE.matcher(zh);
        int last = 0, pos = legacyFormat ? zh.length() : 0;
        while (pos < zh.length() && m.find(pos)) {
            char q = m.group(4).charAt(0);
            int open = m.end(), end = closing(zh, open, q, CLOSE_QUOTE.get(q));
            pos = end < 0 ? open : end + 1;
            if (end < 0) continue; // 引号没配上：不算台词，句数核对会拦下
            String before = out + zh.substring(last, m.start());
            String speaker = speaker(m.group(1), before, after(zh, end + 1), names, canonical);
            String id = "L" + (lines.size() + 1);
            String sid = sids.computeIfAbsent(speaker, k -> "S" + (sids.size() + 1));
            lines.add(new Line(id, speaker, sid, zh.substring(open, end), m.group(2) != null));
            out.append(zh, last, m.start(3)).append("：{{").append(id).append("}}");
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
            String speaker = canon(known(m.group(1), names), canonical);
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
     * 认完台词后的正文里还像有人在说话：认不出的台词还在里面。2026-11-10 线上：客户在原本没有台词的镜头里写了
     * 「咂了下嘴说：不好吃，」（没加引号），一句都没认出，代码却按「全认出来了」处理，对改写模型说这一镜没有台词，模型照做删掉了。
     * <ul>
     *   <li>全文都算：「说：」后面不是已认出的占位；「说」后面直接跟引号（引号没配上）；「问：」「喊道：」这类说话动词带冒号或引号；
     *       「台词：」「旁白：」这类标签；「名字：「…」」冒号后紧跟引号。</li>
     *   <li>只在一句台词都没认出的那一镜里算：别的「说」（「她开口说一句话」「说味道还是不行」）。认出了台词的镜头里，
     *       分镜动作常写「话说到一半」「说出自己的判断」「一口气说完」，描述的就是那句已认出的台词（2026-11-10 线上 cl208）。</li>
     * </ul>
     * 「据说 / 听说 / 传说 / 小说 / 说明 / 说服 / 说法」和旧版模板的「只说… / 说的是…」不算。宁可多判：多判只是改由模型照原文写台词、
     * 逐句核对，少判就是台词被删。
     */
    public static boolean unrecognizedSpeech(String text) {
        if (SAY_COLON.matcher(text).find() || SAY_QUOTE.matcher(text).find() || SPEECH_VERB.matcher(text).find()
                || SPEECH_TAG.matcher(text).find() || COLON_QUOTE.matcher(text).find()) return true;
        Map<Integer, String> shots = shotTexts(text);
        if (shots.isEmpty()) return !PLACEHOLDER.matcher(text).find() && LEFTOVER_SAY.matcher(text).find();
        for (String body : shots.values()) if (!PLACEHOLDER.matcher(body).find() && LEFTOVER_SAY.matcher(body).find()) return true;
        return false;
    }

    private static final String NOT_SAY = "(?<![据听传小只])说";
    private static final Pattern SAY_COLON = Pattern.compile(NOT_SAY + "\\s*[：:](?!\\{\\{L\\d+}})");
    private static final Pattern SAY_QUOTE = Pattern.compile(NOT_SAY + "\\s*[「“『\"]");
    private static final Pattern LEFTOVER_SAY = Pattern.compile(NOT_SAY + "(?![明服法的]|：\\{\\{L\\d+}})");
    private static final Pattern SPEECH_VERB = Pattern.compile("(问|问道|答|答道|回答|喊|喊道|叫道|嚷|嚷道|念道|吼|吼道|骂|骂道|嘀咕|嘟囔|喃喃|低语|开口|笑道)\\s*[：:「“『\"]");
    private static final Pattern SPEECH_TAG = Pattern.compile("(^|[\\s。！？!?；;，,…」』”）)\\]】])(台词|对白|旁白|独白|内心独白|画外音|心声|OS|VO)\\s*[：:]");
    private static final Pattern COLON_QUOTE = Pattern.compile("[：:]\\s*[「“『\"]");

    /**
     * 台词都认出来了，可以由代码填（{@code codeLines}）：引号成对、正文里没有认不出的台词；镜头固定时每句都落在某一镜里
     * （不在任何一镜的台词，没法告诉模型放哪一镜，「这一镜没有台词」就是错的）。
     */
    public static boolean complete(Source src, boolean fixedShots) {
        String t = src.text();
        if (!src.lines().isEmpty() && !quotesBalanced(t, !t.contains("说：{{"))) return false;
        if (unrecognizedSpeech(t)) return false;
        if (!fixedShots || src.lines().isEmpty()) return true;
        Set<String> placed = new HashSet<>();
        linesByShot(t).values().forEach(ids -> ids.forEach(id -> placed.add(id.substring(2, id.length() - 2))));
        return src.lines().stream().allMatch(l -> placed.contains(l.id()));
    }

    /**
     * 开引号之后配对的收引号位置，台词里可以再套一层同样的引号（「他喊「别走」，然后离开。」）；配不上返回 -1。
     * 2026-10-26 评审：原来用非贪婪的「(.+?)」」，这样的台词只认出「他喊「别走」，剩下半句进了交给模型的正文。
     */
    static int closing(String s, int from, char open, char close) {
        if (open == close) return s.indexOf(close, from); // 半角双引号不分开闭，不能套
        int depth = 1;
        for (int i = from; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == open) depth++;
            else if (ch == close && --depth == 0) return i;
        }
        return -1;
    }

    private static final Map<Character, Character> CLOSE_QUOTE = Map.of('「', '」', '“', '”', '『', '』', '"', '"');

    private static String known(String captured, List<String> namesLongestFirst) {
        for (String n : namesLongestFirst) if (!n.isBlank() && captured.endsWith(n)) return n;
        return captured;
    }

    private static String canon(String term, Map<String, String> canonical) {
        return canonical.getOrDefault(term, term);
    }

    /** 名字前面紧挨着这些字时是听的人：「林小雅对静儿说」开口的是林小雅。 */
    private static final String ADDRESSEE = "对跟和向朝冲给与";
    /**
     * 「说」前面这一截像动作而不是人名：「咂了下嘴」「笑着」「低声」「转身」。只有像动作时才往前找说话人，
     * 「店小二说」里的「店小二」可能就是没建成资产的人，不能拿上一句提到的人顶替。
     */
    private static final Pattern ACTION = Pattern.compile("[了着过地嘴头声身眼笑哭叹摇咂皱撇抿]|口气|点头|转|抬|低|轻轻|小声|大声|边|然后|接着|随即|又|便|就|一下");

    /**
     * 一句台词的说话人。依次：「说」前面这一截里的名字（结尾就是名字时取它；有几个时取第一个，「X的Y说」取 Y，
     * 前面紧挨「对 / 跟 / 向…」的是听的人，不算）；这一截像动作时，同一句前文里第一个出现的人（「静儿用勺尖蘸了一点，咂了下嘴说」）；
     * 再找不到就看这一镜（这一行）是不是只提到一个人。都不行就照原样用这一截，由调用方决定要不要交给模型写。
     * 旁白不参与上下文推断：它不在画面里。前文里已认出的台词是占位，不会把台词里提到的名字当成说话人。
     */
    static String speaker(String captured, String before, String after, List<String> namesLongestFirst, Map<String, String> canonical) {
        List<int[]> own = mentions(captured, namesLongestFirst);
        own.removeIf(x -> x[0] > 0 && ADDRESSEE.indexOf(captured.charAt(x[0] - 1)) >= 0);
        if (!own.isEmpty()) {
            int[] lastHit = own.get(own.size() - 1);
            boolean ofLast = own.size() > 1 && lastHit[0] + lastHit[1] == captured.length() && lastHit[0] > 0 && captured.charAt(lastHit[0] - 1) == '的';
            int[] pick = ofLast ? lastHit : own.get(0);
            return canon(captured.substring(pick[0], pick[0] + pick[1]), canonical);
        }
        if (!ACTION.matcher(captured).find()) return captured;
        List<String> people = namesLongestFirst.stream().filter(n -> !"旁白".equals(canon(n, canonical))).toList();
        int from = Math.max(Math.max(before.lastIndexOf('。'), before.lastIndexOf('！')), Math.max(before.lastIndexOf('？'), before.lastIndexOf('\n')));
        from = Math.max(from, Math.max(before.lastIndexOf('：'), before.lastIndexOf('；')));
        String sentence = before.substring(from + 1);
        List<int[]> ctx = mentions(sentence, people);
        ctx.removeIf(x -> x[0] > 0 && ADDRESSEE.indexOf(sentence.charAt(x[0] - 1)) >= 0);
        if (!ctx.isEmpty()) return canon(sentence.substring(ctx.get(0)[0], ctx.get(0)[0] + ctx.get(0)[1]), canonical);
        String line = before.substring(before.lastIndexOf('\n') + 1) + after;
        Set<String> who = new LinkedHashSet<>();
        for (int[] x : mentions(line, people)) who.add(canon(line.substring(x[0], x[0] + x[1]), canonical));
        return who.size() == 1 ? who.iterator().next() : captured;
    }

    /** 文字里出现的名字（长的先认，认过的字不再参与匹配），按位置排：每项是 {起点, 长度}。 */
    private static List<int[]> mentions(String text, List<String> namesLongestFirst) {
        char[] left = text.toCharArray();
        List<int[]> hits = new ArrayList<>();
        for (String n : namesLongestFirst) {
            if (n.isBlank()) continue;
            String s = new String(left);
            for (int at = s.indexOf(n); at >= 0; at = s.indexOf(n, at + n.length())) {
                hits.add(new int[]{at, n.length()});
                for (int k = at; k < at + n.length(); k++) left[k] = '\u0000';
            }
        }
        hits.sort(Comparator.comparingInt(x -> x[0]));
        return hits;
    }

    /** 台词收引号之后到行尾，去掉其中的引号内容（后面别的台词里提到的名字不算这一镜的人）。 */
    private static String after(String zh, int from) {
        int nl = zh.indexOf('\n', from);
        String rest = zh.substring(Math.min(from, zh.length()), nl < 0 ? zh.length() : nl);
        return rest.replaceAll("「[^」]*」|“[^”]*”|『[^』]*』", "");
    }

    /** 中文原文里每一镜（「第N镜（」或旧语音轨「第N镜 · 」开头的一段）有哪几个台词占位；不按这个格式写的原文返回空。 */
    public static Map<Integer, List<String>> linesByShot(String source) {
        Map<Integer, List<String>> out = new LinkedHashMap<>();
        // 「第N镜（」是新格式的画面段；「第N镜 · 」是旧格式语音轨里每句台词的开头，台词集中在末尾时按它归到各自的镜头。
        // 用户改写时也会写成半角括号、全角数字（「第3镜(8 秒切)」「第３镜（」），同样算镜头开头。
        Matcher shot = SHOT_MARK.matcher(source);
        List<int[]> marks = new ArrayList<>();
        while (shot.find()) marks.add(new int[]{Integer.parseInt(halfWidthAlnum(shot.group(1))), shot.start()});
        for (int k = 0; k < marks.size(); k++) {
            int end = k + 1 < marks.size() ? marks.get(k + 1)[1] : source.length();
            Matcher m = PLACEHOLDER.matcher(source.substring(marks.get(k)[1], end));
            while (m.find()) out.computeIfAbsent(marks.get(k)[0], x -> new ArrayList<>()).add("{{" + m.group(1) + "}}");
        }
        return out;
    }

    private static final Pattern SHOT_MARK = Pattern.compile("第([0-9０-９]+)镜\\s*(?:[（(]| · )");
    private static final Pattern SHOT_HEAD = Pattern.compile("第(\\d+)镜（\\s*(\\d+(?:\\.\\d+)?)\\s*(?:秒|[–—\\-~～至到])");

    /** 全角数字和英文字母换成半角（标点不动）：模型写的「８９元」「ＳＡＭＩＡ」和客户给的「89元」「SAMIA」是同一个东西。 */
    public static String halfWidthAlnum(String s) {
        if (s == null) return null;
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean alnum = c >= '０' && c <= '９' || c >= 'Ａ' && c <= 'Ｚ' || c >= 'ａ' && c <= 'ｚ';
            b.append(alnum ? (char) (c - 0xFEE0) : c);
        }
        return b.toString();
    }

    /**
     * 原文自己分了镜头（「第1镜（0–3 秒）」「第2镜（3 秒切）」）时的镜头开始时间；没分、或编号不连续、时间不递增、超出总时长时返回 null，
     * 由模型自己定镜头。创作助手照导演台的格式写，就走这里。
     */
    public static List<Double> shotStarts(String zh, int seconds) {
        Matcher m = SHOT_HEAD.matcher(halfWidthAlnum(zh));
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
        ObjectNode meta = om.createObjectNode().put("task", "videoPrompt").put("rules", RULES).put("mode", r.mode().name()).put("codeLines", r.codeLines())
                .put("shots", fixed ? r.shots() : 0).put("seconds", r.seconds())
                .put("pictures", pictures).put("videos", videos).put("audios", audios).put("language", languageTag(r.language()));
        // 导演台全能参考的图1 一定是分镜图（DirectorService#rewrite 固定这么排）；画布上的图1 是用户随便连的，不标。
        if (r.storyboard() && r.mode() == Mode.REF) meta.put("storyboardPicture", "<Picture 1>");
        // 参考素材清单原样记下：模型漏写某一份时，校验按它补回（见 validate）。
        ArrayNode refs = meta.putArray("references");
        r.references().forEach(refs::add);
        ArrayNode cuts = meta.putArray("starts");
        if (fixed) r.starts().forEach(cuts::add);
        Map<String, Integer> shotOf = new HashMap<>();
        linesByShot(r.source().text()).forEach((shot, ids) -> ids.forEach(id -> shotOf.put(id.substring(2, id.length() - 2), shot)));
        ArrayNode ls = meta.putArray("lines");
        for (Line l : r.source().lines()) {
            ObjectNode x = ls.addObject().put("id", l.id()).put("sid", l.sid()).put("text", l.text());
            if (shotOf.containsKey(l.id())) x.put("shot", shotOf.get(l.id()));
            if (l.offscreen()) x.put("offscreen", true);
        }
        // 原文写明「画面里只有某某」的镜头：这一镜有人开口时，优化稿写「她不说话」就是矛盾（见 checkSilence）。
        if (fixed) {
            ArrayNode solo = meta.putArray("soloShots");
            shotTexts(r.source().text()).forEach((shot, body) -> { if (body.contains("画面里只有")) solo.add(shot); });
        }
        // 模型写台词时，核对用原文里看着像台词的句子（与前端「台词提醒」同一套认法）。
        if (!r.codeLines()) {
            ArrayNode spoken = meta.putArray("spoken");
            for (String[] line : spokenLines(withoutTemplateSections(ownText(r.source().text())))) {
                ObjectNode x = spoken.addObject().put("speaker", line[0]).put("text", line[1]);
                if (!line[2].isEmpty()) x.put("unquoted", true);
            }
            if (r.source().text().contains(QUOTE_HEAD)) meta.put("quotedText", true);
        }
        return meta;
    }

    /** 中文原文里每一镜的那一段（与 {@link #linesByShot} 同样切）。 */
    static Map<Integer, String> shotTexts(String source) {
        Map<Integer, String> out = new LinkedHashMap<>();
        Matcher shot = SHOT_MARK.matcher(source);
        List<int[]> marks = new ArrayList<>();
        while (shot.find()) marks.add(new int[]{Integer.parseInt(halfWidthAlnum(shot.group(1))), shot.start()});
        for (int k = 0; k < marks.size(); k++) {
            int end = k + 1 < marks.size() ? marks.get(k + 1)[1] : source.length();
            out.merge(marks.get(k)[0], source.substring(marks.get(k)[1], end), String::concat);
        }
        return out;
    }

    private static final Pattern TEMPLATE_SECTION = Pattern.compile("【(人物|分镜参考)】[^【]*");

    /**
     * 导演台模板的【人物】【分镜参考】两段是素材说明，「静儿：长相、发型和衣服照参考图2。」形状像「名字：台词」，
     * 不当台词核对（否则每个改写过提示词的片段都会多出一条「原文台词没有出现」）。
     */
    static String withoutTemplateSections(String text) {
        return TEMPLATE_SECTION.matcher(text).replaceAll("");
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
        if (out == null || !out.isObject()) throw bad("模型返回格式有误");
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
            if (bodies.isEmpty()) throw bad("缺少镜头内容");
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
            if (defs.isEmpty()) warnings.add("优化稿缺少主体说明，人物可能与参考图不一致");
            if (summary.isEmpty()) warnings.add("优化稿缺少概述");
            if (retention.isEmpty()) warnings.add("优化稿缺少保留说明，人物外观可能不一致");
            // 每张参考图、每段参考音频都要在稿里出现：没提到的那份素材 H3 不知道拿它做什么。
            // 2026-10-31 cl45 加篇幅预算后真调第 2 次，整份稿一次都没提分镜图 <Picture 1>。
            // 漏掉的按交给模型的素材清单补一行定义和一行保留说明（只取英文说明，中文资产描述不带进去）；清单里也查不到才提示。
            String all = defs + "\n" + summary + "\n" + retention + "\n" + String.join("\n", bodies);
            for (var kind : List.of(Map.entry("Picture", "参考图"), Map.entry("Video", "参考视频"), Map.entry("Audio", "参考音频")))
                for (int i = 1; i <= limits.get(kind.getKey()); i++) {
                    String label = "<" + kind.getKey() + " " + i + ">";
                    if (all.contains(label)) continue;
                    String desc = referenceNote(meta, label);
                    if (desc == null) { warnings.add("优化稿没有提到" + kind.getValue() + " " + i + "，这份素材可能不起作用"); continue; }
                    defs = (defs + "\n" + label + " is the attached reference: " + desc).strip();
                    retention = (retention + "\n" + label + ": " + ("Audio".equals(kind.getKey()) ? "reference" : controlVideo(meta, label) ? "attribute_transfer" : "fully_preserved")
                            + " - used as described in subject_definitions.").strip();
                    notes.add("优化稿漏了" + kind.getValue() + " " + i + " 的说明，已按素材清单补上");
                }
            // 分镜图管构图、机位、人物位置和受光，导演台要 H3 照着拍：模型标成「部分保留」「只取大致相似」就改回完全保留
            //（2026-10-31 cl45 真调第 1 次标了 weak_reference）。只改关系标记，后面的说明不动；画布没有这个标记，不受影响。
            // 深度复刻的控制视频（深度图 / 骨骼图）只能迁移动作和机位：标成完全保留，H3 会把灰色画面或火柴人原样画出来（ReShot 的 H3 示例同此）。
            for (JsonNode c : meta.path("controlVideos")) {
                Matcher m = Pattern.compile("(?m)^(" + Pattern.quote(c.asText()) + "[^\\n]*?:\\s*)(fully_preserved|partially_preserved|weak_reference)\\b").matcher(retention);
                if (m.find()) {
                    retention = m.replaceAll("$1attribute_transfer");
                    notes.add("动作参考视频的保留关系已改为只迁移动作");
                }
            }
            String board = meta.path("storyboardPicture").asText("");
            if (!board.isEmpty()) {
                Matcher m = Pattern.compile("(?m)^(" + Pattern.quote(board) + "[^\\n]*?:\\s*)(partially_preserved|attribute_transfer|weak_reference)\\b").matcher(retention);
                if (m.find()) {
                    retention = m.replaceAll("$1fully_preserved");
                    notes.add("分镜图的保留关系已改为完全保留");
                }
            }
        }
        boolean anyShot = false;
        for (int i = 0; i < bodies.size(); i++) {
            if (!bodies.get(i).isEmpty()) { anyShot = true; continue; }
            bodies.set(i, i == 0 ? "The shot opens on the scene described in the request." : "the camera cuts to the next shot of the request.");
            warnings.add("第 " + (i + 1) + " 镜模型没写画面，只补了一句过渡");
        }
        if (!anyShot) throw bad("缺少镜头内容");

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
        checkSilence(meta, bodies, warnings, codeLines);
        // 整份写成了中文：汉字删完几乎不剩，不能当优化稿，否则自动模式会拿残缺稿出片（2026-11-07 OneToken 上的 DeepSeek，约十次一次）。
        int keptChars = defs.length() + summary.length() + retention.length() + style.length() + bodies.stream().mapToInt(String::length).sum();
        if (strayHan[0] > MAX_STRAY_HAN && keptChars < strayHan[0] * 2) throw bad("优化稿没有写成英文");
        if (strayHan[0] > MAX_STRAY_HAN) warnings.add("优化稿里有 " + strayHan[0] + " 个汉字没翻译，已删掉，画面描述可能缺了内容");
        else if (strayHan[0] > 0) notes.add("删掉了优化稿里零星没翻译的中文");

        String template = assemble(mode, bodies, starts, seconds, defs, summary, retention, style, sound, music);
        String language = meta.path("language").asText("Chinese");
        if (fill(template, lines(meta), language).length() > MAX_PROMPT_CHARS && mode == Mode.REF) {
            // 超长时只精简能确定是重复的部分：fully_preserved 行后面的说明就是把主体说明里的特征再列一遍。
            // 其余关系（部分保留、属性迁移、音频复制）后面写的是改了什么、保留什么，一律不动（Codex 评审 2026-10-31）。
            String shorter = trimFullyPreserved(retention);
            String again = assemble(mode, bodies, starts, seconds, defs, summary, shorter, style, sound, music);
            if (!shorter.equals(retention) && fill(again, lines(meta), language).length() <= MAX_PROMPT_CHARS) {
                template = again;
                notes.add("优化稿略超长，已删掉保留说明里重复列出的外貌特征");
            }
        }
        boolean usable = true;
        if (fill(template, lines(meta), language).length() > MAX_PROMPT_CHARS) {
            usable = false;
            warnings.add("优化稿超过 " + MAX_PROMPT_CHARS + " 字符，超出模型上限，请重新优化或按原文生成");
        }
        ObjectNode result = om.createObjectNode().put("template", template).put("usable", usable);
        ArrayNode w = result.putArray("warnings");
        warnings.forEach(w::add);
        ArrayNode n = result.putArray("notes");
        notes.forEach(n::add);
        return result;
    }

    private static boolean controlVideo(JsonNode meta, String label) {
        for (JsonNode c : meta.path("controlVideos")) if (label.equals(c.asText())) return true;
        return false;
    }

    /** 素材清单里这一份的英文说明（去掉「Written notes」后面的中文资产描述）；旧任务没记清单或找不到时返回 null。 */
    private static String referenceNote(JsonNode meta, String label) {
        for (JsonNode ref : meta.path("references")) {
            String s = ref.asText("");
            if (!s.startsWith(label + ":")) continue;
            String desc = s.substring(label.length() + 1);
            int notes = desc.indexOf(" Written notes:");
            if (notes >= 0) desc = desc.substring(0, notes);
            desc = desc.strip();
            return desc.isEmpty() || HAN_RUN.matcher(desc).find() ? null : desc;
        }
        return null;
    }

    private static final Pattern FULLY_PRESERVED = Pattern.compile("^(<(?:Subject|Picture|Video) \\d+>[^\n]*?:\\s*fully_preserved)\\s*-.*$");

    /** 保留说明里关系是 fully_preserved 的行只留到关系标记为止；别的行原样。 */
    static String trimFullyPreserved(String retention) {
        StringBuilder out = new StringBuilder();
        for (String line : retention.split("\n", -1)) {
            Matcher m = FULLY_PRESERVED.matcher(line.strip());
            out.append(out.length() > 0 ? "\n" : "").append(m.matches() ? m.group(1) + "." : line);
        }
        return out.toString();
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
        List<Boolean> loose = new ArrayList<>();
        for (JsonNode line : meta.path("spoken")) if (!squash(line.path("text").asText()).isEmpty()) {
            wantedRaw.add(line.path("text").asText());
            wanted.add(squash(line.path("text").asText()));
            loose.add(line.path("unquoted").asBoolean(false));
        }
        if (String.join("", said).equals(String.join("", wanted))) return; // 一字不差（拆句、合句都算）
        // 按顺序配对：每句原文台词在后面的 <d> 里找连着的一句或几句正好拼成它，配上的就用掉；
        // 配不上的原文台词、没被用掉的 <d> 都提示。不能逐句做子串放行：原文「不同意」，优化稿先说「不同意」再加一句「同意」也得报出来。
        boolean[] used = new boolean[said.size()];
        List<String> unmatched = new ArrayList<>();
        int from = 0;
        for (int i = 0; i < wanted.size(); i++) {
            int[] hit = consecutive(said, from, wanted.get(i));
            // 没加引号的台词到哪里为止说不准：「说：不好吃，转身去够辣椒面」里说的是「不好吃」，按逗号前的几截（长的先试）也算对上。
            if (hit == null && loose.get(i)) {
                String[] parts = wantedRaw.get(i).split("[，,、；;…—]+");
                for (int k = parts.length - 1; k >= 1 && hit == null; k--) {
                    String head = squash(String.join("", java.util.Arrays.copyOfRange(parts, 0, k)));
                    if (!head.isEmpty()) hit = consecutive(said, from, head);
                }
            }
            if (hit == null) {
                unmatched.add(wanted.get(i));
                warnings.add("原文台词「" + excerpt(wantedRaw.get(i)) + "」在优化稿里没有原样出现，可能被改了或漏了");
                continue;
            }
            for (int k = hit[0]; k <= hit[1]; k++) used[k] = true;
            from = hit[1] + 1;
        }
        // 连进来的文字不参与核对（见 ownText），模型从里面写的台词不算多出来的。
        if (wanted.isEmpty() || meta.path("quotedText").asBoolean()) return;
        // 剩下的 <d> 是某句没配上的原文台词的一截（说了半句），上面已经报过；其余算多出来的。
        for (int i = 0; i < said.size(); i++) {
            String one = said.get(i);
            if (used[i] || unmatched.stream().anyMatch(w -> w.contains(one))) continue;
            warnings.add("优化稿多了一句原文没有的台词「" + excerpt(saidRaw.get(i)) + "」");
        }
    }

    /** 整镜没有人说话的说法：「No speech is audible.」「There is no dialogue.」。 */
    private static final Pattern NO_SPEECH = Pattern.compile(
            "\\b(no (speech|dialogue|dialog|one speaks|spoken (words?|lines?)|(words?|lines?) (is|are) spoken)|nobody speaks|no-one speaks"
            + "|without (any )?(speech|dialogue)|speech is not audible)\\b", Pattern.CASE_INSENSITIVE);
    /** 某个人不开口的说法：「She does not speak.」「He remains silent.」。 */
    private static final Pattern SUBJECT_SILENT = Pattern.compile(
            "\\b((does not|doesn't|do not|don't|never) (speak|talk|say a word)|says? nothing|without (speaking|a word|saying a word)"
            + "|(remains?|stays?|keeps?) (silent|quiet|mute))\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern VOICEOVER = Pattern.compile("off-screen|offscreen|voice-?over|narrat", Pattern.CASE_INSENSITIVE);

    /**
     * 按原文核对「有台词」和「没人说话」没有写在同一镜里。2026-11-10 线上：客户在第 3 镜加了「味道还是不行」，优化稿第 3 镜却写
     * 「No speech is audible.」，视频里她一句没说。台词由代码填时这一镜有没有台词看占位，模型写时看 {@code <d>}。
     * 整镜「没有对白」的句子与原文矛盾，删掉并提示；原文写明「画面里只有某某」、这一镜又是画面里的人开口时，「她不说话」只提示
     * （多人镜头里写听的人不说话是对的，分不清就不动）。
     */
    private static void checkSilence(JsonNode meta, List<String> bodies, Set<String> warnings, boolean codeLines) {
        Map<String, Boolean> offscreen = new HashMap<>();
        meta.path("lines").forEach(l -> offscreen.put(l.path("id").asText(), l.path("offscreen").asBoolean(false)));
        Set<Integer> solo = new HashSet<>();
        meta.path("soloShots").forEach(x -> solo.add(x.asInt()));
        for (int i = 0; i < bodies.size(); i++) {
            String body = bodies.get(i);
            Matcher ph = PLACEHOLDER.matcher(body);
            boolean spoken = false, onScreen = false;
            while (ph.find()) { spoken = true; onScreen |= !offscreen.getOrDefault(ph.group(1), false); }
            if (!codeLines && SPOKEN.matcher(body).find()) { spoken = true; onScreen = !VOICEOVER.matcher(body).find(); }
            if (!spoken) continue;
            StringBuilder kept = new StringBuilder();
            boolean dropped = false;
            for (String sentence : sentences(body)) {
                boolean carriesLine = PLACEHOLDER.matcher(sentence).find() || SPOKEN.matcher(sentence).find();
                if (!carriesLine && NO_SPEECH.matcher(sentence).find()) { dropped = true; continue; }
                kept.append(sentence);
            }
            if (dropped) {
                bodies.set(i, kept.toString().strip());
                warnings.add("第 " + (i + 1) + " 镜有台词，优化稿却写了没有对白，已删掉这句");
            }
            String narration = SPOKEN.matcher(PLACEHOLDER.matcher(bodies.get(i)).replaceAll("")).replaceAll("");
            if (onScreen && solo.contains(i + 1) && SUBJECT_SILENT.matcher(narration).find())
                warnings.add("第 " + (i + 1) + " 镜有台词，优化稿却写了人物不说话，可能与台词冲突");
        }
    }

    /**
     * 英文按句切开（句号、问号、感叹号后面跟空白或到结尾才算一句结束，「00:04.000」「1.5 m」不切），拼回去与原文一字不差。
     * 台词（占位或 {@code <d>…</d>}）后面跟空白也算一句结束：模型常写「says: {{L1}} No speech is audible.」，台词后面不打句号。
     */
    static List<String> sentences(String text) {
        List<String> out = new ArrayList<>();
        int start = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            boolean closes = ".!?".indexOf(ch) >= 0 || text.startsWith("}}", i - 1) || text.startsWith("</d>", i - 3);
            boolean end = ch == '\n' || closes && (i + 1 == text.length() || Character.isWhitespace(text.charAt(i + 1)));
            if (!end) continue;
            int j = i + 1;
            while (j < text.length() && Character.isWhitespace(text.charAt(j))) j++;
            out.add(text.substring(start, j));
            start = j;
            i = j - 1;
        }
        if (start < text.length()) out.add(text.substring(start));
        return out;
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

    // ── 连进来的文字：前端按「【引用文本：标题】\n正文」接在提示词后面（studio-linked-inputs.ts），块之间空一行 ──────────

    private static final String QUOTE_HEAD = "【引用文本：";
    private static final Pattern QUOTE_BLOCK = Pattern.compile("\\s*【引用文本：[^】\\n]*】\\n");

    /**
     * 用户自己写的那部分。引用块多是拉片或说明文字，「创意：…」「灯光：…」看着像「名字：台词」，
     * 2026-11-06 线上一次报出 31 条「原文台词没有出现」，任务全部停下等用户选（三个模型都一样）。
     */
    static String ownText(String prompt) {
        Matcher m = QUOTE_BLOCK.matcher(prompt);
        return m.find() ? prompt.substring(0, m.start()) : prompt;
    }

    /**
     * 引用块的内容已经写在前面了就去掉这一块，与前端 withStudioLinkedText 同一条规则；这里兜住早先存下的请求。
     * 2026-11-06 线上：脚本已填进提示词，又连着同一份文字节点，整份脚本出现两遍，台词也就变成两遍。只比较去掉空白后的文字。
     */
    public static String withoutRepeatedQuotes(String prompt) {
        if (prompt == null || !prompt.contains(QUOTE_HEAD)) return prompt;
        Matcher m = QUOTE_BLOCK.matcher(prompt);
        List<int[]> heads = new ArrayList<>();
        while (m.find()) heads.add(new int[]{m.start(), m.end()});
        if (heads.isEmpty()) return prompt;
        StringBuilder out = new StringBuilder(prompt.substring(0, heads.get(0)[0]));
        for (int i = 0; i < heads.size(); i++) {
            int end = i + 1 < heads.size() ? heads.get(i + 1)[0] : prompt.length();
            String body = prompt.substring(heads.get(i)[1], end);
            if (!squashSpace(out.toString()).contains(squashSpace(body))) out.append(prompt, heads.get(i)[0], end);
        }
        return out.toString();
    }

    private static String squashSpace(String value) { return value.replaceAll("\\s+", ""); }

    // ── 原文里的台词（模型写台词时核对用）：与前端 studio-video-prompt.ts 的 studioPromptLines 同一套认法 ──────────

    private static final Pattern DIRECTION = Pattern.compile("时间|地点|场景|画面|镜头|景别|机位|运镜|构图|光线|灯光|色调|风格|氛围|背景|环境|表情|动作|神态|情绪|声音|音效|音乐|配乐|bgm|切镜|转场|节奏|时长|首帧|尾帧|参考|服装|造型|道具|字幕|备注|要求|注意|说明|提示|描述|内容|主题|画幅|比例|清晰度|定位|开场|结尾|结局|细节|特写|近景|远景|中景|全景|口型|音色|语气|语速|人物|角色|主体", Pattern.CASE_INSENSITIVE);
    private static final Pattern SPEECH_LABEL = Pattern.compile("^(台词|对白|旁白|独白|画外音)$");
    private static final Pattern SPEECH_LABEL_TEXT = Pattern.compile("(^|[\\s。！？!?；;，,…」』”）)\\]】])([^\\s：:，,。！？!?；;、“”\"「」『』（）()【】\\[\\]<>]{1,12})(?:[（(][^）)\\n]{0,16}[）)])?\\s*[：:](?!\\d)");
    private static final Map<Character, Character> OPEN_QUOTE = Map.of('“', '”', '「', '」', '『', '』', '"', '"');

    /** 「名字：台词」「名字说：“台词”」「台词：……」。引号里的整段算一句，没引号的到第一个句号为止。返回 [说话人, 台词, 没加引号时非空]。 */
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
            // 第三项非空表示没加引号：到哪里为止说不准（「说：不好吃，转身去够辣椒面」），核对时按逗号前的几截也算对上。
            if (squash(text).codePointCount(0, squash(text).length()) >= 2) out.add(new String[]{speaker, text, close == null ? "unquoted" : ""});
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
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "视频提示词优化失败（" + message + "），本次未扣积分。请重试或按原文生成");
    }
}
