package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AI 导演台的提示词与模型输出契约。
 *
 * <p>文字任务（编剧 / 分集 / 资产统筹 / 分镜导演）的提示词改写自 docs/prompts/ai-director-agents-v1.md 的 A1–A4，
 * 正文在提示词库（docs/studio-prompt-architecture.md §8 #17–#19）；
 * 资产图、分镜图、视频提示词是按已采用内容的模板编译（同文档 A6 与 docs/prompts/ai-director-visual-production.md），
 * 不额外调用模型。用户能在界面上看到并改写编译结果。
 *
 * <p>输出校验在 worker 里执行：结构不对就判失败、全额退回，不把残缺结果交给作品（§8.0.1 ⑦）。
 */
public final class DirectorPrompts {
    private DirectorPrompts() {}

    /** 分镜板最多 4 格（2×2，格子与整板同比例）。片段时长不写死：来自作品所选视频模型的合同。 */
    public static final int MAX_SHOTS = 4;

    // ── 文字任务的提示词（docs/studio-prompt-architecture.md §8 #17–#19）──────────────────────────────────────
    // 正文都在提示词库（resources/studio/prompts/：底座 base-director、环节 stage-director-*、题材 / 调性 / 反转线是内容方法），
    // 后台「提示词与技能」里改；这里只决定用哪个环节、拼哪几份内容方法、填什么变量。输出结构在 StudioPromptFormats，和下面的校验是一对。

    /** 题材 → 内容方法。界面上能选的题材就是这些 key（顺序即界面顺序），追加规则的正文在提示词库。 */
    public static final java.util.Map<String, String> GENRES = ordered(
            "都市悬疑", "director-genre-urban-suspense", "市井情感", "director-genre-street-life", "奇幻脑洞", "director-genre-fantasy",
            "职场现实", "director-genre-workplace", "民国谍战", "director-genre-republic-spy", "校园青春", "director-genre-campus");
    /** 调性 → 内容方法，同上。 */
    public static final java.util.Map<String, String> TONES = ordered(
            "反转烧脑", "director-tone-twist", "治愈温情", "director-tone-healing", "爽感打脸", "director-tone-payback",
            "黑色幽默", "director-tone-dark-humor", "细思极恐", "director-tone-creepy");

    /**
     * 反转线：三层反转和「3 集一小高潮、6 集一中反转、结局大反转」只给反转烧脑调性和悬疑类题材。
     * 默认套在所有题材上，会让治愈、市井、校园这类故事为凑反转硬造冲突（2026-10-25 评审后用户确认）。
     * 其他题材只保留编剧环节里的「反转必须有可回溯的伏笔」。
     */
    static final Set<String> REVERSAL_GENRES = Set.of("都市悬疑", "民国谍战");
    static final String REVERSAL = "director-reversal";

    private static java.util.Map<String, String> ordered(String... pairs) {
        java.util.Map<String, String> out = new java.util.LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) out.put(pairs[i], pairs[i + 1]);
        return java.util.Collections.unmodifiableMap(out);
    }

    /** 一次导演台文字任务拼好的提示词；{@code assembled} 用来把这次用到的版本记进任务（{@code _exec.prompt}）。 */
    public record Text(String system, String user, StudioPromptAssembler.Assembled assembled) {}

    static Text text(StudioPromptAssembler prompts, String stage, List<String> methods, java.util.Map<String, ?> vars) {
        prompts.requireStage(stage);
        var out = prompts.assemble(new StudioPromptAssembler.Call(stage, methods, null, vars, null, null, null));
        return new Text(out.system(), out.user(), out);
    }

    /** 编剧拼哪几份内容方法：反转线（反转烧脑或悬疑题材）→ 命中的题材 → 命中的调性。 */
    static List<String> scriptMethods(String genre, String tone) {
        List<String> out = new ArrayList<>();
        if ("反转烧脑".equals(tone) || (genre != null && REVERSAL_GENRES.contains(genre))) out.add(REVERSAL);
        if (genre != null && GENRES.containsKey(genre)) out.add(GENRES.get(genre));
        if (tone != null && TONES.containsKey(tone)) out.add(TONES.get(tone));
        return out;
    }

    /** 编剧：策划与写法照用户给的竖屏短剧编剧提示词；输出 {title, logline, outline, content}，后面的拆分 / 提取 / 规划都读 content。 */
    public static Text script(StudioPromptAssembler prompts, String genre, String tone, String input) {
        return script(prompts, genre, tone, null, input);
    }

    /** kind：长剧、单集短片各有一段写法（多集短剧就是编剧环节的默认写法），见 methods/director-form-*。 */
    public static Text script(StudioPromptAssembler prompts, String genre, String tone, String kind, String input) {
        return script(prompts, genre, tone, kind, false, input);
    }

    /** commerce：带货短剧且作品里有商品，多拼一份把商品写进剧情的规则（docs/ai-director-commerce-plan.md §5）。 */
    public static Text script(StudioPromptAssembler prompts, String genre, String tone, String kind, boolean commerce, String input) {
        return text(prompts, StudioPromptCallPoints.DIRECTOR_SCRIPT, withCommerce(formMethods(genre, tone, kind), COMMERCE_SCRIPT, commerce), java.util.Map.of("input", input, "commerce", commerce));
    }

    /** 接着写后面几集（长的剧本分批写）。 */
    public static Text scriptMore(StudioPromptAssembler prompts, String genre, String tone, String kind, String input) {
        return scriptMore(prompts, genre, tone, kind, false, input);
    }

    public static Text scriptMore(StudioPromptAssembler prompts, String genre, String tone, String kind, boolean commerce, String input) {
        return text(prompts, StudioPromptCallPoints.DIRECTOR_SCRIPT_MORE, withCommerce(formMethods(genre, tone, kind), COMMERCE_SCRIPT, commerce), java.util.Map.of("input", input));
    }

    // 带货短剧的内容方法：只有开关打开且作品里有商品才拼，其余情况提示词逐字不变（DirectorPromptStageParityTest）。
    static final String COMMERCE_SCRIPT = "director-commerce-script", COMMERCE_BRIEF = "director-commerce-brief", COMMERCE_EXTRACT = "director-commerce-extract",
            COMMERCE_STORYBOARD = "director-commerce-storyboard", COMMERCE_ASSISTANT = "director-commerce-assistant";

    static List<String> withCommerce(List<String> methods, String method, boolean commerce) {
        if (!commerce) return methods;
        List<String> out = new ArrayList<>(methods);
        out.add(method);
        return out;
    }

    private static List<String> formMethods(String genre, String tone, String kind) {
        List<String> out = new ArrayList<>(scriptMethods(genre, tone));
        if ("long".equals(kind)) out.add("director-form-long");
        if ("single".equals(kind)) out.add("director-form-single");
        return out;
    }

    public static Text split(StudioPromptAssembler prompts, String input) {
        return text(prompts, StudioPromptCallPoints.DIRECTOR_SPLIT, List.of(), java.util.Map.of("input", input));
    }

    public static Text extract(StudioPromptAssembler prompts, String input) {
        return extract(prompts, false, input);
    }

    public static Text extract(StudioPromptAssembler prompts, boolean commerce, String input) {
        return text(prompts, StudioPromptCallPoints.DIRECTOR_EXTRACT, withCommerce(List.of(), COMMERCE_EXTRACT, commerce), java.util.Map.of("input", input));
    }

    /**
     * 写分镜脚本（写实向竖屏短剧分镜师）。时长和镜头数按所选视频模型的上限算（上限前 3 秒到上限，h3 即 12–15 秒）；
     * 只按首帧出片的模型一段一个镜头。
     */
    public static Text plan(StudioPromptAssembler prompts, int minSec, int maxSec, int maxShots, String input) {
        return storyboard(prompts, minSec, maxSec, maxShots, false, false, input);
    }

    public static Text plan(StudioPromptAssembler prompts, int minSec, int maxSec, int maxShots, boolean commerce, String input) {
        return storyboard(prompts, minSec, maxSec, maxShots, false, commerce, input);
    }

    /**
     * 重写指定片段的分镜脚本（2026-10-27）：本集的片段划分不变，只换这些片段的镜头，连同标题、摘要、关联资产。
     * 和 {@link #plan} 是同一个环节，「拆分与引用规则」换成「重写范围」，输出带上片段 id。
     */
    public static Text reshoot(StudioPromptAssembler prompts, int minSec, int maxSec, int maxShots, String input) {
        return storyboard(prompts, minSec, maxSec, maxShots, true, false, input);
    }

    public static Text reshoot(StudioPromptAssembler prompts, int minSec, int maxSec, int maxShots, boolean commerce, String input) {
        return storyboard(prompts, minSec, maxSec, maxShots, true, commerce, input);
    }

    private static Text storyboard(StudioPromptAssembler prompts, int minSec, int maxSec, int maxShots, boolean reshoot, boolean commerce, String input) {
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("input", input);
        vars.put("minSec", minSec);
        vars.put("maxSec", maxSec);
        vars.put("maxShots", maxShots);
        vars.put("lo", Math.max(minSec, maxSec - 3));
        vars.put("shotsLo", Math.min(3, maxShots));
        vars.put("single", maxShots == 1);
        vars.put("reshoot", reshoot);
        return text(prompts, StudioPromptCallPoints.DIRECTOR_STORYBOARD, withCommerce(List.of(), COMMERCE_STORYBOARD, commerce), vars);
    }

    // ── 输出校验（worker 内执行）─────────────────────────────────────────────

    public static JsonNode validate(ObjectMapper om, JsonNode meta, JsonNode out) {
        if (out == null || !out.isObject()) throw bad("模型返回格式有误");
        return switch (meta.path("task").asText()) {
            case "script" -> validateScript(om, out);
            case "script-more" -> validateScriptMore(om, out);
            case "split" -> validateSplit(om, meta, out);
            case "extract" -> validateExtract(om, meta, out);
            case "plan" -> validatePlan(om, meta, out);
            case "reshoot" -> validateReshoot(om, meta, out);
            case "videoPrompt" -> com.aistareco.aep.ipstudio.h3.H3PromptRewrite.validate(om, meta, out);
            case "assistant" -> DirectorAssistant.validate(om, meta, out);
            case "brief" -> DirectorAssistant.validateBrief(om, meta, out);
            default -> throw bad("未知的导演台任务");
        };
    }

    private static JsonNode validateScriptMore(ObjectMapper om, JsonNode out) {
        String content = withoutEpisodeEndNotes(text(out, "content"));
        if (content.isBlank()) throw bad("模型未返回剧本正文");
        return om.createObjectNode().put("content", content);
    }

    /** 模型照样会写「（第3集 完）」（2026-11-05 提示词里写了不要也没用）：这不是剧本内容，写入前去掉。 */
    static String withoutEpisodeEndNotes(String content) {
        return EPISODE_END_LINE.matcher(content).replaceAll("").strip();
    }
    private static final Pattern EPISODE_END_LINE = Pattern.compile("(?m)^[ \\t]*[（(【\\[]?[ \\t]*第[ \\t]*[0-9０-９零〇一二两三四五六七八九十百]+[ \\t]*集[ \\t·：:—–-]*(完|终|结束)[ \\t]*[）)】\\]]?[ \\t]*(?:\\r?\\n|\\z)");

    private static JsonNode validateScript(ObjectMapper om, JsonNode out) {
        String content = withoutEpisodeEndNotes(text(out, "content"));
        if (content.isBlank()) throw bad("模型未返回剧本正文");
        ObjectNode r = om.createObjectNode().put("title", clip(text(out, "title"), 60)).put("logline", clip(text(out, "logline"), 200))
                .put("content", content);
        // 故事大纲是附带的：缺了或不完整不判失败，有什么存什么。
        JsonNode o = out.path("outline");
        if (o.isObject()) {
            ObjectNode outline = r.putObject("outline");
            for (String f : List.of("world", "plot", "reversals", "theme")) outline.put(f, clip(text(o, f), 2000));
            ArrayNode people = outline.putArray("characters");
            for (JsonNode p : o.path("characters")) {
                String name = clip(text(p, "name"), 40);
                if (name.isEmpty() || people.size() >= 8) continue;
                ObjectNode person = people.addObject().put("name", name);
                for (String f : List.of("age", "identity", "secret", "flaw", "arc")) person.put(f, clip(text(p, f), 400));
            }
        }
        return r;
    }

    /**
     * 分集结果只认每集的起点，区间由程序按起点首尾相接地构造，结构上不会漏段或重叠。
     * 2026-10-25 线上两单：模型五个起点都对、最后一集的结尾少写了一段（《食神》）；
     * 剧本前面是设定资料、模型从第一个「第1集」标题开始分（《谁让这个睁眼瞎修仙的》）——以前都被判失败。
     *
     * <p>输出 {@code bodyStart} 之前的段落是设定资料（模型没写就以第一集起点为准）；写了 bodyStart 但第一集更晚开始，
     * 中间几段并入第一集（{@code headFrom} 记下原来的起点）。越界的起点丢掉、重复的合并，都记数给用户看；
     * 只有一个有效起点都没有才判失败。
     */
    private static JsonNode validateSplit(ObjectMapper om, JsonNode meta, JsonNode out) {
        int count = meta.path("paragraphCount").asInt();
        JsonNode episodes = out.path("episodes");
        if (count <= 0 || !episodes.isArray() || episodes.isEmpty()) throw bad("模型未返回分集");
        TreeMap<Integer, JsonNode> starts = new TreeMap<>();
        int dropped = 0, duplicates = 0;
        for (JsonNode e : episodes) {
            int start = intOr(e.path("startParagraph"), -1);
            if (start < 0 || start >= count) { dropped++; continue; }
            if (starts.putIfAbsent(start, e) != null) duplicates++;
        }
        if (starts.isEmpty()) throw bad("分集结果没有有效的分集位置");
        int first = starts.firstKey();
        int bodyStart = intOr(out.path("bodyStart"), -1);
        if (bodyStart < 0 || bodyStart > first) bodyStart = first;
        List<Integer> keys = new ArrayList<>(starts.keySet());
        ArrayNode result = om.createArrayNode();
        for (int i = 0; i < keys.size(); i++) {
            JsonNode e = starts.get(keys.get(i));
            int start = i == 0 ? bodyStart : keys.get(i);
            int end = i + 1 < keys.size() ? keys.get(i + 1) - 1 : count - 1;
            result.addObject().put("title", clip(text(e, "title"), 60)).put("summary", clip(text(e, "summary"), 400))
                    .put("startParagraph", start).put("endParagraph", end).put("modelEnd", intOr(e.path("endParagraph"), -1));
        }
        ObjectNode r = om.createObjectNode().put("bodyStart", bodyStart).put("headFrom", first)
                .put("dropped", dropped).put("duplicates", duplicates);
        r.set("episodes", result);
        return r;
    }

    private static int intOr(JsonNode n, int fallback) {
        if (n.isIntegralNumber()) return n.asInt();
        if (n.isTextual()) try { return Integer.parseInt(n.asText().trim()); } catch (NumberFormatException e) { return fallback; }
        return fallback;
    }

    /**
     * 分集标题：段首的「第N集」或「E01 / EP1 / Ep.1 / Episode 1」（可带 #、** 加粗或【】），N 是阿拉伯或中文数字；太长的段落是正文，不算标题。
     * 2026-11-03 线上《我的十年》：外面写好的 70 集剧本用「**E01 开机**」标集，只认「第N集」时整份交给模型，按幕拆成了 7 集。
     * 「E01-E24」「E21/E22」这类编号范围不是标题。
     */
    private static final Pattern EPISODE_HEADING = Pattern.compile(
            "^[#*\\s]*[【\\[（(]?\\s*(?:第\\s*([0-9０-９]+|[零〇一二两三四五六七八九十百]+)\\s*集"
                    + "|(?:Episode|EPISODE|episode|EP|Ep|ep|E)\\s*\\.?\\s*([0-9０-９]+)(?![0-9０-９A-Za-z\\-–—~～/／、,，至到]))");
    private static final int HEADING_MAX_CHARS = 40;
    /**
     * 标题后面紧跟分隔符（空格、书名号、冒号、斜杠…）时，标题行放宽到这么长：双语剧本写成
     * 「第十集《钱快没了，兄弟自然也快没了》 / Episode 10 — When the Money…」，超过 40 字，一行认不出整组编号就断了（2026-11-03 线上样本）。
     * 正文「第1集里他……」后面跟的是字，不放宽。
     */
    private static final int LONG_HEADING_MAX_CHARS = 120;
    private static final Pattern EPISODE_END = Pattern.compile("^[\\s·：:—–-]*(完|终|结束|end)\\b?[\\s）)】\\]。.]*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern AFTER_HEADING = Pattern.compile("^(?:$|[\\s《【「『〔（(\\[：:·、—–\\-/／|｜*~～,，.。])");

    private static boolean headingLength(String paragraph, String rest) {
        return paragraph.length() <= HEADING_MAX_CHARS || paragraph.length() <= LONG_HEADING_MAX_CHARS && AFTER_HEADING.matcher(rest).find();
    }

    /**
     * 剧本里已经标好的分集：最后一组从「第1集」开始、编号逐个加一的标题，返回每个标题所在的段落（就是每集的起点）。
     * 取最后一组，是因为前面的设定资料里常有一份「第1集…第2集…」的分集大纲；编号断了、乱了或不到 2 集，返回空，交给模型拆。
     */
    public static List<Integer> headingStarts(List<String> paragraphs) {
        List<int[]> found = new ArrayList<>();
        for (int i = 0; i < paragraphs.size(); i++) {
            String p = paragraphs.get(i);
            if (p.length() > LONG_HEADING_MAX_CHARS) continue;
            Matcher m = EPISODE_HEADING.matcher(p);
            if (!m.find() || !headingLength(p, p.substring(m.end()))) continue;
            int no = number(m.group(1) != null ? m.group(1) : m.group(2));
            // 「（第3集 完）」这样的收尾行不是新一集（2026-11-05 模型真这么写，编号一断整份认不出）。
            if (no > 0 && !EPISODE_END.matcher(p.substring(m.end())).find()) found.add(new int[]{i, no});
        }
        int from = -1;
        for (int j = found.size() - 1; j >= 0; j--) if (found.get(j)[1] == 1) { from = j; break; }
        if (from < 0) return List.of();
        List<Integer> out = new ArrayList<>();
        for (int j = from; j < found.size(); j++) {
            if (found.get(j)[1] != out.size() + 1) return List.of();
            out.add(found.get(j)[0]);
        }
        return out.size() >= 2 ? out : List.of();
    }

    /** 接着写的内容里的分集标题：从第 first 集开始、编号逐个加一；对不上返回空，整段算一集。 */
    public static List<Integer> headingsFrom(List<String> paragraphs, int first) {
        List<Integer> out = new ArrayList<>();
        for (int i = 0; i < paragraphs.size(); i++) {
            String p = paragraphs.get(i);
            if (p.length() > LONG_HEADING_MAX_CHARS) continue;
            Matcher m = EPISODE_HEADING.matcher(p);
            if (!m.find() || !headingLength(p, p.substring(m.end())) || EPISODE_END.matcher(p.substring(m.end())).find()) continue;
            if (number(m.group(1) != null ? m.group(1) : m.group(2)) != first + out.size()) return List.of();
            out.add(i);
        }
        return out;
    }

    /** 用户照抄的第一集标题开头最多这么多字（只用到编号和它后面一个字，整行粘进来也行）。 */
    public static final int MARKER_MAX_CHARS = 60;
    private static final int MARKER_HEADING_MAX_CHARS = 60;
    /** 段首的 Markdown 标记（#、** 加粗、列表的空格）和左括号，比对标题开头前先去掉。 */
    private static final Pattern HEADING_DECOR = Pattern.compile("^[#*\\s【\\[（(]+");
    private static final String NUMBER = "[0-9０-９]+|[零〇一二两三四五六七八九十百]+";
    private static final Pattern MARKER_NUMBER = Pattern.compile(NUMBER);

    /**
     * 按用户照抄的第一集标题开头分集（程序认不出写法时，拆分前先问「按标题分还是交给 AI」，2026-11-03 起）。
     * <ul>
     *   <li>带编号（「1 不想打工了」「Chapter 1」「第1章」）：编号前的字原样比对，编号换成任意数字，编号后面那个字（空格算一类）也要一样；
     *       从用户写的那个编号起逐个加一，取最长的一组。线上样本「1 不想打工了 约100秒」「2 五五分账」没有共同的开头，只能这样认；
     *       「20集数」「2014-2016时间」这类设定资料因为编号后面的字不同、或编号接不上而不算。</li>
     *   <li>不带编号（「场次」「Chapter」）：以它开头的行都算一集的起点，不要求编号。</li>
     * </ul>
     * 都先去掉段首的 Markdown 标记，英文不分大小写；标题行超过 60 字时，编号后面要紧跟分隔符才算（正文不算）。结果照样先给用户确认。
     */
    public static List<Integer> markerStarts(List<String> paragraphs, String marker) {
        String m = HEADING_DECOR.matcher(marker == null ? "" : marker.strip()).replaceFirst("");
        if (m.isEmpty()) return List.of();
        Matcher nm = MARKER_NUMBER.matcher(m);
        if (!nm.find()) {
            List<Integer> out = new ArrayList<>();
            for (int i = 0; i < paragraphs.size(); i++) {
                String p = paragraphs.get(i);
                if (p.length() > MARKER_HEADING_MAX_CHARS) continue;
                String t = HEADING_DECOR.matcher(p).replaceFirst("");
                if (t.regionMatches(true, 0, m, 0, m.length())) out.add(i);
            }
            return out;
        }
        int first = number(nm.group());
        String after = m.substring(nm.end());
        String sep = after.isEmpty() ? "" : after.substring(0, after.offsetByCodePoints(0, 1));
        Pattern head = Pattern.compile("^" + Pattern.quote(m.substring(0, nm.start())) + "\\s*(" + NUMBER + ")",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        List<int[]> found = new ArrayList<>();
        for (int i = 0; i < paragraphs.size(); i++) {
            String p = paragraphs.get(i);
            if (p.length() > LONG_HEADING_MAX_CHARS) continue;
            String t = HEADING_DECOR.matcher(p).replaceFirst("");
            Matcher hm = head.matcher(t);
            if (!hm.find()) continue;
            String rest = t.substring(hm.end()), tail;
            if (sep.isEmpty()) tail = rest;
            else if (sep.isBlank()) { if (!rest.isEmpty() && !Character.isWhitespace(rest.charAt(0))) continue; tail = rest.stripLeading(); }
            else { if (!rest.regionMatches(true, 0, sep, 0, sep.length())) continue; tail = rest.substring(sep.length()); }
            if (p.length() > MARKER_HEADING_MAX_CHARS && !AFTER_HEADING.matcher(tail).find()) continue;
            int no = number(hm.group(1));
            if (no > 0) found.add(new int[]{i, no});
        }
        // 从用户写的编号起逐个加一；中间夹着编号对不上的行（大纲里提到的集号之类）跳过，碰到又一个起始编号就是新的一组。取最长的，一样长取后面那组。
        List<Integer> best = List.of();
        for (int s = 0; s < found.size(); s++) {
            if (found.get(s)[1] != first) continue;
            List<Integer> run = new ArrayList<>(List.of(found.get(s)[0]));
            for (int j = s + 1, want = first + 1; j < found.size(); j++) {
                if (found.get(j)[1] == first) break;
                if (found.get(j)[1] == want) { run.add(found.get(j)[0]); want++; }
            }
            if (run.size() >= best.size()) best = run;
        }
        return best;
    }

    /** 用户自定标题那一行作集名：去掉 Markdown 标记，整行保留（标题开头往往就是集名的一部分，如「Chapter 3 回家」）。 */
    public static String markerTitle(String paragraph) {
        return clip(HEADING_DECOR.matcher(paragraph).replaceFirst("").replace("**", "").strip(), 60);
    }

    /** 一行是不是分集标题（「第1集 夜班」「# 第二集」）：给作品起名时要跳过它，它是集名不是剧名。 */
    public static boolean isEpisodeHeading(String line) {
        String t = line == null ? "" : line.trim();
        return !t.isEmpty() && t.length() <= HEADING_MAX_CHARS && EPISODE_HEADING.matcher(t).find();
    }

    /** 标题里「第N集」「E01」后面的集名（「# 第1集：下山」「**E01 开机**」→「下山」「开机」）；只有编号时返回空串，界面按「第 N 集」显示。 */
    public static String headingTitle(String paragraph) {
        Matcher m = EPISODE_HEADING.matcher(paragraph);
        String rest = m.find() ? paragraph.substring(m.end()) : paragraph;
        return clip(rest.replace("**", "").replaceAll("^[\\s:：】\\]）)·、\\-—]+", "").strip(), 60);
    }

    /** 「12」「１２」「十二」「一百零三」→ 数字；认不出返回 0。 */
    static int number(String s) {
        StringBuilder digits = new StringBuilder();
        for (char ch : s.toCharArray()) if (ch >= '０' && ch <= '９') digits.append((char) (ch - '０' + '0')); else if (Character.isDigit(ch)) digits.append(ch);
        if (digits.length() == s.length()) try { return Integer.parseInt(digits.toString()); } catch (NumberFormatException e) { return 0; }
        int total = 0, num = 0;
        for (char ch : s.toCharArray()) {
            int d = "零一二三四五六七八九".indexOf(ch);
            if (ch == '〇') d = 0;
            if (ch == '两') d = 2;
            if (d >= 0) num = d;
            else if (ch == '十') { total += (num == 0 ? 1 : num) * 10; num = 0; }
            else if (ch == '百') { total += (num == 0 ? 1 : num) * 100; num = 0; }
            else return 0;
        }
        return total + num;
    }

    private static final Set<String> KINDS = Set.of("character", "scene", "prop");

    private static JsonNode validateExtract(ObjectMapper om, JsonNode meta, JsonNode out) {
        Set<String> existing = strings(meta.path("existingIds"));
        Set<String> episodeNos = strings(meta.path("episodeNos"));
        JsonNode assets = out.path("assets");
        if (!assets.isArray()) throw bad("模型未返回资产列表");
        ArrayNode result = om.createArrayNode();
        for (JsonNode a : assets) {
            String kind = text(a, "kind"), name = clip(text(a, "name"), 40);
            String existingId = text(a, "existingId");
            // 商品只来自商品库：只有对上作品里已有的商品才算数，模型不能新建商品（docs/ai-director-commerce-plan.md §5）。
            boolean product = "product".equals(kind) && existing.contains(existingId);
            if (!(KINDS.contains(kind) || product) || name.isEmpty()) continue;
            ObjectNode item = result.addObject();
            item.put("existingId", existing.contains(existingId) ? existingId : null);
            item.put("kind", kind).put("name", name).put("description", clip(text(a, "description"), 2000));
            ArrayNode aliases = item.putArray("aliases");
            a.path("aliases").forEach(x -> { if (!x.asText().isBlank() && aliases.size() < 6) aliases.add(clip(x.asText(), 40)); });
            ArrayNode nos = item.putArray("episodeNos");
            a.path("episodeNos").forEach(x -> { if (episodeNos.contains(x.asText())) nos.add(x.asInt()); });
            if ("character".equals(kind) && a.path("forms").isArray()) {
                ArrayNode forms = item.putArray("forms");
                Set<String> seenForms = new HashSet<>();
                for (JsonNode f : a.path("forms")) {
                    String form = clip(text(f, "name"), 20);
                    if (form.isEmpty() || !seenForms.add(form) || forms.size() >= 6) continue;
                    forms.addObject().put("name", form).put("description", clip(text(f, "description"), 1000));
                }
                if (forms.isEmpty()) item.remove("forms");
            }
        }
        if (result.isEmpty()) throw bad("未提取到可用的角色、场景或道具");
        ObjectNode r = om.createObjectNode();
        r.set("assets", result);
        return r;
    }

    /**
     * 只做结构校验，内容原样保留：镜头数、时长、未知资产与说话人都不在这里改。
     * 超出分镜板格数、超出视频模型时长、引用对不上的问题由 DirectorService 在片段上标成「需要修改」，
     * 阻止这一段出图，用户就地修改或重新规划后自动消失 —— 不靠丢镜头、压时长、改成旁白去满足合同。
     */
    private static JsonNode validatePlan(ObjectMapper om, JsonNode meta, JsonNode out) {
        JsonNode clips = out.path("clips");
        if (!clips.isArray() || clips.isEmpty()) throw bad("模型未返回片段");
        ArrayNode result = om.createArrayNode();
        for (JsonNode c : clips) plannedClip(result.addObject(), c);
        ObjectNode r = om.createObjectNode();
        r.set("clips", result);
        return r;
    }

    /**
     * 重写片段：rewriteIds 里的每个片段都要有且只有一项；不在范围内的片段忽略，不写进作品。
     * 每段的结构校验与写分镜脚本相同（{@link #plannedClip}）。
     */
    private static JsonNode validateReshoot(ObjectMapper om, JsonNode meta, JsonNode out) {
        JsonNode clips = out.path("clips");
        if (!clips.isArray() || clips.isEmpty()) throw bad("模型未返回片段");
        Set<String> wanted = new java.util.LinkedHashSet<>();
        meta.path("rewriteIds").forEach(x -> wanted.add(x.asText()));
        ArrayNode result = om.createArrayNode();
        Set<String> seen = new HashSet<>();
        for (JsonNode c : clips) {
            String id = text(c, "id");
            if (!wanted.contains(id)) continue;
            if (!seen.add(id)) throw bad("模型把同一个片段写了两遍");
            plannedClip(result.addObject().put("id", id), c);
        }
        if (seen.size() < wanted.size()) throw bad("模型漏写了要重写的片段");
        ObjectNode r = om.createObjectNode();
        r.set("clips", result);
        return r;
    }

    private static void plannedClip(ObjectNode clip, JsonNode c) {
        JsonNode shots = c.path("shots");
        if (!shots.isArray() || shots.isEmpty()) throw bad("部分片段缺少镜头");
        clip.put("title", clip(text(c, "title"), 40)).put("summary", clip(text(c, "summary"), 400))
                .put("sourceQuote", clip(text(c, "sourceQuote"), 60));
        ArrayNode ids = clip.putArray("assetIds");
        Set<String> seen = new HashSet<>();
        for (JsonNode id : c.path("assetIds")) if (!id.asText().isBlank() && seen.add(id.asText())) ids.add(clip(id.asText(), 40));
        if (c.path("assetForms").isObject() && !c.path("assetForms").isEmpty()) clip.set("assetForms", c.path("assetForms").deepCopy());
        ArrayNode outShots = clip.putArray("shots");
        for (JsonNode s : shots) {
            double d = s.path("durationSec").asDouble(0);
            if (!(d > 0)) throw bad("部分镜头缺少时长");
            ObjectNode shot = outShots.addObject();
            shot.put("durationSec", d).put("size", clip(text(s, "size"), 20)).put("camera", clip(text(s, "camera"), 200))
                    .put("action", clip(text(s, "action"), 400)).put("still", clip(text(s, "still"), 300));
            // 写错或写 main 都按主视图，不判失败：视角只是选哪张参考图。
            if (DirectorSceneViews.LABELS.containsKey(text(s, "sceneView"))) shot.put("sceneView", text(s, "sceneView"));
            ArrayNode dialogue = shot.putArray("dialogue");
            for (JsonNode line : s.path("dialogue")) {
                String t = text(line, "text");
                if (t.isEmpty()) continue;
                String speaker = text(line, "speakerId");
                ObjectNode l = dialogue.addObject();
                if (speaker.isEmpty()) l.putNull("speakerId"); else l.put("speakerId", clip(speaker, 40));
                l.put("text", t);
            }
        }
    }

    // ── 媒体提示词模板（按已采用内容编译，不调用模型）───────────────────────

    public record Ref(String label, String kind, String name) {}

    /**
     * 出图提示词（角色 / 场景 / 道具参考图与分镜图）的版本号：候选上记了它，才按当前模板核对；没记的是之前生成的，
     * 按 {@link #legacyAssetPrompt} / {@link #legacyBoardPrompt} 核对，换模板本身不算「提示词已修改」（同 {@link #VIDEO_PROMPT_FORMAT}）。
     * 2：2026-10-28 加入演员布光、中性白平衡与肤色还原。用户反馈 H3 成片人物普遍脸黑、发黄；视频照着分镜图和参考图生成，
     * 判断偏色主要从这几张图带进去，所以从源头改起；视频再照已确认分镜图的受光和色调（{@link #VIDEO_PROMPT_FORMAT} 3）。这是按反馈定的方向，没有拿样片核对过根因，效果也还没有用真实出图对比过。
     * 3：同日第二轮 review 后改成一段默认布光指导，不再按关键词推断特殊布光、追加「不补光」；
     *    宫格一致性改成「明暗和光色只随画面描述变化」。第 2 版已上线出过图，按 {@link #assetPromptV2} / {@link #boardPromptV2} 核对。
     * 第 3 版之后模板进了提示词库（stage-director-asset-image / stage-director-board，第 3 版即库里的 v1）：
     * 候选记 promptVersions，后台发了新版本也按候选记的那一版核对，不再在这里加版本号和手写旧版。
     */
    public static final int IMAGE_PROMPT_FORMAT = 3;

    /** 真人实拍类风格才写皮肤质感、气色这些真人规则；动画、水墨等风格只要求受光清楚、配色干净。风格是用户随手填的字，按关键词判断。 */
    static boolean liveAction(String style) {
        return style.matches(".*(真人|写实|实拍|影视|电影).*")
                && !style.matches(".*(动画|动漫|二次元|卡通|漫画|插画|水墨|手绘|像素|黏土|3D|三维|Q版|绘本).*");
    }

    static String kindLabel(String kind) {
        return switch (kind) { case "scene" -> "场景"; case "prop" -> "道具"; case "product" -> "商品"; default -> "角色"; };
    }

    /**
     * 资产参考图（角色设定集 / 场景空间图 / 道具单件图）的出图描述，正文在提示词库 stage-director-asset-image。
     * version 为 null 用当前版本，否则按那一版编（核对那一版生成的图）；库里没有这个环节（被停用）时返回 null，调用方保留原来的描述。
     */
    public static String assetPrompt(StudioPromptAssembler prompts, JsonNode settings, JsonNode asset, Integer version) {
        String style = settings.path("style").asText("真人写实");
        String kind = asset.path("kind").asText();
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("style", style);
        vars.put("name", asset.path("name").asText());
        vars.put("description", asset.path("description").asText());
        vars.put("live", liveAction(style));
        vars.put("isScene", "scene".equals(kind));
        vars.put("isProp", "prop".equals(kind));
        vars.put("isCharacter", !"scene".equals(kind) && !"prop".equals(kind));
        return media(prompts, StudioPromptCallPoints.DIRECTOR_ASSET_IMAGE, vars, version);
    }

    /** 布局：1 个镜头出单张，2–4 个镜头出 2×2（格子与整板同比例）。 */
    public static int[] boardLayout(int shots) {
        return shots <= 1 ? new int[]{1, 1} : new int[]{2, 2};
    }

    private static final String[] CELL_NAMES = {"左上", "右上", "左下", "右下"};

    /** 分镜图的出图描述（1 个镜头出单张，2–4 个镜头出 2×2），正文在提示词库 stage-director-board；version 同 {@link #assetPrompt}。 */
    public static String boardPrompt(StudioPromptAssembler prompts, JsonNode settings, JsonNode clip, List<Ref> refs, Integer version) {
        String style = settings.path("style").asText("真人写实");
        JsonNode shots = clip.path("shots");
        boolean single = boardLayout(shots.size())[0] == 1;
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("style", style);
        vars.put("aspect", settings.path("aspectRatio").asText("9:16"));
        vars.put("single", single);
        vars.put("live", liveAction(style));
        List<java.util.Map<String, Object>> rs = new ArrayList<>();
        for (Ref r : refs) rs.add(java.util.Map.of("label", r.label(), "name", r.name(), "isScene", "scene".equals(r.kind()), "isProp", "prop".equals(r.kind()),
                "isProduct", "product".equals(r.kind()),
                "isCharacter", !"scene".equals(r.kind()) && !"prop".equals(r.kind()) && !"product".equals(r.kind())));
        vars.put("refs", rs);
        vars.put("hasRefs", !refs.isEmpty());
        vars.put("hasProduct", refs.stream().anyMatch(r -> "product".equals(r.kind())));
        List<java.util.Map<String, Object>> cells = new ArrayList<>();
        for (int i = 0; i < shots.size() && i < MAX_SHOTS; i++) {
            JsonNode sh = shots.get(i);
            cells.add(java.util.Map.of("position", CELL_NAMES[i], "size", sh.path("size").asText(), "camera", sh.path("camera").asText(), "still", sh.path("still").asText() + viewHint(sh, refs)));
        }
        vars.put("cells", cells);
        vars.put("blanks", !single && shots.size() < 4);
        return media(prompts, StudioPromptCallPoints.DIRECTOR_BOARD, vars, version);
    }

    /** 这一镜要用场景的哪张视角图：只交代素材编号，没用视角的镜头一个字都不多（旧片段的提示词不变、不会被标「需更新」）。 */
    private static String viewHint(JsonNode shot, List<Ref> refs) {
        String label = DirectorSceneViews.LABELS.get(shot.path("sceneView").asText(""));
        if (label == null) return "";
        for (Ref r : refs) if ("scene".equals(r.kind()) && r.name().endsWith("·" + label)) return "（背景照" + r.label() + "）";
        return "";
    }

    /** 场景其他视角的 2×2 整图（stage-director-scene-views）；version 同 {@link #assetPrompt}。库里没有返回 null。 */
    public static String sceneViewsPrompt(StudioPromptAssembler prompts, JsonNode settings, JsonNode asset, Integer version) {
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("style", settings.path("style").asText("真人写实"));
        vars.put("name", asset.path("name").asText());
        vars.put("description", asset.path("description").asText());
        return media(prompts, StudioPromptCallPoints.DIRECTOR_SCENE_VIEWS, vars, version);
    }

    /** 画角色另一形态时追加的说明：图1 是主形象。 */
    public static String formNotes(StudioPromptAssembler prompts, String formName, String baseOnLabel) {
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("refScene", false); vars.put("refProp", false); vars.put("refCharacter", false);
        vars.put("form", formName);
        vars.put("baseOn", baseOnLabel == null ? "" : baseOnLabel);
        prompts.requireStage(StudioPromptCallPoints.DIRECTOR_IMAGE_NOTES);
        return media(prompts, StudioPromptCallPoints.DIRECTOR_IMAGE_NOTES, vars, null);
    }

    /**
     * 追加在出图描述后面的说明（stage-director-image-notes）：refKind 是用户参考图所属资产的类型（没有就 null），
     * baseOnLabel 是「在当前图上修改」时当前图的编号（没有就 null）。用户手改过的描述也照样追加；两样都没有返回空串。
     */
    public static String imageNotes(StudioPromptAssembler prompts, String refKind, String baseOnLabel) {
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("refScene", "scene".equals(refKind));
        vars.put("refProp", "prop".equals(refKind));
        vars.put("refCharacter", refKind != null && !"scene".equals(refKind) && !"prop".equals(refKind));
        vars.put("baseOn", baseOnLabel == null ? "" : baseOnLabel);
        if (refKind == null && baseOnLabel == null) return "";
        prompts.requireStage(StudioPromptCallPoints.DIRECTOR_IMAGE_NOTES);
        return media(prompts, StudioPromptCallPoints.DIRECTOR_IMAGE_NOTES, vars, null);
    }

    /** 这个环节现在的版本（生成时记进候选，之后按它核对）；库里没有返回 0。 */
    public static int templateVersion(StudioPromptAssembler prompts, String stage) {
        return prompts.library().find(stage).map(com.aistareco.aep.ipstudio.prompt.StudioPromptEntry::version).orElse(0);
    }

    private static String media(StudioPromptAssembler prompts, String stage, java.util.Map<String, Object> vars, Integer version) {
        if (version == null && prompts.library().find(stage).filter(e -> !e.withdrawn()).isEmpty()) return null;
        try {
            return prompts.assemble(StudioPromptAssembler.Call.of(stage, vars, version == null ? null : java.util.Map.of(stage, version), null)).user();
        } catch (IllegalStateException missingVersion) {
            return null; // 库里找不到候选记的那一版：没法按那一版核对，按当前版本比
        }
    }

    /** 声音参考：audio 是本次请求里的编号（音频1、音频2…），只绑定在说话的角色上。 */
    public record VoiceRef(String label, String name) {}

    /**
     * 视频提示词的版本号：候选上记了它，按那一版的模板核对；没记的是第 1 版（{@link #legacyVideoPrompt}）。
     * 2：2026-10-26 改成中文 H3 结构（{@link #videoPromptV2}）。
     * 3：2026-10-28 分镜图同时交代人物受光、肤色和整体色调，场景图只交代空间和光源位置：分镜图按新布光规则改好之后，
     *    视频不能再从场景图重新取光线（review 发现第 2 版写着「分镜只参考构图」「场景光线照参考图」）。
     * 4：2026-10-31 去掉写给系统看的说明，只留画面里有什么、谁说什么、谁照哪张图（第 3 版见 {@link #videoPromptV3}）；
     *    出镜按名字和别名认，分不清画内画外时不写强约束（{@link #castOfShot}）。
     *    起因：《扣钱》cl45 优化稿超长、按中文原文出片，成片末尾在只有一双手的镜头里多出约 4 秒人声，两个转写模型都听出「没有声音」，
     *    对上的是「餐馆老板 没有声音参考，按人物身份自然配音。」；A/B 实测里 F3 也把「陈默的设定图」念了出来
     *    （docs/audits/director-h3-video-prompt-ab-2026-10.md §6）。同一段第三镜，资产叫「餐馆老板」、分镜写「老板」，
     *    旧判断认不出他在画面里，写成「画面里只有静儿」「老板在画外说」，与分镜图上老板出镜正好相反。
     */
    public static final int VIDEO_PROMPT_FORMAT = 4;

    private static final String[] CELL_ORDER = {"左上格", "右上格", "左下格", "右下格"};

    /**
     * 视频提示词（中文，用户看到、能改的就是这一份）。写法照 H3 官方提示词指南，2026-10-26 用《敦煌飞仙》「飞仙之眼」对比实测：
     * 旧写法两条在两人同框的第 1 镜都出了事（一条穿模、一条把宫格原样拍进画面），按这个结构写的两条都没有
     * （见 docs/audits/director-h3-video-prompt-ab-2026-10.md）。
     * <ul>
     *   <li>【人物】每个角色对应哪张参考图，参考图里的人像都是同一个人；</li>
     *   <li>【分镜参考】宫格每格对应哪一镜、只取构图机位和人物位置 —— 不写「禁止出现格线」这类否定句，H3 没有负面提示词，旧写法写了照样拍出宫格；</li>
     *   <li>【画面】逐镜：景别机位、画面、动作；只有一个角色时写明「画面里只有」；台词写进说话的那一句，
     *       说话人不在画面里就写画外，听的人嘴闭着；最后一镜写收尾；</li>
     *   <li>【声音】【配乐】：配乐写无，整集拼起来不会每段一首曲子。</li>
     * </ul>
     * 画幅、时长走请求参数，不写进提示词。以「声音参考：」开头的行是指纹比对时要忽略的声音行（见 DirectorService#withoutVoiceLines），措辞别改。
     *
     * <p>中文原文会整段交给 H3（优化稿超长、改写失败或用户选了按原文生成时），H3 分不清哪些中文是要念的，
     * 所以这里只写画面里有什么、谁说什么、谁照哪张图、谁的声音照哪段音频；参考图「是什么」「怎么用」的解释、
     * 「没有声音参考」「只说引号里的台词」这类写给系统看的规则一律不写。改写需要的参考说明另由 {@code DirectorService#rewrite} 用英文交给改写模型。
     *
     * @param aliases 角色名 → 资产别名（如「餐馆老板」→「老板」），用来认这一镜谁在画面里
     */
    public static String videoPrompt(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames,
                                     List<VoiceRef> voices, List<String> unvoiced, java.util.Map<String, String> voiceDescs,
                                     java.util.Map<String, List<String>> aliases) {
        return videoPrompt(settings, clip, refs, speakerNames, voices, unvoiced, voiceDescs, aliases, MAX_SHOTS);
    }

    /**
     * @param maxShots 这一段最多几镜。导演台一段一张分镜图（4 镜）；AI 视频页的长视频一段可以到 30 秒，配两张分镜图（8 镜），
     *                 此时参考图1、参考图2 是这两张分镜（docs/studio-segmented-video.md）。不超过 4 镜时写法和导演台一字不差。
     */
    public static String videoPrompt(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames,
                                     List<VoiceRef> voices, List<String> unvoiced, java.util.Map<String, String> voiceDescs,
                                     java.util.Map<String, List<String>> aliases, int maxShots) {
        String style = settings.path("style").asText("真人写实");
        JsonNode shots = clip.path("shots");
        int n = Math.min(shots.size(), maxShots);
        boolean grid = boardLayout(shots.size())[0] == 2;
        List<String> characters = new ArrayList<>();
        StringBuilder people = new StringBuilder();
        for (Ref r : refs) {
            switch (r.kind()) {
                case "scene" -> people.append("场景「").append(r.name()).append("」：空间布局和光源位置照参考").append(r.label()).append("。\n");
                case "prop" -> people.append("道具「").append(r.name()).append("」：外观照参考").append(r.label()).append("。\n");
                case "product" -> people.append("商品「").append(r.name()).append("」：外观、包装和标签照参考").append(r.label()).append("。\n");
                default -> {
                    characters.add(r.name());
                    people.append(r.name()).append("：长相、发型和衣服照参考").append(r.label()).append("。\n");
                }
            }
        }
        if (!characters.isEmpty())
            people.append(String.join("和", characters)).append(characters.size() > 1 ? "在画面里各只出现一个" : "在画面里只出现一个")
                    .append("，长相和衣服从头到尾保持一致。\n");
        StringBuilder b = new StringBuilder();
        if (!people.isEmpty()) b.append("【人物】\n").append(people).append('\n');
        b.append("【分镜参考】\n");
        if (grid) {
            b.append("参考图1 是 2×2 分镜：");
            for (int i = 0; i < Math.min(n, MAX_SHOTS); i++) b.append(i > 0 ? "，" : "").append(CELL_ORDER[i]).append("对应第").append(i + 1).append("镜");
            if (n < 4) b.append("，其余格子是空的");
            if (n > MAX_SHOTS) {
                b.append("。参考图2 是 2×2 分镜：");
                for (int i = MAX_SHOTS; i < n; i++) b.append(i > MAX_SHOTS ? "，" : "").append(CELL_ORDER[i - MAX_SHOTS]).append("对应第").append(i + 1).append("镜");
                if (n < MAX_SHOTS * 2) b.append("，其余格子是空的");
            }
            b.append("。每格参考构图、机位和人物位置，人物的受光、肤色和画面整体色调也照对应的格子，每一镜都是一个完整的全屏画面。\n\n");
        } else {
            b.append("参考图1 是这一段的分镜画面，参考它的构图、机位和人物位置，人物的受光、肤色和画面整体色调也照它，视频是一个完整的全屏画面。\n\n");
        }
        b.append("【画面】\n").append(style).append("风格，画面里没有字幕。\n");
        boolean anyLine = false;
        double t = 0;
        for (int i = 0; i < n; i++) {
            JsonNode s = shots.get(i);
            double end = t + s.path("durationSec").asDouble();
            b.append("第").append(i + 1).append("镜（").append(i == 0 ? "0–" + fmt(end) + " 秒" : fmt(t) + " 秒切").append("）：");
            b.append(sentence(s.path("size").asText() + (s.path("camera").asText().isBlank() ? "" : "，" + s.path("camera").asText())));
            b.append(sentence(s.path("still").asText())).append(sentence(s.path("action").asText()));
            Cast cast = castOfShot(s, castPool(characters, s, speakerNames), aliases);
            if (cast.on().size() == 1 && cast.unsure().isEmpty()) b.append("画面里只有").append(cast.on().get(0)).append("。");
            Set<String> speaking = new HashSet<>();
            for (JsonNode line : s.path("dialogue")) {
                anyLine = true;
                String who = line.path("speakerId").isTextual() ? speakerNames.get(line.path("speakerId").asText()) : null;
                // 画外只在「画面里认出了别人、说话人一个称呼都没出现」时写；分不清的不写画内画外，也不要求谁闭嘴。
                boolean offscreen = who == null || !cast.on().contains(who) && !cast.unsure().contains(who) && !cast.on().isEmpty();
                if (who != null && cast.on().contains(who)) speaking.add(who);
                b.append(who == null ? "旁白" : who).append(offscreen ? "在画外说：「" : "说：「").append(line.path("text").asText()).append("」");
                b.append(offscreen && !cast.on().isEmpty() ? "画面里的人嘴闭着。" : "");
            }
            List<String> listeners = cast.on().stream().filter(who -> !speaking.contains(who)).toList();
            if (!speaking.isEmpty() && !listeners.isEmpty()) b.append(String.join("、", listeners)).append("听着，嘴闭着。");
            if (i == n - 1) b.append("最后保持这个画面到结束。");
            b.append('\n');
            t = end;
        }
        StringBuilder sound = new StringBuilder();
        if (!anyLine) sound.append("这一段没有对白。\n");
        for (VoiceRef v : voices) sound.append("声音参考：").append(v.name()).append("的音色、口音照").append(v.label()).append("。\n");
        voiceDescs.forEach((name, desc) -> sound.append(name).append("的音色：").append(desc).append("\n"));
        // 没内容就不写这一段：空标题也是一句可能被 H3 念出来的中文（cl45 第 4 版试跑时发现）。
        if (!sound.isEmpty()) b.append("\n【声音】\n").append(sound);
        b.append("\n【配乐】\n无");
        return b.toString();
    }

    /** 一镜里的出镜判断：{@code on} 明确在画面里，{@code unsure} 点了名但分不清画内画外（带画外线索词，或一个称呼对上几个人）。 */
    public record Cast(List<String> on, List<String> unsure) {}

    /** 名字出现在这些词的同一小句里，不能算出镜：「门外传来老板的声音」「静儿想起老板说过的话」。 */
    private static final Pattern OFFSCREEN_CUE = Pattern.compile("画外|门外|窗外|屏幕外|镜头外|画面外|电话|听筒|广播|喇叭|声音|喊声|传来|听见|听到|回想|想起|回忆|记得|梦里|脑海");

    /** 认人的范围：这一段关联了参考图的角色 + 这一镜开口的角色（说话人不一定有参考图）。 */
    static List<String> castPool(List<String> characters, JsonNode shot, java.util.Map<String, String> speakerNames) {
        List<String> pool = new ArrayList<>(characters);
        for (JsonNode line : shot.path("dialogue")) {
            String who = line.path("speakerId").isTextual() ? speakerNames.get(line.path("speakerId").asText()) : null;
            if (who != null && !pool.contains(who)) pool.add(who);
        }
        return pool;
    }

    /**
     * 这一镜谁在画面里：景别机位、画面、动作里按名字和别名认（长的先认，「林小雅」不会再被认成「小雅」，认过的字不再参与匹配）。
     * 一个称呼同时是几个人的名字或别名（如两人共用「面筋夫妻」）时不归给任何人，记作分不清；
     * 称呼所在的小句里有画外线索词时也记作分不清。按原有顺序返回。
     */
    static Cast castOfShot(JsonNode shot, List<String> pool, java.util.Map<String, List<String>> aliases) {
        String text = shot.path("camera").asText() + "\n" + shot.path("still").asText() + "\n" + shot.path("action").asText();
        java.util.Map<String, Set<String>> owners = new java.util.HashMap<>();
        for (String name : pool) {
            if (name.isBlank()) continue;
            owners.computeIfAbsent(name, k -> new java.util.LinkedHashSet<>()).add(name);
            for (String alias : aliases.getOrDefault(name, List.of()))
                if (alias != null && !alias.isBlank()) owners.computeIfAbsent(alias.strip(), k -> new java.util.LinkedHashSet<>()).add(name);
        }
        List<String> terms = new ArrayList<>(owners.keySet());
        terms.sort((a, c) -> c.length() - a.length());
        Set<String> on = new HashSet<>(), unsure = new HashSet<>();
        for (String term : terms) {
            int at = text.indexOf(term);
            if (at < 0) continue;
            Set<String> who = owners.get(term);
            boolean cue = false;
            for (; at >= 0; at = text.indexOf(term, at + term.length())) cue |= OFFSCREEN_CUE.matcher(clause(text, at, term.length())).find();
            if (who.size() > 1 || cue) unsure.addAll(who); else on.addAll(who);
            text = text.replace(term, "\u0000");
        }
        on.removeAll(unsure);
        return new Cast(pool.stream().filter(on::contains).toList(), pool.stream().filter(unsure::contains).toList());
    }

    /** 称呼所在的那一小句（按逗号、句号等断开）。 */
    private static String clause(String text, int at, int len) {
        int from = at, to = at + len;
        while (from > 0 && "，。；！？、,.;!?\n".indexOf(text.charAt(from - 1)) < 0) from--;
        while (to < text.length() && "，。；！？、,.;!?\n".indexOf(text.charAt(to)) < 0) to++;
        return text.substring(from, to);
    }

    /**
     * 第 3 版视频提示词（2026-10-28 至 2026-10-31），只用来核对第 3 版生成的视频，不要拿它生成新视频。
     * 它带着「参考图N 是X的设定图」「没有声音参考，按人物身份自然配音」「人物只说引号里的台词」这几句写给系统的话，出镜也只按全名认（{@link #castOf}）。
     */
    static String videoPromptV3(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames,
                                List<VoiceRef> voices, List<String> unvoiced, java.util.Map<String, String> voiceDescs) {
        String style = settings.path("style").asText("真人写实");
        JsonNode shots = clip.path("shots");
        int n = Math.min(shots.size(), MAX_SHOTS);
        boolean grid = boardLayout(shots.size())[0] == 2;
        List<String> characters = new ArrayList<>();
        StringBuilder people = new StringBuilder();
        for (Ref r : refs) {
            switch (r.kind()) {
                case "scene" -> people.append("场景「").append(r.name()).append("」：空间布局和光源位置照参考").append(r.label()).append("。\n");
                case "prop" -> people.append("道具「").append(r.name()).append("」：外观照参考").append(r.label()).append("。\n");
                default -> {
                    characters.add(r.name());
                    people.append(r.name()).append("：长相、发型和衣服都照参考").append(r.label()).append("。参考").append(r.label())
                            .append(" 是").append(r.name()).append("的设定图，图里的人像都是").append(r.name()).append("一个人。\n");
                }
            }
        }
        if (!characters.isEmpty())
            people.append(String.join("和", characters)).append(characters.size() > 1 ? "在画面里各只出现一个" : "在画面里只出现一个")
                    .append("，长相和衣服从头到尾保持一致。\n");
        StringBuilder b = new StringBuilder();
        if (!people.isEmpty()) b.append("【人物】\n").append(people).append('\n');
        b.append("【分镜参考】\n");
        if (grid) {
            b.append("参考图1 是 2×2 分镜：");
            for (int i = 0; i < n; i++) b.append(i > 0 ? "，" : "").append(CELL_ORDER[i]).append("对应第").append(i + 1).append("镜");
            if (n < 4) b.append("，其余格子是空的");
            b.append("。每格参考构图、机位和人物位置，人物的受光、肤色和画面整体色调也照对应的格子，每一镜都是一个完整的全屏画面。\n\n");
        } else {
            b.append("参考图1 是这一段的分镜画面，参考它的构图、机位和人物位置，人物的受光、肤色和画面整体色调也照它，视频是一个完整的全屏画面。\n\n");
        }
        b.append("【画面】\n").append(style).append("风格。\n");
        boolean anyLine = false;
        double t = 0;
        for (int i = 0; i < n; i++) {
            JsonNode s = shots.get(i);
            double end = t + s.path("durationSec").asDouble();
            b.append("第").append(i + 1).append("镜（").append(i == 0 ? "0–" + fmt(end) + " 秒" : fmt(t) + " 秒切").append("）：");
            b.append(sentence(s.path("size").asText() + (s.path("camera").asText().isBlank() ? "" : "，" + s.path("camera").asText())));
            b.append(sentence(s.path("still").asText())).append(sentence(s.path("action").asText()));
            List<String> cast = castOf(s, characters);
            if (cast.size() == 1) b.append("画面里只有").append(cast.get(0)).append("。");
            Set<String> speaking = new HashSet<>();
            for (JsonNode line : s.path("dialogue")) {
                anyLine = true;
                String who = line.path("speakerId").isTextual() ? speakerNames.get(line.path("speakerId").asText()) : null;
                boolean offscreen = who == null || !characters.contains(who) || (!cast.isEmpty() && !cast.contains(who));
                if (who != null && !offscreen) speaking.add(who);
                b.append(who == null ? "旁白" : who).append(offscreen ? "在画外说：「" : "说：「").append(line.path("text").asText()).append("」");
                b.append(offscreen && !cast.isEmpty() ? "画面里的人嘴闭着。" : "");
            }
            List<String> listeners = cast.stream().filter(who -> !speaking.contains(who)).toList();
            if (!speaking.isEmpty() && !listeners.isEmpty()) b.append(String.join("、", listeners)).append("听着，嘴闭着。");
            if (i == n - 1) b.append("最后保持这个画面到结束。");
            b.append('\n');
            t = end;
        }
        b.append("\n【声音】\n");
        if (!anyLine) b.append("这一段没有对白。\n");
        for (VoiceRef v : voices)
            b.append("声音参考：").append(v.name()).append("的音色、口音照").append(v.label()).append("，只借声音，说的是上面引号里的台词。\n");
        voiceDescs.forEach((name, desc) -> b.append(name).append("的音色：").append(desc).append("\n"));
        List<String> plain = unvoiced.stream().filter(who -> !voiceDescs.containsKey(who)).toList();
        if (!plain.isEmpty()) b.append(String.join("、", plain)).append(" 没有声音参考，按人物身份自然配音。\n");
        b.append("\n【配乐】\n无\n\n人物只说引号里的台词，画面里没有字幕。");
        return b.toString();
    }

    /** 补成一句：去掉首尾空白，没有句末标点就补一个句号；空串原样返回。 */
    private static String sentence(String s) {
        String t = s == null ? "" : s.strip();
        if (t.isEmpty()) return "";
        return "。！？!?；…".indexOf(t.charAt(t.length() - 1)) >= 0 ? t : t + "。";
    }

    /**
     * 第 2、3 版用的出镜判断，冻结不改（改了会让旧模板重建出来的提示词变样，已有视频被误标「需更新」）：
     * 景别机位、画面、动作里点了全名的（长名字先认）。新模板用 {@link #castOfShot}。
     */
    static List<String> castOf(JsonNode shot, List<String> characters) {
        String text = shot.path("camera").asText() + "\n" + shot.path("still").asText() + "\n" + shot.path("action").asText();
        List<String> byLength = new ArrayList<>(characters);
        byLength.sort((a, b) -> b.length() - a.length());
        Set<String> found = new HashSet<>();
        for (String name : byLength) {
            if (name.isBlank() || !text.contains(name)) continue;
            found.add(name);
            text = text.replace(name, "\u0000");
        }
        return characters.stream().filter(found::contains).toList();
    }

    /** 第 2 版视频提示词（2026-10-26 至 2026-10-28），只用来核对第 2 版生成的视频，不要拿它生成新视频。 */
    static String videoPromptV2(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames,
                                     List<VoiceRef> voices, List<String> unvoiced, java.util.Map<String, String> voiceDescs) {
        String style = settings.path("style").asText("真人写实");
        JsonNode shots = clip.path("shots");
        int n = Math.min(shots.size(), MAX_SHOTS);
        boolean grid = boardLayout(shots.size())[0] == 2;
        List<String> characters = new ArrayList<>();
        StringBuilder people = new StringBuilder();
        for (Ref r : refs) {
            switch (r.kind()) {
                case "scene" -> people.append("场景「").append(r.name()).append("」：空间布局和光线照参考").append(r.label()).append("。\n");
                case "prop" -> people.append("道具「").append(r.name()).append("」：外观照参考").append(r.label()).append("。\n");
                default -> {
                    characters.add(r.name());
                    people.append(r.name()).append("：长相、发型和衣服都照参考").append(r.label()).append("。参考").append(r.label())
                            .append(" 是").append(r.name()).append("的设定图，图里的人像都是").append(r.name()).append("一个人。\n");
                }
            }
        }
        if (!characters.isEmpty())
            people.append(String.join("和", characters)).append(characters.size() > 1 ? "在画面里各只出现一个" : "在画面里只出现一个")
                    .append("，长相和衣服从头到尾保持一致。\n");
        StringBuilder b = new StringBuilder();
        if (!people.isEmpty()) b.append("【人物】\n").append(people).append('\n');
        b.append("【分镜参考】\n");
        if (grid) {
            b.append("参考图1 是 2×2 分镜：");
            for (int i = 0; i < n; i++) b.append(i > 0 ? "，" : "").append(CELL_ORDER[i]).append("对应第").append(i + 1).append("镜");
            if (n < 4) b.append("，其余格子是空的");
            b.append("。每格只参考构图、机位和人物位置，每一镜都是一个完整的全屏画面。\n\n");
        } else {
            b.append("参考图1 是这一段的分镜画面，参考它的构图、机位和人物位置，视频是一个完整的全屏画面。\n\n");
        }
        b.append("【画面】\n").append(style).append("风格。\n");
        boolean anyLine = false;
        double t = 0;
        for (int i = 0; i < n; i++) {
            JsonNode s = shots.get(i);
            double end = t + s.path("durationSec").asDouble();
            b.append("第").append(i + 1).append("镜（").append(i == 0 ? "0–" + fmt(end) + " 秒" : fmt(t) + " 秒切").append("）：");
            b.append(sentence(s.path("size").asText() + (s.path("camera").asText().isBlank() ? "" : "，" + s.path("camera").asText())));
            b.append(sentence(s.path("still").asText())).append(sentence(s.path("action").asText()));
            List<String> cast = castOf(s, characters);
            if (cast.size() == 1) b.append("画面里只有").append(cast.get(0)).append("。");
            Set<String> speaking = new HashSet<>();
            for (JsonNode line : s.path("dialogue")) {
                anyLine = true;
                String who = line.path("speakerId").isTextual() ? speakerNames.get(line.path("speakerId").asText()) : null;
                boolean offscreen = who == null || !characters.contains(who) || (!cast.isEmpty() && !cast.contains(who));
                if (who != null && !offscreen) speaking.add(who);
                b.append(who == null ? "旁白" : who).append(offscreen ? "在画外说：「" : "说：「").append(line.path("text").asText()).append("」");
                b.append(offscreen && !cast.isEmpty() ? "画面里的人嘴闭着。" : "");
            }
            List<String> listeners = cast.stream().filter(who -> !speaking.contains(who)).toList();
            if (!speaking.isEmpty() && !listeners.isEmpty()) b.append(String.join("、", listeners)).append("听着，嘴闭着。");
            if (i == n - 1) b.append("最后保持这个画面到结束。");
            b.append('\n');
            t = end;
        }
        b.append("\n【声音】\n");
        if (!anyLine) b.append("这一段没有对白。\n");
        for (VoiceRef v : voices)
            b.append("声音参考：").append(v.name()).append("的音色、口音照").append(v.label()).append("，只借声音，说的是上面引号里的台词。\n");
        voiceDescs.forEach((name, desc) -> b.append(name).append("的音色：").append(desc).append("\n"));
        List<String> plain = unvoiced.stream().filter(who -> !voiceDescs.containsKey(who)).toList();
        if (!plain.isEmpty()) b.append(String.join("、", plain)).append(" 没有声音参考，按人物身份自然配音。\n");
        b.append("\n【配乐】\n无\n\n人物只说引号里的台词，画面里没有字幕。");
        return b.toString();
    }

    /**
     * 旧格式（2026-10-26 之前）的视频提示词，只用来核对旧格式生成的视频还是不是当前这一版：换了模板不该把它们都标成「已修改」。
     * 不要拿它生成新视频。
     */
    static String legacyVideoPrompt(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames,
                                     List<VoiceRef> voices, List<String> unvoiced, java.util.Map<String, String> voiceDescs) {
        String style = settings.path("style").asText("真人写实");
        String aspect = settings.path("aspectRatio").asText("9:16");
        JsonNode shots = clip.path("shots");
        int n = Math.min(shots.size(), MAX_SHOTS);
        boolean grid = boardLayout(shots.size())[0] == 2;
        StringBuilder b = new StringBuilder();
        b.append("本视频为一个剧情片段").append(n > 1 ? "的多镜头连贯视频" : "").append("，总时长约 ").append(fmt(clip.path("durationSec").asDouble()))
                .append(" 秒，共 ").append(n).append(" 个镜头，").append(style).append("风格，画幅 ").append(aspect).append("，请严格按以下时间轴依次呈现：\n");
        double t = 0;
        StringBuilder voice = new StringBuilder();
        for (int i = 0; i < n; i++) {
            JsonNode s = shots.get(i);
            double end = t + s.path("durationSec").asDouble();
            b.append("第").append(i + 1).append("镜（").append(clock(t)).append("-").append(clock(end))
                    .append(grid ? "，画面参考宫格图第" + (i + 1) + "格" : "，画面参考分镜图").append("）：构图：").append(s.path("size").asText());
            if (!s.path("camera").asText().isBlank()) b.append("，").append(s.path("camera").asText());
            if (!s.path("still").asText().isBlank()) b.append("；画面：").append(s.path("still").asText());
            b.append("；动作：").append(s.path("action").asText()).append("\n");
            for (JsonNode line : s.path("dialogue")) {
                String speaker = speakerNames.getOrDefault(line.path("speakerId").asText(), "旁白");
                voice.append("第").append(i + 1).append("镜 · @").append(speaker).append(" · “").append(line.path("text").asText()).append("”\n");
            }
            t = end;
        }
        b.append("\n【语音轨】\n");
        if (voice.length() == 0) b.append("本片段没有台词，不生成人声对白。\n"); else b.append(voice);
        if (!voices.isEmpty()) {
            b.append("声音参考：");
            for (VoiceRef v : voices) b.append(v.label()).append(" 只为「").append(v.name()).append("」提供音色、口音和声音身份；");
            b.append("只说本段列出的新台词，不复制样本里的台词、背景音乐或噪声，角色之间不交换声音。\n");
        }
        voiceDescs.forEach((name, desc) -> b.append("@").append(name).append(" 的音色：").append(desc).append("\n"));
        List<String> plain = unvoiced.stream().filter(who -> !voiceDescs.containsKey(who)).toList();
        if (!plain.isEmpty()) b.append(String.join("、", plain)).append(" 没有声音参考，按人物身份自然配音。\n");
        b.append("\n【参考图说明】\n");
        if (grid) {
            b.append("参考图1为本片段的 2×2 宫格分镜整图，共 ").append(n).append(" 格有画面，格子编号从左到右、从上到下依次为第1格……第").append(n)
                    .append("格，与上文第1镜至第").append(n).append("镜一一对应，作为各镜的构图参考。\n");
            b.append("重要：宫格图仅作为各镜头的构图与形象参考，输出视频为连续的全屏单镜头画面，禁止在视频中出现格线、边框、白边、多格并排或漫画分镜样式；"
                    + "每一镜直接以全屏画面呈现，禁止先展示整图再放大进入某一格；同一角色在同一镜头画面中只能出现一次；"
                    + "取某一格参考时，只采用该格的构图与人物状态，不把其他格子的人物形象和构图混入本镜画面。\n");
            if (n < 4) b.append("空白格无对应镜头，忽略不取。\n");
            b.append("分镜图里的画面不一定是动作的起点，按上文写的动作完成。\n");
        } else {
            b.append("参考图1为本片段的分镜画面，作为本镜的构图与形象参考，输出为全屏画面，不出现边框或分镜样式。\n");
        }
        if (!refs.isEmpty()) {
            b.append("参考图2起为资产标准照，逐张对应：");
            for (int i = 0; i < refs.size(); i++) {
                Ref r = refs.get(i);
                if (i > 0) b.append(" / ");
                b.append("参考").append(r.label()).append(" = ").append(kindLabel(r.kind())).append("「").append(r.name()).append("」");
            }
            b.append("。\n这些图仅用于锁定长相、服装、气质与环境风格，其构图、站姿和纯色背景不得出现在视频画面中。\n");
        }
        b.append(n > 1 ? "相邻镜头之间画面需连贯过渡。" : "")
                .append("只说语音轨里列出的台词，不朗读镜号或参考说明；不增加人物或剧情，不生成字幕。");
        return b.toString();
    }

    /** 时间轴里的时间：00:03、00:02.5。 */
    private static String clock(double sec) {
        int m = (int) (sec / 60);
        double s = sec - m * 60;
        String ss = s == Math.floor(s) ? String.format("%02d", (int) s) : String.format("%04.1f", s);
        return String.format("%02d:", m) + ss;
    }

    /**
     * 首帧出片：视频从采用的分镜画面开始动。只有这一张图交给模型，不带角色 / 场景 / 道具参考图，也不带声音参考，
     * 所以提示词里不写「图N」「音频N」，只写从这张画面出发要发生的动作和台词。
     */
    public static String framePrompt(JsonNode settings, JsonNode clip, java.util.Map<String, String> speakerNames, java.util.Map<String, String> voiceDescs) {
        String style = settings.path("style").asText("真人写实");
        String aspect = settings.path("aspectRatio").asText("9:16");
        StringBuilder b = new StringBuilder();
        b.append("以首帧画面为起点，生成 ").append(clip.path("durationSec").asInt()).append(" 秒、").append(aspect).append("、").append(style)
                .append("风格的剧情片段。保持首帧里的人物、服装、场景和道具不变，不切换到别的画面。\n");
        for (JsonNode s : clip.path("shots")) {
            b.append(s.path("size").asText()).append("，").append(s.path("camera").asText()).append("。").append(s.path("action").asText()).append("\n");
            for (JsonNode line : s.path("dialogue")) {
                String speaker = speakerNames.getOrDefault(line.path("speakerId").asText(), "旁白");
                b.append("  ").append(speaker).append("说：“").append(line.path("text").asText()).append("”\n");
            }
        }
        voiceDescs.forEach((name, desc) -> b.append(name).append(" 的音色：").append(desc).append("\n"));
        b.append("只说上面列出的台词，不增加人物或剧情，不生成字幕。");
        return b.toString();
    }

    private static void appendRefs(StringBuilder b, List<Ref> refs) {
        for (Ref r : refs) {
            b.append(r.label()).append(" 提供").append(kindLabel(r.kind())).append("「").append(r.name()).append("」的")
                    .append(switch (r.kind()) { case "scene" -> "空间布局与光源方向"; case "prop" -> "外观"; default -> "身份与造型"; })
                    .append("。\n");
        }
    }

    // ── 旧版出图模板（IMAGE_PROMPT_FORMAT 2，2026-10-28 发布的那一版）────────────────────────────
    // 已随 20261028-director-delete 上线并出过图，只用来核对那一版生成的参考图 / 分镜图，不要拿它出新图。
    // 它按关键词推断特殊布光、命中就关补光，「自然色调」「胶片质感」「不要逆光剪影」都会读反；第 3 版改成一段默认指导（现在在提示词库 stage-director-board）。

    private static final Pattern LIGHTING_INTENT_V2 = Pattern.compile(
            "逆光|剪影|背光|轮廓光|只见轮廓|看不清(脸|面|五官)|(脸|面部|五官|人)[^，。；]{0,4}(阴影|暗处|暗影)|(隐入|藏在|站在|坐在|躲在)?阴影(里|中)"
            + "|低调|高反差|明暗对比|[烛火月冷暖红蓝绿紫]光(照|映|打|洒|落)|(霓虹|台灯|手电|屏幕|车灯)[^，。；]{0,3}(照|映|打)|映(红|黄|蓝|绿|紫)"
            + "|黑白|单色|胶片|色调|调色");

    private static final Pattern SCENE_MOOD_V2 = Pattern.compile("昏暗|阴暗|昏黄|漆黑|黑暗|幽暗|霓虹|烛光|火光|月光|逆光|暗调|低调|冷色|暖色|色调|调色|黑白");

    private static boolean lightingIntentV2(String text) {
        return text != null && LIGHTING_INTENT_V2.matcher(text).find();
    }

    private static final String LIVE_LIGHTING_V2 = "顺着场景的光源方向布光，人物按影视拍摄给演员打光，主光塑造五官，柔和补光让眼睛和暗侧脸颊看得清；"
            + "肤色按角色参考图自然还原、有气色，保留皮肤质感；场景的暖光和暗调主要落在环境上，不把人物的脸压黑或染黄。"
            + "夜景和暗调的戏保留氛围，用画面里的光源和轮廓光把人物交代清楚。";
    private static final String PLAIN_LIGHTING_V2 = "顺着场景的光源方向打光，人物面部受光清楚、五官可辨，配色干净，不发灰发脏；夜景和暗调的戏保留氛围。";

    private static String boardLightingV2(String style, JsonNode shots, boolean grid) {
        if (lightingIntentV2(style))
            return "布光与调色：按画面风格「" + style + "」的布光和调色来，人物的脸怎么处理也照这个风格，不另外补光提亮"
                    + (grid ? "；各格保持同一调色。\n" : "。\n");
        String body = liveAction(style) ? LIVE_LIGHTING_V2 : PLAIN_LIGHTING_V2;
        int n = Math.min(shots.size(), MAX_SHOTS);
        List<String> special = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            JsonNode s = shots.get(i);
            if (lightingIntentV2(s.path("still").asText() + "；" + s.path("camera").asText())) special.add(grid ? CELL_NAMES[i] + "格" : "这个画面");
        }
        if (special.isEmpty()) return "布光与调色：" + body + "\n";
        String keep = String.join("、", special) + "按画面描述里写的布光来，不为它补光提亮";
        return special.size() == n ? "布光与调色：" + keep + "。\n" : "布光与调色：" + keep + "；其余各格" + body + "\n";
    }

    static String assetPromptV2(JsonNode settings, JsonNode asset) {
        String style = settings.path("style").asText("真人写实");
        String name = asset.path("name").asText();
        String desc = asset.path("description").asText();
        return switch (asset.path("kind").asText()) {
            case "scene" -> style + "风格的「" + name + "」空间参考图。" + desc
                    + "\n用平视广角清楚展示空间的固定布局：入口、窗、主要家具及它们的相对位置，自然透视。"
                    + (SCENE_MOOD_V2.matcher(desc).find() || lightingIntentV2(style)
                        ? "\n光线按场景设定和画面风格来，保留写明的明暗和色调，主要光源的位置和空间布局要看得清。"
                        : "\n光线按场景设定的时段和光源来：主光源方向明确，整体曝光正常，暗部和墙角的细节看得清；"
                          + "暖光只落在光源照到的地方，不把整个画面染成一层黄、绿或褐色，夜景保留夜色、靠画面里的光源照明。")
                    + "\n画面里不出现人物和临时剧情道具，不添加多余的门窗或第二套家具，不出现文字。";
            case "prop" -> style + "风格的道具「" + name + "」单件参考图。" + desc
                    + "\n用能看清关键特征的角度和景别，光照均匀、白平衡中性，颜色和材质准确，背景简洁。"
                    + "\n不出现人物或手，不表现使用动作，不生成重复物件、文字或商标。";
            default -> style + "风格的角色设定集「" + name + "」，一张横版 16:9 设定板，浅灰纯色背景，统一柔和的棚拍光，各分区之间用细白边分隔，按以下排版：\n"
                    + "1. 左侧约三分之一：全身三视图，从左到右依次为正面、正侧面、背面，同一自然站姿，双臂下垂，从头顶到鞋完整入画。\n"
                    + "2. 中间上部：颈部以上的头部细节，正面、左侧面、右侧面各一张。\n"
                    + "3. 中间中部：表情四宫格，同一角度的胸像，依次为喜、怒、哀、乐。\n"
                    + "4. 右侧一列：面部特征特写 2–3 张，按设定挑最能辨认的部位（眼睛、鼻子、嘴唇，或痣、疤痕、随身配饰等身体特征）。\n"
                    + "5. 中间下部：正面半身展示图，自然姿态，看清上身服装与气质。\n"
                    + (lightingIntentV2(style)
                        ? "布光与色彩：主光加柔和补光让五官看得清，色彩和调色按画面风格来"
                          + (liveAction(style) ? "；肤色按角色设定还原，保留真实的皮肤纹理，不磨皮、不刻意美白。\n" : "。\n")
                        : liveAction(style)
                        ? "布光与色彩：主光从斜前方照亮面部，柔和补光让眼睛和眼窝、鼻翼两侧的暗部看得清；白平衡中性，浅灰背景和白色衣物不偏黄、绿或橙褐。"
                          + "肤色按角色设定还原，气色自然健康，保留真实的皮肤纹理，不磨皮、不刻意美白。\n"
                        : "布光与色彩：面部受光充分、五官清楚，白平衡中性，配色按设定准确还原，不发灰发脏。\n")
                    + "角色设定：" + desc + "\n"
                    + "所有分区都是同一个人：脸型、五官、发型、肤色、体型、服装和配饰完全一致；画面里不出现其他人物、剧情场景或未设定的道具。\n"
                    + "图中不写任何文字、标注、编号、色板或水印。";
        };
    }

    static String boardPromptV2(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames) {
        String style = settings.path("style").asText("真人写实");
        String aspect = settings.path("aspectRatio").asText("9:16");
        JsonNode shots = clip.path("shots");
        int[] layout = boardLayout(shots.size());
        StringBuilder b = new StringBuilder();
        if (layout[0] == 1) b.append(style).append("风格的剧情分镜画面，画幅 ").append(aspect).append("。\n");
        else b.append(style).append("风格，生成 2×2 分镜板：四个等大无间隙的格子，整板 ").append(aspect)
                .append("，每格 ").append(aspect).append("，按左上、右上、左下、右下的顺序阅读。\n");
        appendRefs(b, refs);
        if (!refs.isEmpty()) b.append("参考图里的多视角或资料排版代表同一个资产，不要复制资料排版、背景，也不要把同一个角色画成多个人。")
                .append("参考图只确定人物身份、造型、道具外观和空间，画面里按镜头重新给人物布光，参考图本身偏暗或偏色的地方不照搬。\n");
        for (int i = 0; i < shots.size() && i < MAX_SHOTS; i++) {
            JsonNode s = shots.get(i);
            b.append(layout[0] == 1 ? "画面：" : CELL_NAMES[i] + "格：").append(s.path("size").asText()).append("，")
                    .append(s.path("camera").asText()).append("。").append(s.path("still").asText()).append("\n");
        }
        if (layout[0] == 2 && shots.size() < 4) b.append("没有用到的格子保持纯灰色留白。\n");
        b.append(boardLightingV2(style, shots, layout[0] == 2));
        b.append(layout[0] == 1 ? "只描绘这一个静态时刻，" : "各格沿用同一身份、造型、空间和光源，人物的肤色和整体色调保持一致，明暗只随画面描述的布光变化；机位变化可以让人物在画面左右位置合理变化。每格只画一个静态时刻，")
                .append("不画动作残影。图内不画文字、字幕、镜号或水印。");
        return b.toString();
    }

    // ── 旧版出图模板（IMAGE_PROMPT_FORMAT 1，2026-10-28 之前）────────────────────────────
    // 只用来核对之前生成的参考图 / 分镜图是不是当前这一版：换了模板不该把它们都标成「提示词已修改」。不要拿它们出新图。

    /** 按 format 那一版编的资产出图提示词；format 就是当前版本时返回 null。没记版本的候选按第 1 版。 */
    static String legacyAssetPrompt(JsonNode settings, JsonNode asset, int format) {
        return format >= IMAGE_PROMPT_FORMAT ? null : format == 2 ? assetPromptV2(settings, asset) : legacyAssetPrompt(settings, asset);
    }

    static String legacyBoardPrompt(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames, int format) {
        return format >= IMAGE_PROMPT_FORMAT ? null : format == 2 ? boardPromptV2(settings, clip, refs, speakerNames)
                : legacyBoardPrompt(settings, clip, refs, speakerNames);
    }

    static String legacyAssetPrompt(JsonNode settings, JsonNode asset) {
        String style = settings.path("style").asText("真人写实");
        String name = asset.path("name").asText();
        String desc = asset.path("description").asText();
        return switch (asset.path("kind").asText()) {
            case "scene" -> style + "风格的「" + name + "」空间参考图。" + desc
                    + "\n用平视广角清楚展示空间的固定布局：入口、窗、主要家具及它们的相对位置。光线统一、自然透视。"
                    + "\n画面里不出现人物和临时剧情道具，不添加多余的门窗或第二套家具，不出现文字。";
            case "prop" -> style + "风格的道具「" + name + "」单件参考图。" + desc
                    + "\n用能看清关键特征的角度和景别，光照均匀，背景简洁。"
                    + "\n不出现人物或手，不表现使用动作，不生成重复物件、文字或商标。";
            // 角色设定集：一张横版图拼五个区，后面的分镜图和视频都拿它锁定长相、服装和表情。
            default -> style + "风格的角色设定集「" + name + "」，一张横版 16:9 设定板，浅灰纯色背景，统一柔和的棚拍光，各分区之间用细白边分隔，按以下排版：\n"
                    + "1. 左侧约三分之一：全身三视图，从左到右依次为正面、正侧面、背面，同一自然站姿，双臂下垂，从头顶到鞋完整入画。\n"
                    + "2. 中间上部：颈部以上的头部细节，正面、左侧面、右侧面各一张。\n"
                    + "3. 中间中部：表情四宫格，同一角度的胸像，依次为喜、怒、哀、乐。\n"
                    + "4. 右侧一列：面部特征特写 2–3 张，按设定挑最能辨认的部位（眼睛、鼻子、嘴唇，或痣、疤痕、随身配饰等身体特征）。\n"
                    + "5. 中间下部：正面半身展示图，自然姿态，看清上身服装与气质。\n"
                    + "角色设定：" + desc + "\n"
                    + "所有分区都是同一个人：脸型、五官、发型、肤色、体型、服装和配饰完全一致；画面里不出现其他人物、剧情场景或未设定的道具。\n"
                    + "图中不写任何文字、标注、编号、色板或水印。";
        };
    }

    static String legacyBoardPrompt(JsonNode settings, JsonNode clip, List<Ref> refs, java.util.Map<String, String> speakerNames) {
        String style = settings.path("style").asText("真人写实");
        String aspect = settings.path("aspectRatio").asText("9:16");
        JsonNode shots = clip.path("shots");
        int[] layout = boardLayout(shots.size());
        StringBuilder b = new StringBuilder();
        if (layout[0] == 1) b.append(style).append("风格的剧情分镜画面，画幅 ").append(aspect).append("。\n");
        else b.append(style).append("风格，生成 2×2 分镜板：四个等大无间隙的格子，整板 ").append(aspect)
                .append("，每格 ").append(aspect).append("，按左上、右上、左下、右下的顺序阅读。\n");
        legacyAppendRefs(b, refs);
        if (!refs.isEmpty()) b.append("参考图里的多视角或资料排版代表同一个资产，不要复制资料排版、背景，也不要把同一个角色画成多个人。\n");
        for (int i = 0; i < shots.size() && i < MAX_SHOTS; i++) {
            JsonNode s = shots.get(i);
            b.append(layout[0] == 1 ? "画面：" : CELL_NAMES[i] + "格：").append(s.path("size").asText()).append("，")
                    .append(s.path("camera").asText()).append("。").append(s.path("still").asText()).append("\n");
        }
        if (layout[0] == 2 && shots.size() < 4) b.append("没有用到的格子保持纯灰色留白。\n");
        b.append(layout[0] == 1 ? "只描绘这一个静态时刻，" : "各格沿用同一身份、造型、空间和光源；机位变化可以让人物在画面左右位置合理变化。每格只画一个静态时刻，")
                .append("不画动作残影。图内不画文字、字幕、镜号或水印。");
        return b.toString();
    }

    private static void legacyAppendRefs(StringBuilder b, List<Ref> refs) {
        for (Ref r : refs) {
            b.append(r.label()).append(" 提供").append(kindLabel(r.kind())).append("「").append(r.name()).append("」的")
                    .append(switch (r.kind()) { case "scene" -> "空间布局与光线"; case "prop" -> "外观"; default -> "身份与造型"; })
                    .append("。\n");
        }
    }

    private static String fmt(double v) {
        return v == Math.floor(v) ? String.valueOf((int) v) : String.valueOf(v);
    }

    // ── 小工具 ──────────────────────────────────────────────────────────────

    static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isTextual() ? v.asText().trim() : v.isNumber() ? v.asText() : "";
    }

    static String clip(String s, int max) {
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max);
    }

    static Set<String> strings(JsonNode arr) {
        Set<String> out = new HashSet<>();
        arr.forEach(x -> out.add(x.asText()));
        return out;
    }

    static BusinessException bad(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", message + "，本次未扣积分，请重试");
    }
}
