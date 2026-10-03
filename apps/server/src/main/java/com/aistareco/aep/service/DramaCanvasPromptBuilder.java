package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageTarget;
import com.aistareco.aep.service.ai.ModelJsonRepair;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 画布（v0.198）各类生成的提示词拼装与输出校验 —— <b>只做纯逻辑</b>：读传进来的文档快照、取模板、填变量、收参考图、
 * 校验模型输出的形状。不碰钱、不调模型、不查库（除了取模板），所以能直接单测。
 *
 * <p>分工：{@link DramaCanvasRunService} 在冻结之前调这里的 {@code compile*}（校验不过就 4xx，一分钱不冻）；
 * {@link DramaCanvasRunWorker} 调这里的 {@code parse*} 校验模型输出，不合格 502 {@code AI_CALL_FAILED} 并退款
 * （§8.0：绝不用模板句 / 规则兜底冒充结果）。
 *
 * <p>设计真源 docs/drama-canvas-plan.md §4.2；文档形状 packages/types/src/drama-canvas.ts。
 */
@Component
public class DramaCanvasPromptBuilder {

    /** 分集剧情一次最多写多少集（再多就分批，后一批带着前一批的结尾接着写）。 */
    static final int OUTLINE_CHUNK = 20;
    /** 拆角色场景时一批剧本最多多少字（超过就按集分批，最后按名字合并）。 */
    static final int EXTRACT_BATCH_CHARS = 12_000;
    /** 分镜脚本里给模型的素材对照表最多列多少条。 */
    static final int ASSET_TABLE_MAX = 60;
    /**
     * 片段最少多少秒的缺省值：请求里没带 {@code minSegmentSec}（前端按所选视频模型的下限带，如 H3 是 5）时用它。
     * 写进提示词，装段时比它短的片段会并进相邻片段（{@link #parseStoryboard}）。
     */
    static final int SEGMENT_MIN_SEC = 4;
    public static final int INSTRUCTION_MAX = 200;
    public static final Set<String> IMAGE_RATIOS = Set.of("9:16", "16:9", "1:1", "4:3", "3:4");

    /**
     * 分批调用时「前一批的结果」的占位：提交时填不出来（结果还没有），worker 跑到这一批时换成真内容。
     * 模板里没写对应变量（运营删了）就不会出现，也就不换。
     */
    public static final String CARRY = "⟦carry⟧";

    private static final ObjectMapper OM = new ObjectMapper();
    private static final JsonNodeFactory F = JsonNodeFactory.instance;
    /** 引用标记里 id 的外形（与 {@link DramaCanvasDocs#REF_PATTERN} 的 id 段一致）；不合的 id 不进对照表。 */
    private static final Pattern REF_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");

    private final PromptService prompts;

    public DramaCanvasPromptBuilder(PromptService prompts) {
        this.prompts = prompts;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 文字类：编译
    // ═════════════════════════════════════════════════════════════════════════

    /** 一次 chat 调用（system / user 已填好；user 里可能留着 {@link #CARRY}）。 */
    public record TextCall(String system, String user, double temperature, int maxTokens, boolean jsonMode) {}

    /**
     * 文字类生成的编译结果。
     *
     * @param target DramaCanvasRunTarget
     * @param meta   worker 校验 / 合并输出要用的上下文（分批范围、集号、合法 id…），随运行记录存下来
     */
    public record TextPlan(String promptKey, String target, String label, List<TextCall> calls, ObjectNode meta) {}

    /** 故事大纲（script:setting）：要有 script.idea。 */
    public TextPlan setting(JsonNode doc, String instruction) {
        String instr = normalizeInstruction(instruction);
        JsonNode script = doc.path("script");
        String idea = text(script, "idea");
        if (idea == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_IDEA_EMPTY",
                    "先写一句故事想法，再让 AI 写故事大纲。");
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("idea", idea);
        vars.put("targetEpisodes", String.valueOf(targetEpisodes(script, 10)));
        vars.put("episodeDurationSec", String.valueOf(episodeDurationSec(script)));
        vars.put("styleClause", styleClause(doc));
        String current = text(script.path("setting"), "text");
        vars.put("currentClause", instr != null && current != null
                ? "这是上一版故事大纲，按要求改写（没提到的部分尽量保留）：\n" + current + "\n" : "");
        vars.put("instructionClause", instructionClause(instr));
        TextCall call = call(PromptService.KEY_DRAMA_CANVAS_SCRIPT_SETTING, vars, 0.9, 4096);
        ObjectNode meta = F.objectNode();
        meta.put("stage", "setting");
        return new TextPlan(PromptService.KEY_DRAMA_CANVAS_SCRIPT_SETTING, "script:setting", "画布 · 写故事大纲",
                List.of(call), meta);
    }

    /** 分集剧情（script:outline）：要有 setting.text 和 targetEpisodes；按 {@link #OUTLINE_CHUNK} 分批。 */
    public TextPlan outline(JsonNode doc, String instruction) {
        String instr = normalizeInstruction(instruction);
        JsonNode script = doc.path("script");
        String setting = text(script.path("setting"), "text");
        if (setting == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_SETTING_EMPTY",
                    "先写好故事大纲，再写分集剧情。");
        }
        JsonNode te = script.get("targetEpisodes");
        if (te == null || !te.isIntegralNumber() || te.asInt() < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_EPISODES_MISSING",
                    "先定下一共写几集，再写分集剧情。");
        }
        int total = Math.min(80, te.asInt());
        List<TextCall> calls = new ArrayList<>();
        ArrayNode chunks = F.arrayNode();
        for (int from = 1; from <= total; from += OUTLINE_CHUNK) {
            int to = Math.min(total, from + OUTLINE_CHUNK - 1);
            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("setting", setting);
            vars.put("total", String.valueOf(total));
            vars.put("fromNo", String.valueOf(from));
            vars.put("toNo", String.valueOf(to));
            vars.put("count", String.valueOf(to - from + 1));
            vars.put("episodeDurationSec", String.valueOf(episodeDurationSec(script)));
            vars.put("styleClause", styleClause(doc));
            vars.put("instructionClause", instructionClause(instr));
            vars.put("prevClause", from == 1 ? "" : CARRY);
            calls.add(call(PromptService.KEY_DRAMA_CANVAS_SCRIPT_OUTLINE, vars, 0.85, 8192));
            chunks.addObject().put("fromNo", from).put("toNo", to);
        }
        ObjectNode meta = F.objectNode();
        meta.put("stage", "outline");
        meta.put("total", total);
        meta.set("chunks", chunks);
        return new TextPlan(PromptService.KEY_DRAMA_CANVAS_SCRIPT_OUTLINE, "script:outline",
                "画布 · 写分集剧情（" + total + " 集）", calls, meta);
    }

    /** 某一集剧本（script:episode:&lt;no&gt;）：这一集要在分集剧情或分集剧本里，且没锁。 */
    public TextPlan episode(JsonNode doc, Integer episodeNo, String instruction) {
        String instr = normalizeInstruction(instruction);
        if (episodeNo == null || episodeNo < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_EPISODE_REQUIRED", "要写哪一集？");
        }
        int no = episodeNo;
        JsonNode script = doc.path("script");
        Optional<JsonNode> outlineEp = byNo(script.path("outline").path("episodes"), no);
        Optional<JsonNode> scriptEp = DramaCanvasDocs.findScriptEpisode(doc, no);
        if (outlineEp.isEmpty() && scriptEp.isEmpty()) {
            throw BusinessException.notFound("DRAMA_CANVAS_EPISODE_NOT_FOUND", "剧本里没有第 " + no + " 集。");
        }
        if (scriptEp.isPresent() && scriptEp.get().path("locked").asBoolean(false)) {
            throw new BusinessException(HttpStatus.CONFLICT, "DRAMA_CANVAS_EPISODE_LOCKED",
                    "第 " + no + " 集已经锁上了，先解锁再重写。");
        }
        int total = Math.max(targetEpisodes(script, 0),
                Math.max(script.path("outline").path("episodes").size(), script.path("episodes").size()));
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("no", String.valueOf(no));
        vars.put("total", String.valueOf(Math.max(total, no)));
        String setting = text(script.path("setting"), "text");
        vars.put("settingClause", setting == null ? "" : "故事大纲：\n" + setting + "\n");
        vars.put("outlineClause", outlineEp.map(e -> "这一集的分集剧情：\n标题：" + nz(text(e, "title"))
                + "\n钩子：" + nz(text(e, "hook")) + "\n梗概：" + nz(text(e, "summary")) + "\n").orElse(""));
        Optional<JsonNode> prev = DramaCanvasDocs.findScriptEpisode(doc, no - 1);
        String prevText = prev.map(p -> text(p, "text")).orElse(null);
        // v0.198.1：原来写「接着它往下写」，线上第 3 集把第 2 集几乎原样重写了一遍 —— 结尾只是前情，不是要续写的那一场
        vars.put("prevClause", prevText == null ? ""
                : "上一集（第 " + (no - 1) + " 集）的结尾如下，只是让你接上前情。这一集从它之后发生的事开始写，"
                        + "不要重写或重复上一集的场景、动作和台词：\n" + tail(prevText, 800) + "\n");
        String current = scriptEp.map(e -> text(e, "text")).orElse(null);
        vars.put("currentClause", current == null ? ""
                : "这是这一集现在的剧本，按要求重写（没提到的尽量保留）：\n" + current + "\n");
        vars.put("instructionClause", instructionClause(instr));
        vars.put("episodeDurationSec", String.valueOf(episodeDurationSec(script)));
        vars.put("styleClause", styleClause(doc));
        TextCall call = call(PromptService.KEY_DRAMA_CANVAS_SCRIPT_EPISODE, vars, 0.85, 8192);
        ObjectNode meta = F.objectNode();
        meta.put("stage", "episode");
        meta.put("no", no);
        String fallbackTitle = outlineEp.map(e -> text(e, "title"))
                .orElseGet(() -> scriptEp.map(e -> text(e, "title")).orElse(null));
        if (fallbackTitle != null) meta.put("title", fallbackTitle);
        return new TextPlan(PromptService.KEY_DRAMA_CANVAS_SCRIPT_EPISODE, "script:episode:" + no,
                "画布 · 写第 " + no + " 集剧本", List.of(call), meta);
    }

    /** 拆出角色和场景（extract）：输入全部分集剧本，超长按集分批。 */
    public TextPlan extract(JsonNode doc) {
        List<JsonNode> eps = new ArrayList<>();
        int maxNo = 0;
        for (JsonNode e : DramaCanvasDocs.arr(doc.path("script"), "episodes")) {
            JsonNode no = e.get("no");
            if (no == null || !no.isIntegralNumber()) continue;
            maxNo = Math.max(maxNo, no.asInt());
            if (text(e, "text") != null) eps.add(e);
        }
        if (eps.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_SCRIPT_EMPTY",
                    "剧本还是空的，先写好或粘贴剧本，再拆角色和场景。");
        }
        eps.sort((a, b) -> Integer.compare(a.path("no").asInt(), b.path("no").asInt()));

        List<List<JsonNode>> batches = new ArrayList<>();
        List<JsonNode> cur = new ArrayList<>();
        int curChars = 0;
        for (JsonNode e : eps) {
            int len = text(e, "text").length();
            if (!cur.isEmpty() && curChars + len > EXTRACT_BATCH_CHARS) {
                batches.add(cur);
                cur = new ArrayList<>();
                curChars = 0;
            }
            cur.add(e);
            curChars += len;
        }
        if (!cur.isEmpty()) batches.add(cur);

        // v0.198.1：拆角色时看得到故事大纲的人物小传（线上把「女侦探」拆成了男性 —— 剧本里没写明性别时模型就猜）
        String setting = text(doc.path("script").path("setting"), "text");
        String settingClause = setting == null ? ""
                : "故事大纲（人物的性别、年龄、身份以这里的人物小传为准）：\n" + setting + "\n";
        List<TextCall> calls = new ArrayList<>();
        ArrayNode ranges = F.arrayNode();
        for (List<JsonNode> b : batches) {
            StringBuilder sb = new StringBuilder();
            for (JsonNode e : b) {
                sb.append("## 第 ").append(e.path("no").asInt()).append(" 集");
                String t = text(e, "title");
                if (t != null) sb.append(" ").append(t);
                sb.append("\n").append(text(e, "text")).append("\n\n");
            }
            int from = b.get(0).path("no").asInt();
            int to = b.get(b.size() - 1).path("no").asInt();
            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("settingClause", settingClause);
            vars.put("scriptText", sb.toString().trim());
            vars.put("episodeRange", from == to ? "第 " + from + " 集" : "第 " + from + "–" + to + " 集");
            vars.put("maxEpisodeNo", String.valueOf(maxNo));
            vars.put("knownClause", CARRY);
            vars.put("styleClause", styleClause(doc));
            calls.add(call(PromptService.KEY_DRAMA_CANVAS_EXTRACT, vars, 0.3, 8192));
            ranges.addObject().put("fromNo", from).put("toNo", to);
        }
        ObjectNode meta = F.objectNode();
        meta.put("maxEpisodeNo", maxNo);
        meta.set("batches", ranges);
        meta.set("existing", existingCast(doc));
        return new TextPlan(PromptService.KEY_DRAMA_CANVAS_EXTRACT, "extract", "画布 · 拆角色和场景", calls, meta);
    }

    /**
     * 本集分镜脚本（storyboard:&lt;no&gt;）：这一集要有剧本正文。maxSec 调用方已夹到 4–30；
     * minSec = 所选视频模型一条最短多少秒（调用方已夹到 1..maxSec），写进提示词，并随 meta 带给装段校验。
     */
    public TextPlan storyboard(JsonNode doc, Integer episodeNo, int maxSec, int minSec) {
        if (episodeNo == null || episodeNo < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_EPISODE_REQUIRED", "要给哪一集生成分镜脚本？");
        }
        int no = episodeNo;
        JsonNode ep = DramaCanvasDocs.findScriptEpisode(doc, no)
                .orElseThrow(() -> BusinessException.notFound("DRAMA_CANVAS_EPISODE_NOT_FOUND", "剧本里没有第 " + no + " 集。"));
        String scriptText = text(ep, "text");
        if (scriptText == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_SCRIPT_EMPTY",
                    "第 " + no + " 集还没有剧本正文，先写好剧本再生成分镜脚本。");
        }
        ObjectNode ids = F.objectNode();
        ArrayNode lookIds = ids.putArray("look");
        ArrayNode sceneIds = ids.putArray("scene");
        ArrayNode materialIds = ids.putArray("material");
        List<String[]> inEp = new ArrayList<>();   // [label, kind, id, desc]
        List<String[]> others = new ArrayList<>();
        for (JsonNode ch : DramaCanvasDocs.arr(doc, "characters")) {
            String chName = nz(text(ch, "name"));
            for (JsonNode lk : DramaCanvasDocs.arr(ch, "looks")) {
                String id = text(lk, "id");
                if (id == null || !REF_ID.matcher(id).matches()) continue;
                lookIds.add(id);
                String label = label(chName + "·" + nz(text(lk, "name")));
                String[] row = {label, "look", id, "角色「" + chName + "」的造型「" + nz(text(lk, "name")) + "」"};
                (containsInt(lk.path("episodes"), no) ? inEp : others).add(row);
            }
        }
        for (JsonNode sc : DramaCanvasDocs.arr(doc, "scenes")) {
            String id = text(sc, "id");
            if (id == null || !REF_ID.matcher(id).matches()) continue;
            sceneIds.add(id);
            String[] row = {label(nz(text(sc, "name"))), "scene", id, "场景"};
            (containsInt(sc.path("episodes"), no) ? inEp : others).add(row);
        }
        for (JsonNode m : DramaCanvasDocs.arr(doc, "materials")) {
            String id = text(m, "id");
            if (id == null || !REF_ID.matcher(id).matches()) continue;
            materialIds.add(id);
            if (!"image".equals(text(m, "kind"))) continue;
            others.add(new String[]{label(nz(text(m, "name"))), "material", id, "素材图"});
        }
        StringBuilder table = new StringBuilder();
        int n = 0;
        for (List<String[]> group : List.of(inEp, others)) {
            for (String[] r : group) {
                if (n++ >= ASSET_TABLE_MAX) break;
                table.append("- ").append(r[0]).append("（").append(r[3]).append("）→ @[")
                        .append(r[0]).append("](").append(r[1]).append(":").append(r[2]).append(")\n");
            }
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("no", String.valueOf(no));
        String title = text(ep, "title");
        vars.put("title", title == null ? "" : title);
        vars.put("scriptText", scriptText);
        vars.put("assetTable", table.length() == 0 ? "（画布里还没有角色和场景，直接用文字写，不要写 @ 引用）" : table.toString().trim());
        int min = clampMin(minSec, maxSec);
        vars.put("maxSec", String.valueOf(maxSec));
        vars.put("minSec", String.valueOf(min));
        vars.put("episodeDurationSec", String.valueOf(episodeDurationSec(doc.path("script"))));
        vars.put("styleClause", styleClause(doc));
        TextCall call = call(PromptService.KEY_DRAMA_CANVAS_STORYBOARD, vars, 0.5, 8192);
        ObjectNode meta = F.objectNode();
        meta.put("no", no);
        meta.put("maxSec", maxSec);
        meta.put("minSec", min);
        meta.set("ids", ids);
        return new TextPlan(PromptService.KEY_DRAMA_CANVAS_STORYBOARD, "storyboard:" + no,
                "画布 · 第 " + no + " 集分镜脚本", List.of(call), meta);
    }

    /** 分批调用时 {@link #CARRY} 换成什么：outline = 前一批最后几集；extract = 已拆出的角色 / 场景名字。 */
    public static String carryFor(String kind, ObjectNode meta, List<JsonNode> doneBatches) {
        if ("outline".equals(meta.path("stage").asText())) {
            List<JsonNode> all = new ArrayList<>();
            for (JsonNode b : doneBatches) b.forEach(all::add);
            if (all.isEmpty()) return "";
            StringBuilder sb = new StringBuilder("前面几集已经写好了（只用来接上剧情，不要重写、不要重复）：\n");
            for (JsonNode e : all.subList(Math.max(0, all.size() - 5), all.size())) {
                sb.append("第 ").append(e.path("no").asInt()).append(" 集《").append(e.path("title").asText())
                        .append("》：").append(e.path("summary").asText()).append("\n");
            }
            return sb.toString();
        }
        if ("extract".equals(kind)) {
            List<JsonNode> sources = new ArrayList<>();
            sources.add(meta.path("existing"));
            sources.addAll(doneBatches);
            ObjectNode merged = mergeExtract(sources);
            if (merged.path("characters").isEmpty() && merged.path("scenes").isEmpty()) return "";
            StringBuilder sb = new StringBuilder("前面已经有这些角色和场景（同一个人、同一个地方沿用这里的名字，不要换叫法）：\n");
            for (JsonNode c : merged.path("characters")) {
                sb.append("角色：").append(c.path("name").asText());
                List<String> looks = new ArrayList<>();
                c.path("looks").forEach(l -> looks.add(l.path("name").asText()));
                if (!looks.isEmpty()) sb.append("（造型：").append(String.join("、", looks)).append("）");
                sb.append("\n");
            }
            List<String> scenes = new ArrayList<>();
            merged.path("scenes").forEach(s -> scenes.add(s.path("name").asText()));
            if (!scenes.isEmpty()) sb.append("场景：").append(String.join("、", scenes)).append("\n");
            return sb.toString();
        }
        return "";
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 文字类：输出校验（不合格一律抛 502 AI_CALL_FAILED，由 worker 退款）
    // ═════════════════════════════════════════════════════════════════════════

    /** setting → {text}。 */
    public static ObjectNode parseSetting(String content) {
        JsonNode root = readJsonObject(content);
        String t = text(root, "text");
        if (t == null) throw badOutput("故事大纲");
        ObjectNode out = F.objectNode();
        out.put("text", t.trim());
        return out;
    }

    /** outline 一批 → [{no,title,hook,summary}]，条数必须正好是 toNo-fromNo+1；集号按顺序重排。 */
    public static ArrayNode parseOutline(String content, int fromNo, int toNo) {
        JsonNode root = readJsonObject(content);
        JsonNode eps = root.get("episodes");
        int want = toNo - fromNo + 1;
        if (eps == null || !eps.isArray() || eps.size() != want) throw badOutput("分集剧情");
        ArrayNode out = F.arrayNode();
        int i = 0;
        for (JsonNode e : eps) {
            String title = text(e, "title");
            String hook = text(e, "hook");
            String summary = text(e, "summary");
            if (title == null || hook == null || summary == null) throw badOutput("分集剧情");
            out.addObject().put("no", fromNo + i).put("title", title.trim()).put("hook", hook.trim())
                    .put("summary", summary.trim());
            i++;
        }
        return out;
    }

    /** episode → {no,title,text}。正文必须有；标题缺了用分集剧情 / 原剧本里的标题（那是文档里本来就有的，不是编的）。 */
    public static ObjectNode parseEpisode(String content, int no, String fallbackTitle) {
        JsonNode root = readJsonObject(content);
        String body = text(root, "text");
        if (body == null) throw badOutput("剧本");
        String title = text(root, "title");
        if (title == null) title = fallbackTitle != null ? fallbackTitle : "第 " + no + " 集";
        ObjectNode out = F.objectNode();
        out.put("no", no);
        out.put("title", title.trim());
        out.put("text", body.strip());
        return out;
    }

    /**
     * extract 一批 → {characters, scenes, notes}（已规范化）。出现集数里超出 1..maxEpisodeNo 的丢掉并在 notes 里说。
     * 角色必须有名字和至少一个造型、造型和场景必须有名字和描述；角色和场景一个都没有 = 输出不可用。
     */
    public static ObjectNode parseExtractBatch(String content, int maxEpisodeNo) {
        JsonNode root = readJsonObject(content);
        JsonNode chars = root.get("characters");
        JsonNode scenes = root.get("scenes");
        if ((chars != null && !chars.isArray()) || (scenes != null && !scenes.isArray())) throw badOutput("角色和场景");
        List<String> notes = new ArrayList<>();
        for (JsonNode n : root.path("notes")) if (n.isTextual() && !n.asText().isBlank()) notes.add(n.asText().trim());
        Set<String> dropped = new TreeSet<>();
        ArrayNode outChars = F.arrayNode();
        if (chars != null) {
            for (JsonNode c : chars) {
                String name = text(c, "name");
                JsonNode looks = c.get("looks");
                if (name == null || looks == null || !looks.isArray() || looks.isEmpty()) throw badOutput("角色和场景");
                ObjectNode oc = outChars.addObject();
                oc.put("name", name.trim());
                oc.put("role", normalizeRole(text(c, "role")));
                oc.put("bio", nz(text(c, "bio")).trim());
                ArrayNode ol = oc.putArray("looks");
                for (JsonNode l : looks) {
                    String ln = text(l, "name");
                    String lp = text(l, "prompt");
                    if (ln == null || lp == null) throw badOutput("角色和场景");
                    ObjectNode o = ol.addObject();
                    o.put("name", ln.trim());
                    o.put("prompt", lp.trim());
                    o.set("episodes", episodes(l.path("episodes"), maxEpisodeNo, dropped));
                }
            }
        }
        ArrayNode outScenes = F.arrayNode();
        if (scenes != null) {
            for (JsonNode s : scenes) {
                String name = text(s, "name");
                String prompt = text(s, "prompt");
                if (name == null || prompt == null) throw badOutput("角色和场景");
                ObjectNode o = outScenes.addObject();
                o.put("name", name.trim());
                o.put("prompt", prompt.trim());
                o.set("episodes", episodes(s.path("episodes"), maxEpisodeNo, dropped));
            }
        }
        if (outChars.isEmpty() && outScenes.isEmpty()) throw badOutput("角色和场景");
        if (!dropped.isEmpty()) {
            notes.add("模型写了剧本里没有的集数（" + String.join("、", dropped) + "），已去掉。");
        }
        ObjectNode out = F.objectNode();
        out.set("characters", outChars);
        out.set("scenes", outScenes);
        ArrayNode on = out.putArray("notes");
        notes.forEach(on::add);
        return out;
    }

    /**
     * 按名字合并多批拆出来的结果（与前端合进文档的规则同一套：角色按名字、造型按角色内名字、场景按名字；
     * 先出现的描述保留，出现集数取并集，角色定位取更重要的那个，notes 去重拼接）。
     */
    public static ObjectNode mergeExtract(List<JsonNode> batches) {
        Map<String, ObjectNode> chars = new LinkedHashMap<>();
        Map<String, Map<String, ObjectNode>> looks = new LinkedHashMap<>();
        Map<String, ObjectNode> scenes = new LinkedHashMap<>();
        Set<String> notes = new LinkedHashSet<>();
        for (JsonNode b : batches) {
            if (b == null) continue;
            for (JsonNode c : b.path("characters")) {
                String name = nz(text(c, "name")).trim();
                if (name.isEmpty()) continue;
                ObjectNode oc = chars.computeIfAbsent(name, k -> {
                    ObjectNode o = F.objectNode();
                    o.put("name", k);
                    o.put("role", "extra");
                    o.put("bio", "");
                    return o;
                });
                String role = text(c, "role");
                if (role != null && rolePriority(role) > rolePriority(oc.path("role").asText())) oc.put("role", role);
                if (oc.path("bio").asText().isBlank() && text(c, "bio") != null) oc.put("bio", text(c, "bio"));
                Map<String, ObjectNode> lm = looks.computeIfAbsent(name, k -> new LinkedHashMap<>());
                for (JsonNode l : c.path("looks")) {
                    String ln = nz(text(l, "name")).trim();
                    if (ln.isEmpty()) continue;
                    ObjectNode ol = lm.get(ln);
                    if (ol == null) {
                        ol = F.objectNode();
                        ol.put("name", ln);
                        ol.put("prompt", nz(text(l, "prompt")));
                        ol.putArray("episodes");
                        lm.put(ln, ol);
                    } else if (ol.path("prompt").asText().isBlank() && text(l, "prompt") != null) {
                        ol.put("prompt", text(l, "prompt"));
                    }
                    ol.set("episodes", unionInts(ol.path("episodes"), l.path("episodes")));
                }
            }
            for (JsonNode s : b.path("scenes")) {
                String name = nz(text(s, "name")).trim();
                if (name.isEmpty()) continue;
                ObjectNode os = scenes.get(name);
                if (os == null) {
                    os = F.objectNode();
                    os.put("name", name);
                    os.put("prompt", nz(text(s, "prompt")));
                    os.putArray("episodes");
                    scenes.put(name, os);
                } else if (os.path("prompt").asText().isBlank() && text(s, "prompt") != null) {
                    os.put("prompt", text(s, "prompt"));
                }
                os.set("episodes", unionInts(os.path("episodes"), s.path("episodes")));
            }
            for (JsonNode n : b.path("notes")) if (n.isTextual() && !n.asText().isBlank()) notes.add(n.asText());
        }
        ObjectNode out = F.objectNode();
        ArrayNode oc = out.putArray("characters");
        for (Map.Entry<String, ObjectNode> e : chars.entrySet()) {
            ObjectNode c = e.getValue();
            ArrayNode ls = c.putArray("looks");
            looks.getOrDefault(e.getKey(), Map.of()).values().forEach(ls::add);
            oc.add(c);
        }
        ArrayNode os = out.putArray("scenes");
        scenes.values().forEach(os::add);
        ArrayNode on = out.putArray("notes");
        notes.forEach(on::add);
        return out;
    }

    /**
     * storyboard → {episodeNo, segments[{text,durationSec}], notes}。服务端校验（前端不许信模型）：
     * <ul>
     *   <li>@ 引用的 id 必须在文档里（提交时的快照）存在，不存在的标记换成纯文字名字，notes 里说明；</li>
     *   <li>每行开头的时长规范成「（N 秒）」；片段时长 = 各行之和（向上取整），模型自己报的数只在没写行时长时用；</li>
     *   <li>单个镜头超过上限 → 改成上限并说明；片段总长超过上限 → 按镜头拆成几段并说明（内容一个字不改）。</li>
     *   <li>片段比下限 {@code minSec}（所选视频模型一条最短多少秒）短 → 并进相邻片段（先看后一段、再看前一段，
     *       合起来不超过上限才并；文本用换行接起来，内容一个字不改）并说明；两边都放不下就保留，说明要写长一点。</li>
     * </ul>
     */
    public static ObjectNode parseStoryboard(String content, int episodeNo, int maxSec, int minSec, JsonNode ids) {
        JsonNode root = readJsonObject(content);
        JsonNode segs = root.get("segments");
        if (segs == null || !segs.isArray() || segs.isEmpty()) throw badOutput("分镜脚本");
        List<String> notes = new ArrayList<>();
        for (JsonNode n : root.path("notes")) if (n.isTextual() && !n.asText().isBlank()) notes.add(n.asText().trim());
        Set<String> lookIds = idSet(ids.path("look"));
        Set<String> sceneIds = idSet(ids.path("scene"));
        Set<String> materialIds = idSet(ids.path("material"));
        Set<String> unknown = new LinkedHashSet<>();

        ArrayNode out = F.arrayNode();
        int segNo = 0;
        for (JsonNode s : segs) {
            segNo++;
            String raw = text(s, "text");
            if (raw == null) throw badOutput("分镜脚本");
            String t = sanitizeRefs(raw.strip(), lookIds, sceneIds, materialIds, unknown);
            List<Shot> shots = new ArrayList<>();
            boolean anyTimed = false;
            for (String line : t.split("\n")) {
                if (line.isBlank()) continue;
                Matcher m = LINE_DURATION.matcher(line);
                if (m.find()) {
                    anyTimed = true;
                    double d = Double.parseDouble(m.group(1));
                    String rest = line.substring(m.end()).stripLeading();
                    if (d > maxSec) {
                        notes.add("第 " + segNo + " 段有个镜头写了 " + fmtSec(d) + " 秒，超过单段上限 " + maxSec + " 秒，改成了 " + maxSec + " 秒。");
                        d = maxSec;
                    }
                    if (d <= 0) d = 1;
                    shots.add(new Shot(d, rest));
                } else {
                    shots.add(new Shot(-1, line.strip()));
                }
            }
            if (shots.isEmpty()) throw badOutput("分镜脚本");
            if (!anyTimed) {
                JsonNode dn = s.get("durationSec");
                if (dn == null || !dn.isNumber()) throw badOutput("分镜脚本");
                int d = (int) Math.ceil(dn.asDouble());
                if (d > maxSec) {
                    notes.add("第 " + segNo + " 段写了 " + d + " 秒，超过单段上限 " + maxSec + " 秒，按上限算。");
                    d = maxSec;
                }
                out.addObject().put("text", joinShots(shots)).put("durationSec", Math.max(1, d))
                        .put(EXACT_SEC, Math.max(1, d));
                continue;
            }
            // 按镜头贪心装段：一段不超过 maxSec；没写时长的行跟着上一行走
            List<List<Shot>> parts = new ArrayList<>();
            List<Shot> curPart = new ArrayList<>();
            double curSum = 0;
            for (Shot sh : shots) {
                if (sh.sec() > 0 && !curPart.isEmpty() && curSum + sh.sec() > maxSec + 1e-9) {
                    parts.add(curPart);
                    curPart = new ArrayList<>();
                    curSum = 0;
                }
                curPart.add(sh);
                if (sh.sec() > 0) curSum += sh.sec();
            }
            if (!curPart.isEmpty()) parts.add(curPart);
            if (parts.size() > 1) {
                notes.add("第 " + segNo + " 段总长超过单段上限 " + maxSec + " 秒，按镜头拆成了 " + parts.size() + " 段。");
            }
            for (List<Shot> p : parts) {
                double sum = 0;
                for (Shot sh : p) if (sh.sec() > 0) sum += sh.sec();
                out.addObject().put("text", joinShots(p)).put("durationSec", ceilSec(sum)).put(EXACT_SEC, sum);
            }
        }
        mergeShortSegments(out, clampMin(minSec, maxSec), maxSec, notes);
        for (JsonNode seg : out) ((ObjectNode) seg).remove(EXACT_SEC);
        if (!unknown.isEmpty()) {
            notes.add("有 " + unknown.size() + " 处引用在画布里找不到（" + String.join("、", unknown) + "），改成了纯文字。");
        }
        ObjectNode res = F.objectNode();
        res.put("episodeNo", episodeNo);
        res.set("segments", out);
        ArrayNode on = res.putArray("notes");
        notes.forEach(on::add);
        return res;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 出图：编译
    // ═════════════════════════════════════════════════════════════════════════

    /** 一张候选参考图：来自连线 / @ 引用的造型、场景或素材图挑中的那张。 */
    public record RefImage(String key, String label, String kind) {}

    /**
     * 出图编译结果（冻结之前全部算好）。
     *
     * @param requestedKeys 文档里连进来 / @ 到的全部参考图 key（归属闸要全部过一遍，不只是送到模型的那几张）
     * @param appliedKeys   真正送给模型的（按上限裁剪、剔掉模型取不到的之后）
     */
    public record ImageCompile(String target, String label, String keyPrefix, String promptKey, String prompt,
                               String ratio, List<String> requestedKeys, List<String> appliedKeys, List<String> notes) {}

    /**
     * 造型 / 场景 / 素材图 / 片段首帧出图。
     *
     * @param maxRefImages 出图端点收的参考图上限（候选 capability）
     * @param deliverable  这个 key 派生出的地址外部模型取不取得到（本地开发环境的相对地址取不到）
     * @param fill         模板填充（{@code DramaRenderService.fillMediaPrompt}：模板未配置 503）
     */
    public ImageCompile image(JsonNode doc, String canvasRatio, CanvasImageTarget target, String requestedRatio,
                              int maxRefImages, Predicate<String> deliverable, MediaFill fill) {
        if (target == null || target.kind() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_INVALID", "要给谁出图？");
        }
        String ratio = normalizeRatio(requestedRatio);
        List<String> notes = new ArrayList<>();
        List<RefImage> refs = new ArrayList<>();
        List<String> texts = new ArrayList<>();
        String kind = target.kind().trim().toLowerCase(Locale.ROOT);
        String targetStr;
        String label;
        String keyPrefix;
        String promptKey;
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("styleClause", mediaStyleClause(doc));
        switch (kind) {
            case "look" -> {
                String id = requireId(target.id());
                JsonNode look = DramaCanvasDocs.findLook(doc, id).orElseThrow(() -> targetNotFound("这个造型"));
                String chName = DramaCanvasDocs.findCharacterOfLook(doc, id).map(c -> nz(text(c, "name"))).orElse("");
                String name = (chName.isEmpty() ? "" : chName + "·") + nz(text(look, "name"));
                String prompt = text(look, "prompt");
                if (prompt == null) throw promptEmpty("先写这个造型的外貌描述，再出图。");
                collectEdgeRefs(doc, id, refs, texts, notes);
                vars.put("name", name);
                vars.put("prompt", prompt);
                ratio = ratio != null ? ratio : "9:16";
                targetStr = "look:" + id;
                label = "画布 · 造型出图 · " + name;
                keyPrefix = "drama/canvas/looks/";
                promptKey = PromptService.KEY_DRAMA_CANVAS_LOOK_IMAGE;
            }
            case "scene" -> {
                String id = requireId(target.id());
                JsonNode scene = DramaCanvasDocs.findScene(doc, id).orElseThrow(() -> targetNotFound("这个场景"));
                String prompt = text(scene, "prompt");
                if (prompt == null) throw promptEmpty("先写这个场景的描述，再出图。");
                collectEdgeRefs(doc, id, refs, texts, notes);
                vars.put("name", nz(text(scene, "name")));
                vars.put("prompt", prompt);
                ratio = ratio != null ? ratio : canvasRatio;
                targetStr = "scene:" + id;
                label = "画布 · 场景出图 · " + nz(text(scene, "name"));
                keyPrefix = "drama/canvas/scenes/";
                promptKey = PromptService.KEY_DRAMA_CANVAS_SCENE_IMAGE;
            }
            case "material" -> {
                String id = requireId(target.id());
                JsonNode m = DramaCanvasDocs.findMaterial(doc, id).orElseThrow(() -> targetNotFound("这个素材"));
                if (!"image".equals(text(m, "kind"))) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_MATERIAL_NOT_IMAGE",
                            "文字素材不能出图；要出图的话新建一张素材图。");
                }
                String prompt = text(m, "prompt");
                if (prompt == null) throw promptEmpty("先写这张素材图要画什么，再出图。");
                collectEdgeRefs(doc, id, refs, texts, notes);
                vars.put("name", nz(text(m, "name")));
                vars.put("prompt", prompt);
                ratio = ratio != null ? ratio : canvasRatio;
                targetStr = "material:" + id;
                label = "画布 · 素材出图 · " + nz(text(m, "name"));
                keyPrefix = "drama/canvas/materials/";
                promptKey = PromptService.KEY_DRAMA_CANVAS_MATERIAL_IMAGE;
            }
            case "segment" -> {
                if (target.episodeNo() == null || target.segmentId() == null || target.segmentId().isBlank()) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_INVALID", "要给哪个片段出首帧？");
                }
                int no = target.episodeNo();
                String segId = target.segmentId().trim();
                JsonNode seg = DramaCanvasDocs.findSegment(doc, no, segId)
                        .orElseThrow(() -> BusinessException.notFound("DRAMA_CANVAS_SEGMENT_NOT_FOUND", "找不到这个片段，刷新后再试。"));
                String raw = nz(text(seg, "text"));
                String plain = DramaCanvasDocs.stripRefs(raw).strip();
                if (plain.isEmpty()) throw promptEmpty("先写这个片段的分镜脚本，再出首帧。");
                collectSegmentRefs(doc, raw, refs, texts, notes);
                vars.put("firstShot", stripLineDuration(firstLine(plain)));
                vars.put("segmentText", plain);
                ratio = canvasRatio; // 首帧强制跟画布（出来就要直接当视频首帧用）
                targetStr = "frame:" + no + ":" + segId;
                label = "画布 · 第 " + no + " 集片段首帧";
                keyPrefix = "drama/canvas/frames/";
                promptKey = PromptService.KEY_DRAMA_CANVAS_FRAME_IMAGE;
            }
            default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_INVALID", "要给谁出图？");
        }

        // 参考图：去重 → 全部进归属闸；送给模型的按上限裁剪、剔掉模型取不到的
        List<String> requested = new ArrayList<>();
        List<RefImage> unique = new ArrayList<>();
        for (RefImage r : refs) {
            if (!requested.contains(r.key())) {
                requested.add(r.key());
                unique.add(r);
            }
        }
        List<RefImage> applied = new ArrayList<>();
        int overLimit = 0;
        int undeliverable = 0;
        for (RefImage r : unique) {
            if (applied.size() >= Math.max(0, maxRefImages)) {
                overLimit++;
            } else if (deliverable != null && !deliverable.test(r.key())) {
                undeliverable++;
            } else {
                applied.add(r);
            }
        }
        if (overLimit > 0) {
            notes.add(maxRefImages <= 0
                    ? "这个出图模型不看参考图，连进来的 " + unique.size() + " 张没用上。"
                    : "参考图超过 " + maxRefImages + " 张，后面的 " + overLimit + " 张没用上。");
        }
        if (undeliverable > 0) {
            notes.add("有 " + undeliverable + " 张参考图的地址模型取不到（本地开发环境），这次没用上。");
        }
        vars.put("refClause", refClause(applied));
        vars.put("textClause", texts.isEmpty() ? "" : "补充说明：" + String.join("；", texts) + "。");
        vars.put("ratioClause", ratioClause(ratio));
        String prompt = fill.fill(promptKey, vars, "canvas-" + kind);
        List<String> appliedKeys = new ArrayList<>();
        applied.forEach(r -> appliedKeys.add(r.key()));
        return new ImageCompile(targetStr, label, keyPrefix, promptKey, prompt, ratio, requested, appliedKeys, notes);
    }

    /** 模板填充（{@code DramaRenderService.fillMediaPrompt} 的形状），单测里可以换成直接填。 */
    @FunctionalInterface
    public interface MediaFill {
        String fill(String promptKey, Map<String, String> vars, String kind);
    }

    /** 片段出视频的模板变量：风格 + 片段文本（换掉 @ 标记，保留每行「（N 秒）」让模型按时长切镜头）+ 画幅。 */
    public static Map<String, String> videoVars(JsonNode doc, JsonNode segment, String canvasRatio) {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("styleClause", mediaStyleClause(doc));
        vars.put("segmentText", DramaCanvasDocs.stripRefs(nz(text(segment, "text"))).strip());
        vars.put("ratioClause", ratioClause(canvasRatio));
        return vars;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 内部
    // ═════════════════════════════════════════════════════════════════════════

    private TextCall call(String key, Map<String, String> vars, double defaultTemp, int defaultMaxTokens) {
        PromptService.ResolvedPrompt p = prompts.resolve(key);
        if (p == null || "code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "画布这一步用的提示词还没配置（promptKey=" + key + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        double temperature = p.params() != null && p.params().temperature() != null ? p.params().temperature() : defaultTemp;
        int maxTokens = p.params() != null && p.params().maxTokens() != null && p.params().maxTokens() > 0
                ? p.params().maxTokens() : defaultMaxTokens;
        boolean jsonMode = p.params() == null || p.params().jsonMode() == null || p.params().jsonMode();
        return new TextCall(nz(p.system()), PromptService.fill(p.userTemplate(), vars), temperature, maxTokens, jsonMode);
    }

    /** 已有的角色（含造型名）与场景名字，给 extract 当「沿用这些叫法」的上下文。 */
    private static ObjectNode existingCast(JsonNode doc) {
        ObjectNode out = F.objectNode();
        ArrayNode chars = out.putArray("characters");
        for (JsonNode c : DramaCanvasDocs.arr(doc, "characters")) {
            String name = text(c, "name");
            if (name == null) continue;
            ObjectNode oc = chars.addObject();
            oc.put("name", name);
            ArrayNode ls = oc.putArray("looks");
            for (JsonNode l : DramaCanvasDocs.arr(c, "looks")) {
                String ln = text(l, "name");
                if (ln != null) ls.addObject().put("name", ln);
            }
        }
        ArrayNode scenes = out.putArray("scenes");
        for (JsonNode s : DramaCanvasDocs.arr(doc, "scenes")) {
            String name = text(s, "name");
            if (name != null) scenes.addObject().put("name", name);
        }
        return out;
    }

    /** 连到 target 的上游：造型 / 场景 / 素材图 → 挑中的那张当参考；文字素材 → 拼进提示词；其余组合忽略。 */
    private static void collectEdgeRefs(JsonNode doc, String targetId, List<RefImage> refs, List<String> texts,
                                        List<String> notes) {
        for (JsonNode e : DramaCanvasDocs.incomingEdges(doc, targetId)) {
            String src = text(e, "source");
            if (src == null || src.equals(targetId)) continue;
            addSource(doc, src, null, refs, texts, notes);
        }
    }

    /** 片段文本里 @ 到的造型 / 场景 / 素材（按出现顺序）。找不到的 id 只提示、不算参考。 */
    private static void collectSegmentRefs(JsonNode doc, String text, List<RefImage> refs, List<String> texts,
                                           List<String> notes) {
        Set<String> missing = new LinkedHashSet<>();
        for (DramaCanvasDocs.Ref r : DramaCanvasDocs.parseRefs(text)) {
            if (!addSource(doc, r.id(), r.kind(), refs, texts, notes)) missing.add(r.label());
        }
        if (!missing.isEmpty()) {
            notes.add("「" + String.join("」「", missing) + "」在画布里找不到了，没当参考。");
        }
    }

    /**
     * 把一个来源节点加进参考。{@code kindHint} = null 时按 id 在造型 / 场景 / 素材里依次找（连线不带类型）。
     *
     * @return 找到了这个节点（有没有图都算找到）
     */
    private static boolean addSource(JsonNode doc, String id, String kindHint, List<RefImage> refs, List<String> texts,
                                     List<String> notes) {
        if (kindHint == null || "look".equals(kindHint)) {
            Optional<JsonNode> look = DramaCanvasDocs.findLook(doc, id);
            if (look.isPresent()) {
                String ch = DramaCanvasDocs.findCharacterOfLook(doc, id).map(c -> nz(text(c, "name"))).orElse("");
                String name = (ch.isEmpty() ? "" : ch + "·") + nz(text(look.get(), "name"));
                addPicked(look.get().path("images"), name, "look", refs, notes);
                return true;
            }
            if (kindHint != null) return false;
        }
        if (kindHint == null || "scene".equals(kindHint)) {
            Optional<JsonNode> scene = DramaCanvasDocs.findScene(doc, id);
            if (scene.isPresent()) {
                addPicked(scene.get().path("images"), nz(text(scene.get(), "name")), "scene", refs, notes);
                return true;
            }
            if (kindHint != null) return false;
        }
        Optional<JsonNode> m = DramaCanvasDocs.findMaterial(doc, id);
        if (m.isEmpty()) return false;
        if ("text".equals(text(m.get(), "kind"))) {
            String t = text(m.get(), "text");
            if (t != null) texts.add(t.strip());
        } else {
            addPicked(m.get().path("images"), nz(text(m.get(), "name")), "material", refs, notes);
        }
        return true;
    }

    private static void addPicked(JsonNode imageSet, String name, String kind, List<RefImage> refs, List<String> notes) {
        Optional<String> key = DramaCanvasDocs.pickedImageKey(imageSet);
        if (key.isPresent()) {
            refs.add(new RefImage(key.get(), name, kind));
        } else {
            notes.add("「" + name + "」还没有图，没当参考。");
        }
    }

    private static String refClause(List<RefImage> applied) {
        if (applied.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("参考图按顺序：");
        for (int i = 0; i < applied.size(); i++) {
            RefImage r = applied.get(i);
            if (i > 0) sb.append("；");
            sb.append("图").append(i + 1).append(" = ").append(r.label());
            switch (r.kind()) {
                case "look" -> sb.append("（人物，照着这张的长相、发型和服装）");
                case "scene" -> sb.append("（场景，照着这张的环境和光线）");
                default -> sb.append("（参考素材）");
            }
        }
        return sb.append("。").toString();
    }

    /** 片段文本里 id 不在文档里的 @ 标记换成显示名；合法的保留原样。 */
    static String sanitizeRefs(String text, Set<String> lookIds, Set<String> sceneIds, Set<String> materialIds,
                               Set<String> unknown) {
        Matcher m = DramaCanvasDocs.REF_PATTERN.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String kind = m.group(2);
            String id = m.group(3);
            boolean ok = switch (kind) {
                case "look" -> lookIds.contains(id);
                case "scene" -> sceneIds.contains(id);
                default -> materialIds.contains(id);
            };
            if (!ok) unknown.add(m.group(1));
            m.appendReplacement(sb, Matcher.quoteReplacement(ok ? m.group() : m.group(1)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    /** 行首时长：「（4 秒）」「(4秒)」「（时长：4.0 秒）」「（4s）」都认。 */
    static final Pattern LINE_DURATION =
            Pattern.compile("^\\s*[（(]\\s*(?:时长\\s*[:：]\\s*)?(\\d+(?:\\.\\d+)?)\\s*(?:秒|s|S)\\s*[）)]");

    private record Shot(double sec, String text) {}

    /**
     * 装段 / 并段时用的精确秒数（各行时长之和，不取整）；出 wire 前删掉。
     * 并段要按精确和重新取整：两段 2.1 秒各自取整是 3 + 3 = 6，实际只要 ceil(4.2) = 5（Codex 评审 P2）。
     */
    private static final String EXACT_SEC = "_exactSec";

    /** 片段时长：精确和向上取整，至少 1 秒。 */
    private static int ceilSec(double exact) {
        return (int) Math.max(1, Math.ceil(exact - 1e-9));
    }

    private static double exactOf(ObjectNode seg) {
        JsonNode e = seg.get(EXACT_SEC);
        return e != null && e.isNumber() ? e.asDouble() : seg.path("durationSec").asDouble();
    }

    /** 片段下限：夹到 1..maxSec（下限比上限还大时没法同时满足，按上限算）。 */
    private static int clampMin(int minSec, int maxSec) {
        return Math.max(1, Math.min(minSec, maxSec));
    }

    /**
     * 比 {@code minSec} 短的片段并进相邻片段（v0.198.1：H3 一条至少 5 秒，模型切出 3、4 秒的片段时视频根本生成不了）。
     * 先试后一段、再试前一段，合起来不超过 {@code maxSec} 才并；文本按换行接起来，内容不改。
     * 并完的那段还短就接着并；两边都放不下的保留原样，notes 里说明要写长一点。
     * 「第 N 段」按并之前它在这一集里的位置数。
     */
    private static void mergeShortSegments(ArrayNode segs, int minSec, int maxSec, List<String> notes) {
        int i = 0;
        int shift = 0; // 前面已经并掉了几段：notes 里的段号按合并前的位置报
        while (i < segs.size()) {
            ObjectNode cur = (ObjectNode) segs.get(i);
            int d = cur.path("durationSec").asInt();
            double exact = exactOf(cur);
            if (d >= minSec) {
                i++;
                continue;
            }
            int no = i + 1 + shift;
            ObjectNode next = i + 1 < segs.size() ? (ObjectNode) segs.get(i + 1) : null;
            ObjectNode prev = i > 0 ? (ObjectNode) segs.get(i - 1) : null;
            if (next != null && ceilSec(exact + exactOf(next)) <= maxSec) {
                double sum = exact + exactOf(next);
                next.put("text", cur.path("text").asText() + "\n" + next.path("text").asText());
                next.put("durationSec", ceilSec(sum)).put(EXACT_SEC, sum);
                segs.remove(i);
                shift++;
                notes.add("第 " + no + " 段只有 " + d + " 秒，视频模型一条至少 " + minSec + " 秒，和后一段合在了一起。");
                // 不前进：并出来的这段（现在在 i）还短的话接着并
            } else if (prev != null && ceilSec(exactOf(prev) + exact) <= maxSec) {
                double sum = exactOf(prev) + exact;
                prev.put("text", prev.path("text").asText() + "\n" + cur.path("text").asText());
                prev.put("durationSec", ceilSec(sum)).put(EXACT_SEC, sum);
                segs.remove(i);
                shift++;
                notes.add("第 " + no + " 段只有 " + d + " 秒，视频模型一条至少 " + minSec + " 秒，和前一段合在了一起。");
            } else {
                notes.add("第 " + no + " 段只有 " + d + " 秒，视频模型一条至少 " + minSec + " 秒，生成视频前把它写长一点。");
                i++;
            }
        }
    }

    private static String joinShots(List<Shot> shots) {
        StringBuilder sb = new StringBuilder();
        for (Shot s : shots) {
            if (sb.length() > 0) sb.append("\n");
            if (s.sec() > 0) sb.append("（").append(fmtSec(s.sec())).append(" 秒）");
            sb.append(s.text());
        }
        return sb.toString();
    }

    static String fmtSec(double d) {
        if (Math.abs(d - Math.rint(d)) < 1e-9) return String.valueOf((long) Math.rint(d));
        return String.valueOf(Math.round(d * 10) / 10.0);
    }

    private static String stripLineDuration(String line) {
        Matcher m = LINE_DURATION.matcher(line);
        return m.find() ? line.substring(m.end()).strip() : line.strip();
    }

    private static String firstLine(String s) {
        for (String l : s.split("\n")) if (!l.isBlank()) return l;
        return s;
    }

    private static ArrayNode episodes(JsonNode arr, int maxNo, Set<String> dropped) {
        TreeSet<Integer> set = new TreeSet<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode n : arr) {
                if (!n.isNumber()) continue;
                int v = n.asInt();
                if (v >= 1 && v <= maxNo) set.add(v);
                else dropped.add(String.valueOf(v));
            }
        }
        ArrayNode out = F.arrayNode();
        set.forEach(out::add);
        return out;
    }

    private static ArrayNode unionInts(JsonNode a, JsonNode b) {
        TreeSet<Integer> set = new TreeSet<>();
        for (JsonNode n : a) if (n.isNumber()) set.add(n.asInt());
        for (JsonNode n : b) if (n.isNumber()) set.add(n.asInt());
        ArrayNode out = F.arrayNode();
        set.forEach(out::add);
        return out;
    }

    private static String normalizeRole(String raw) {
        String r = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (r) {
            case "lead", "主角", "主要角色", "男主", "女主" -> "lead";
            case "support", "配角", "重要配角" -> "support";
            case "extra", "群演", "路人", "龙套", "次要角色" -> "extra";
            default -> throw badOutput("角色和场景");
        };
    }

    private static int rolePriority(String role) {
        return switch (role == null ? "" : role) {
            case "lead" -> 3;
            case "support" -> 2;
            case "extra" -> 1;
            default -> 0;
        };
    }

    private static Set<String> idSet(JsonNode arr) {
        Set<String> out = new LinkedHashSet<>();
        for (JsonNode n : arr) if (n.isTextual()) out.add(n.asText());
        return out;
    }

    private static boolean containsInt(JsonNode arr, int v) {
        for (JsonNode n : arr) if (n.isNumber() && n.asInt() == v) return true;
        return false;
    }

    private static Optional<JsonNode> byNo(JsonNode arr, int no) {
        if (arr == null || !arr.isArray()) return Optional.empty();
        for (JsonNode n : arr) {
            JsonNode v = n.get("no");
            if (v != null && v.isIntegralNumber() && v.asInt() == no) return Optional.of(n);
        }
        return Optional.empty();
    }

    /**
     * 模型输出 → JSON 对象：容忍 ```json 围栏和前后的废话，但必须能解析成一个对象。依次试：
     * <ol>
     *   <li>第一个「{」到最后一个「}」，原样解析；</li>
     *   <li>第一个「{」到结尾，补齐漏写的闭合符（{@link ModelJsonRepair}）。模型漏的是末尾那个「}」时，
     *       「最后一个 }」会切在半中间，把后面的内容丢掉；</li>
     *   <li>第一个「{」到最后一个「}」，补齐闭合符（结尾跟着废话时）。</li>
     * </ol>
     * 修出来的对象照样要过各自的形状校验（v0.198.1：拆角色线上每次都失败，就是模型漏写了一个「]」）。
     */
    static JsonNode readJsonObject(String content) {
        if (content == null || content.isBlank()) throw badOutput("内容");
        String s = content.strip();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            s = nl >= 0 ? s.substring(nl + 1) : s;
            int fence = s.lastIndexOf("```");
            if (fence >= 0) s = s.substring(0, fence);
        }
        int a = s.indexOf('{');
        if (a < 0) throw badOutput("内容");
        int b = s.lastIndexOf('}');
        String bounded = b > a ? s.substring(a, b + 1) : null;
        JsonNode root = parseObject(bounded);
        if (root == null) root = parseObject(ModelJsonRepair.repairUnbalancedClosers(s.substring(a)));
        // 第三种只在「最后一个 } 后面是纯废话」时才试：后面还跟着 { [ " : 说明那是没写完的 JSON，
        // 切掉再补括号会得到一个合法但少了后半截的对象（Codex 评审 P1：分镜只剩第一段，形状校验照过）。
        if (root == null && bounded != null && isPlainTrailer(s.substring(b + 1))) {
            root = parseObject(ModelJsonRepair.repairUnbalancedClosers(bounded));
        }
        if (root == null) throw badOutput("内容");
        return root;
    }

    /** 最后一个「}」之后的内容是不是纯说明文字（不含任何 JSON 结构字符）。 */
    private static boolean isPlainTrailer(String tail) {
        for (int i = 0; i < tail.length(); i++) {
            char c = tail.charAt(i);
            if (c == '{' || c == '[' || c == '"' || c == ':' || c == ',') return false;
        }
        return true;
    }

    /** 解析成 JSON 对象；null / 解析不了 / 不是对象 → null。 */
    private static JsonNode parseObject(String json) {
        if (json == null) return null;
        try {
            JsonNode n = OM.readTree(json);
            return n != null && n.isObject() ? n : null;
        } catch (Exception e) {
            return null;
        }
    }

    static BusinessException badOutput(String what) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                "这次生成的" + what + "格式不对，没法用；积分已退回，再试一次。");
    }

    private static BusinessException targetNotFound(String what) {
        return BusinessException.notFound("DRAMA_CANVAS_TARGET_NOT_FOUND", "找不到" + what + "，刷新后再试。");
    }

    private static BusinessException promptEmpty(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_PROMPT_EMPTY", message);
    }

    private static String requireId(String id) {
        if (id == null || id.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_INVALID", "要给谁出图？");
        }
        return id.trim();
    }

    static String normalizeRatio(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String r = raw.trim();
        if (!IMAGE_RATIOS.contains(r)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_RATIO_INVALID",
                    "画幅只能选 9:16、16:9、1:1、4:3 或 3:4。");
        }
        return r;
    }

    static String normalizeInstruction(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.strip();
        if (s.codePointCount(0, s.length()) > INSTRUCTION_MAX) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_INSTRUCTION_TOO_LONG",
                    "要求最多写 " + INSTRUCTION_MAX + " 个字。");
        }
        return s;
    }

    private static String instructionClause(String instr) {
        return instr == null ? "" : "这次的要求：" + instr + "\n";
    }

    private static int targetEpisodes(JsonNode script, int dflt) {
        JsonNode v = script.get("targetEpisodes");
        return v != null && v.isIntegralNumber() && v.asInt() > 0 ? Math.min(80, v.asInt()) : dflt;
    }

    private static int episodeDurationSec(JsonNode script) {
        JsonNode v = script.get("episodeDurationSec");
        return v != null && v.isIntegralNumber() && v.asInt() > 0 ? v.asInt() : 60;
    }

    /** 文字类提示词里的风格一句（没选风格就空）。 */
    static String styleClause(JsonNode doc) {
        String p = mediaStyle(doc);
        if (p.isEmpty()) return "";
        String name = text(doc.path("style"), "name");
        return "全剧风格：" + (name == null ? "" : name + "，") + p + "\n";
    }

    /** 出图 / 出视频提示词里的风格一句（「风格：……。」；没选风格 → 空）。 */
    static String mediaStyleClause(JsonNode doc) {
        String p = mediaStyle(doc);
        return p.isEmpty() ? "" : "风格：" + p + "。";
    }

    /** 全剧风格的提示词（style.id=none 或没写提示词 → 空）。 */
    static String mediaStyle(JsonNode doc) {
        JsonNode style = doc == null ? null : doc.path("style");
        if (style == null || "none".equals(text(style, "id"))) return "";
        String p = text(style, "prompt");
        return p == null ? "" : p.strip();
    }

    static String ratioClause(String ratio) {
        return switch (ratio == null ? "" : ratio) {
            case "16:9" -> "横屏 16:9 构图。";
            case "1:1" -> "方形 1:1 构图。";
            case "4:3" -> "横向 4:3 构图。";
            case "3:4" -> "竖向 3:4 构图。";
            default -> "竖屏 9:16 构图。";
        };
    }

    /** 引用标记里的显示名：去掉 ] 和换行、最多 40 个字（{@link DramaCanvasDocs#REF_PATTERN} 的约束）；空了给个默认。 */
    private static String label(String s) {
        String v = s.replace("]", "").replace("\n", " ").strip();
        if (v.isEmpty() || "·".equals(v)) return "未命名";
        return v.length() > 40 ? v.substring(0, 40) : v;
    }

    private static String tail(String s, int n) {
        return s.length() <= n ? s : "…" + s.substring(s.length() - n);
    }

    private static String text(JsonNode n, String field) {
        return DramaCanvasDocs.text(n, field);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
