package com.aistareco.aep.ipstudio.director;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 提交 H3 片段视频前，把用户看到的中文视频提示词改写成 H3 官方写法（MiniMax 官方 skill 原文，{@code resources/director/h3-skill}）。
 *
 * <p>为什么要改写：2026-10-26 同一片段对比实测（docs/audits/director-h3-video-prompt-ab-2026-10.md §6）——台词多时，
 * 中文正文会吞掉整句台词、还会把提示词里的中文念出来；英文正文 + 中文 {@code <d>} 台词三句都完整。官方 skill 正是这么要求的。
 *
 * <p>模型只写画面：按 JSON 分段输出，台词位置只留 {@code {{L1}}} 占位。六段标题、{@code [Shot N] At MM:SS.mmm} 由这里拼，
 * 存下的英文稿保留占位（模板）；提交时用当前台词填成 {@code (Sx) <d>[语言] 原文</d>}（{@link #fill}）——
 * 实测改写模型两次漏写说话人编号，台词也可能被改；只改台词文字也不用重新改写。
 * 校验不过（占位缺失或重复、模型自己写台词 / 编号 / 标签、正文里有中文、镜头数不对、参考图编号越界、超长）就判失败、全额退回，不提交视频。
 */
final class DirectorH3Rewrite {
    private DirectorH3Rewrite() {}

    /** 改写规则的版本：skill 原文或下面的输出约定变了就加一，已存的英文稿随之失效、下次重新改写。 */
    static final int VERSION = 1;
    static final int MAX_TOKENS = 4_096;
    static final int MAX_PROMPT_CHARS = 7_000;

    /** 一句台词：L1… 是占位编号，S1… 是说话人编号（按第一次开口的顺序，同一个人跨镜头不变）。 */
    record Line(String id, String speaker, String sid, String text, boolean offscreen) {}

    /** 交给模型的中文原文（台词已换成占位）与认出来的台词。 */
    record Source(String text, List<Line> lines) {}

    /** 模板写法：「林小雅说：「…」」「旁白在画外说：「…」」。 */
    private static final Pattern LINE = Pattern.compile("([^\\s，。：；！？、「」“”（）()]{1,24}?)(在画外)?说：「(.+?)」");
    /** 2026-10-26 之前的模板（用户改写过、还留着旧格式的提示词）：「第2镜 · @林小雅 · “…”」。 */
    private static final Pattern LEGACY_LINE = Pattern.compile("@([^\\s·]{1,24}) · “(.+?)”");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(L\\d+)}}");

    private static final String CONTRACT = """

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

    private static String skill;

    /** 系统提示词：官方 skill 三份原文（SKILL.md + 两份写法规范）+ 本服务的输出约定。 */
    static synchronized String system() {
        if (skill == null) skill = resource("SKILL.md") + "\n\n# references/base-en.txt\n\n" + resource("base-en.txt")
                + "\n\n# references/ref-en.txt\n\n" + resource("ref-en.txt");
        return skill + CONTRACT;
    }

    private static String resource(String name) {
        try (InputStream in = DirectorH3Rewrite.class.getResourceAsStream("/director/h3-skill/" + name)) {
            if (in == null) throw new IllegalStateException("缺少 H3 写法资源 " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("读取 H3 写法资源失败 " + name, e);
        }
    }

    /**
     * 从中文提示词里认出台词，换成 {@code {{Ln}}}。说话人名字以已知的名字为准（「画面里只有林小雅。林小雅说」只认「林小雅」）。
     * 说话人编号按第一次开口的顺序分配，旁白也算一个说话人。
     */
    static Source source(String zh, List<String> knownNames) {
        List<String> names = new ArrayList<>(knownNames);
        names.sort(Comparator.comparingInt(String::length).reversed());
        List<Line> lines = new ArrayList<>();
        Map<String, String> sids = new LinkedHashMap<>();
        StringBuilder out = new StringBuilder();
        Matcher m = LINE.matcher(zh);
        int last = 0;
        while (m.find()) {
            String speaker = known(m.group(1), names);
            String id = "L" + (lines.size() + 1);
            String sid = sids.computeIfAbsent(speaker, k -> "S" + (sids.size() + 1));
            lines.add(new Line(id, speaker, sid, m.group(3), m.group(2) != null));
            out.append(zh, last, m.start(3) - 1).append("{{").append(id).append("}}");
            last = m.end();
        }
        out.append(zh.substring(last));
        if (!lines.isEmpty()) return new Source(out.toString(), lines);
        // 旧格式：台词集中在【语音轨】里，按同样的规则换成占位。
        out.setLength(0); last = 0;
        m = LEGACY_LINE.matcher(zh);
        while (m.find()) {
            String speaker = known(m.group(1), names);
            String id = "L" + (lines.size() + 1);
            String sid = sids.computeIfAbsent(speaker, k -> "S" + (sids.size() + 1));
            lines.add(new Line(id, speaker, sid, m.group(2), "旁白".equals(speaker)));
            out.append(zh, last, m.start(2) - 1).append("{{").append(id).append("}}");
            last = m.end();
        }
        out.append(zh.substring(last));
        return new Source(out.toString(), lines);
    }

    private static String known(String captured, List<String> namesLongestFirst) {
        for (String n : namesLongestFirst) if (!n.isBlank() && captured.endsWith(n)) return n;
        return captured;
    }

    /**
     * 用户消息：目标视频、按提交顺序的参考素材清单、带占位的中文原文、每镜有哪几句台词，最后是要填的 JSON 骨架。规则都在系统提示词里。
     * 骨架把 shot_1…shot_N 的键都列出来：2026-10-26 真模型试跑，让模型自己往数组里写镜头，3 段里 2 段只写了第 1 镜就收尾。
     */
    static String user(int seconds, int shots, List<String> references, String source) {
        // 环境声、配乐排在镜头前：2026-10-26 线上 21 段评测，排在后面时 4 镜的片段 7/36 次写完 shot_4 就收尾、漏了这两项。
        StringBuilder perShot = new StringBuilder(), skeleton = new StringBuilder("{\"subject_definitions\":\"\",\"summary\":\"\",\"retention_analysis\":\"\",\"style\":\"\","
                + "\"overall_soundscape\":\"\",\"non_diegetic_music\":\"\"");
        Map<Integer, List<String>> byShot = linesByShot(source);
        for (int i = 1; i <= shots; i++) {
            List<String> ids = byShot.getOrDefault(i, List.of());
            perShot.append("Shot ").append(i).append(": ").append(ids.isEmpty() ? "no spoken lines" : String.join(", ", ids)).append('\n');
            skeleton.append(",\"shot_").append(i).append("\":\"\"");
        }
        skeleton.append('}');
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
                """.formatted(seconds, shots, shots == 1 ? "" : "s", String.join("\n", references),
                // 没有音频参考就别提「音频N」：2026-10-26 线上评测里模型据此编出一个 <Audio 1> 给画外音用。
                references.stream().anyMatch(r -> r.startsWith("<Audio ")) ? "参考图N means <Picture N>, 音频N means <Audio N>"
                        : "参考图N means <Picture N>; no reference audio is attached, so use no <Audio N> label",
                source.strip(), perShot, shots, skeleton);
    }

    /** 中文原文里每一镜（「第N镜（」开头的一段）有哪几个台词占位；不按这个格式写的原文返回空。 */
    static Map<Integer, List<String>> linesByShot(String source) {
        Map<Integer, List<String>> out = new LinkedHashMap<>();
        Matcher shot = Pattern.compile("第(\\d+)镜（").matcher(source);
        List<int[]> marks = new ArrayList<>();
        while (shot.find()) marks.add(new int[]{Integer.parseInt(shot.group(1)), shot.start()});
        for (int k = 0; k < marks.size(); k++) {
            int end = k + 1 < marks.size() ? marks.get(k + 1)[1] : source.length();
            Matcher m = PLACEHOLDER.matcher(source.substring(marks.get(k)[1], end));
            while (m.find()) out.computeIfAbsent(marks.get(k)[0], x -> new ArrayList<>()).add("{{" + m.group(1) + "}}");
        }
        return out;
    }

    /** 台词的语言标签：作品设置里的语言，认不出按中文。 */
    static String languageTag(String language) {
        if (language == null) return "Chinese";
        String l = language.trim().toLowerCase();
        if (l.startsWith("英") || l.startsWith("en")) return "English";
        if (l.startsWith("粤") || l.contains("cantonese")) return "Cantonese";
        return "Chinese";
    }

    /** 写进任务输入的核对信息：镜头数、每镜开始时间、参考图 / 音频数量、台词。 */
    static ObjectNode meta(ObjectMapper om, int shots, List<Double> starts, int pictures, int audios, String language, List<Line> lines) {
        ObjectNode meta = om.createObjectNode().put("task", "videoPrompt").put("shots", shots).put("pictures", pictures)
                .put("audios", audios).put("language", languageTag(language));
        ArrayNode cuts = meta.putArray("starts");
        starts.forEach(cuts::add);
        ArrayNode ls = meta.putArray("lines");
        for (Line l : lines) ls.addObject().put("id", l.id()).put("sid", l.sid()).put("text", l.text());
        return meta;
    }

    // ── 校验与组装（worker 内执行，失败全额退回）──────────────────────────────

    static JsonNode validate(ObjectMapper om, JsonNode meta, JsonNode out) {
        int shots = meta.path("shots").asInt();
        int[] strayHan = {0};
        String defs = clean(required(out, "subject_definitions"), strayHan), summary = clean(required(out, "summary"), strayHan),
                retention = clean(required(out, "retention_analysis"), strayHan);
        String style = clean(text(out, "style"), strayHan), sound = clean(text(out, "overall_soundscape"), strayHan),
                music = clean(text(out, "non_diegetic_music"), strayHan);
        // 漏写环境声不算错：用中性的一句补上，不让它编声音；配乐漏写就是没有。
        if (sound.isEmpty()) sound = DEFAULT_SOUNDSCAPE;
        if (music.isEmpty()) music = "N/A";
        // 镜头按骨架的 shot_1…shot_N 读；模型改回数组也认，但数量必须对。
        List<String> bodies = new ArrayList<>();
        JsonNode arr = out.path("shots");
        if (arr.isArray()) {
            if (arr.size() != shots) throw bad("改写稿有 " + arr.size() + " 个镜头，应为 " + shots + " 个");
            arr.forEach(x -> bodies.add(x.isTextual() ? x.asText() : ""));
        } else for (int i = 1; i <= shots; i++) bodies.add(text(out, "shot_" + i));
        for (int i = 0; i < bodies.size(); i++) {
            String body = clean(stripShotPrefix(bodies.get(i).strip()), strayHan);
            if (body.isEmpty()) throw bad("改写稿缺少第 " + (i + 1) + " 镜");
            bodies.set(i, body);
        }
        // 引用了不存在的参考图 / 音频的句子（不含台词时）删掉：2026-10-26 线上评测，模型给画外音编了一个 <Audio 1>。
        int pictures = meta.path("pictures").asInt(), audios = meta.path("audios").asInt();
        defs = dropUnknownLabels(defs, pictures, audios); summary = dropUnknownLabels(summary, pictures, audios);
        retention = dropUnknownLabels(retention, pictures, audios); style = dropUnknownLabels(style, pictures, audios);
        sound = dropUnknownLabels(sound, pictures, audios); music = dropUnknownLabels(music, pictures, audios);
        for (int i = 0; i < bodies.size(); i++) bodies.set(i, dropUnknownLabels(bodies.get(i), pictures, audios));
        if (defs.isEmpty() || summary.isEmpty() || retention.isEmpty()) throw bad("改写稿只剩不存在的参考素材");
        if (sound.isEmpty()) sound = DEFAULT_SOUNDSCAPE;
        if (music.isEmpty()) music = "N/A";
        // 台词只能出现在镜头里，每句恰好一次；模型不能自己写台词或 <d> 标签（说话人编号已在上面去掉，由 fill 统一写）。
        for (String f : List.of(defs, summary, retention, style, sound, music))
            if (PLACEHOLDER.matcher(f).find()) throw bad("改写稿把台词放在了镜头之外");
        Map<String, JsonNode> lines = new LinkedHashMap<>();
        meta.path("lines").forEach(l -> lines.put(l.path("id").asText(), l));
        Map<String, Integer> seen = new HashMap<>();
        for (String b : bodies) {
            Matcher m = PLACEHOLDER.matcher(b);
            while (m.find()) {
                if (!lines.containsKey(m.group(1))) throw bad("改写稿引用了不存在的台词");
                seen.merge(m.group(1), 1, Integer::sum);
            }
        }
        for (String id : lines.keySet()) if (seen.getOrDefault(id, 0) != 1) throw bad("改写稿漏了或重复了台词");
        List<String> all = new ArrayList<>(List.of(defs, summary, retention, style, sound, music));
        all.addAll(bodies);
        // 零星漏翻的中文词已在 clean 里删掉；漏翻太多说明这一稿没翻好，拒收。
        if (strayHan[0] > MAX_STRAY_HAN) throw bad("改写稿里还有 " + strayHan[0] + " 个汉字没翻译");
        for (String f : all) if (f.contains("<d>") || f.contains("</d>")) throw bad("改写稿自己写了台词标记");
        requireLabels(all, "Picture", meta.path("pictures").asInt());
        requireLabels(all, "Audio", meta.path("audios").asInt());

        List<Double> starts = new ArrayList<>();
        meta.path("starts").forEach(x -> starts.add(x.asDouble()));
        StringBuilder detail = new StringBuilder();
        if (!style.isEmpty()) detail.append(style).append('\n');
        for (int i = 0; i < bodies.size(); i++) {
            String body = bodies.get(i);
            if (i > 0) detail.append('\n');
            detail.append("[Shot ").append(i + 1).append("] ");
            if (i > 0) detail.append("At ").append(clock(i < starts.size() ? starts.get(i) : 0)).append(", ");
            detail.append(body);
        }
        String template = "subject_definitions:\n" + defs + "\n\nsummary:\n" + summary + "\n\nretention_analysis:\n" + retention
                + "\n\ndetailed_description:\n" + detail + "\n\noverall_soundscape:\n" + sound + "\n\nnon_diegetic_music:\n" + music;
        List<Line> current = new ArrayList<>();
        lines.values().forEach(l -> current.add(new Line(l.path("id").asText(), "", l.path("sid").asText(), l.path("text").asText(), false)));
        if (fill(template, current, meta.path("language").asText("Chinese")).length() > MAX_PROMPT_CHARS)
            throw bad("改写稿超过 " + MAX_PROMPT_CHARS + " 字符");
        return om.createObjectNode().put("template", template);
    }

    /** 把台词填进英文稿：{@code {{Ln}}} → {@code (Sx) <d>[语言] 原文</d>}。台词按官方写法规整标点，字不改。 */
    static String fill(String template, List<Line> lines, String languageTag) {
        String out = template;
        for (Line l : lines) out = out.replace("{{" + l.id() + "}}", "(" + l.sid() + ") <d>[" + languageTag + "] " + tidy(l.text()) + "</d>");
        return out;
    }

    /** 模型漏写环境声时补的一句：只说跟画面一致，不替它编具体声源。 */
    static final String DEFAULT_SOUNDSCAPE = "Natural ambient sound of the location that matches the actions on screen.";
    /** 零星漏翻的汉字由代码删掉；超过这个数说明这一稿没翻好。 */
    static final int MAX_STRAY_HAN = 20;
    private static final Pattern HAN_IN_PARENS = Pattern.compile("\\s*[(（][\\p{IsHan}\\u3000-\\u303F\\uFF00-\\uFFEF\\s]+[)）]");
    private static final Pattern HAN_RUN = Pattern.compile("[\\p{IsHan}\\u3000-\\u303F\\uFF00-\\uFFEF]+");

    /**
     * 模型写的一段英文的清理：去掉它自己写的说话人编号；删掉零星漏翻的中文（{@code Steve Chou (史蒂芬周)}、{@code his狼狈 figure}，
     * 2026-10-26 线上评测 3/36 次），计数给调用方判断是否漏翻太多。英文双引号里的画面文字和台词占位不动。
     */
    static String clean(String s, int[] strayHan) {
        String[] parts = s.split("\"", -1);
        for (int i = 0; i < parts.length; i += 2) { // 偶数段在引号外
            String part = parts[i];
            Matcher m = HAN_RUN.matcher(part);
            while (m.find()) strayHan[0] += m.group().codePointCount(0, m.group().length());
            part = HAN_RUN.matcher(HAN_IN_PARENS.matcher(part).replaceAll("")).replaceAll(" ");
            parts[i] = part.replaceAll("[ \\t]{2,}", " ").replaceAll(" ([,.;:!?])", "$1");
        }
        return withoutIds(String.join("\"", parts)).strip();
    }

    private static final Pattern SPEAKER_ID = Pattern.compile("\\s?\\(S\\d+(?:\\s*,\\s*S\\d+)*\\)");

    /**
     * 模型照官方范例写的说话人编号（{@code <Subject 1> (S1) says}）去掉：编号统一由 {@link #fill} 写在台词前，
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
        return String.format("%02d:%02d.%03d", ms / 60_000, (ms / 1000) % 60, ms % 1000);
    }

    private static final Pattern SENTENCE = Pattern.compile("[^.!?\\n]*(?:[.!?]+|$)\\s*");

    /**
     * 删掉引用了不存在的 {@code <Picture N>} / {@code <Audio N>} 的句子；含台词占位的句子不删（删了台词就丢了），留给后面的校验拒收。
     * 按「. ! ? 换行」切句，retention_analysis 一行一条也就按行删。
     */
    static String dropUnknownLabels(String text, int pictures, int audios) {
        if (!hasUnknownLabel(text, pictures, audios)) return text;
        StringBuilder out = new StringBuilder();
        for (String line : text.split("\n", -1)) {
            StringBuilder kept = new StringBuilder();
            Matcher m = SENTENCE.matcher(line);
            while (m.find() && !m.group().isEmpty()) {
                String sentence = m.group();
                if (hasUnknownLabel(sentence, pictures, audios) && !PLACEHOLDER.matcher(sentence).find()) continue;
                kept.append(sentence);
            }
            String k = kept.toString().strip();
            if (!k.isEmpty()) out.append(out.length() > 0 ? "\n" : "").append(k);
        }
        return out.toString();
    }

    private static boolean hasUnknownLabel(String text, int pictures, int audios) {
        for (var e : Map.of("Picture", pictures, "Audio", audios).entrySet()) {
            Matcher m = Pattern.compile("<" + e.getKey() + " (\\d+)>").matcher(text);
            while (m.find()) { int n = Integer.parseInt(m.group(1)); if (n < 1 || n > e.getValue()) return true; }
        }
        return false;
    }

    private static void requireLabels(List<String> texts, String kind, int count) {
        Pattern p = Pattern.compile("<" + kind + " (\\d+)>");
        for (String t : texts) {
            Matcher m = p.matcher(t);
            while (m.find()) {
                int n = Integer.parseInt(m.group(1));
                if (n < 1 || n > count) throw bad("改写稿引用了不存在的" + ("Picture".equals(kind) ? "参考图" : "参考音频"));
            }
        }
    }

    private static String required(JsonNode out, String field) {
        String v = text(out, field);
        if (v.isEmpty()) throw bad("改写稿缺少 " + field);
        return v;
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isTextual() ? v.asText().strip() : "";
    }

    static BusinessException bad(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "视频提示词改写不合格（" + message + "），本次未扣积分，请重试");
    }
}
