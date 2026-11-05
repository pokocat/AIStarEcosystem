package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.ipstudio.prompt.StudioPromptAssembler;
import com.aistareco.aep.ipstudio.prompt.StudioPromptCallPoints;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * AI 导演台的全能创作助手：提示词、模型输出的结构校验、原文定位。纯函数，不碰作品存储；
 * 对话怎么存、建议怎么采用 / 撤销在 {@link DirectorService}。
 *
 * <p>规则（docs/ai-director-assistant.md）：每一轮绑定一个对象（scope），只允许改这个对象该改的东西；
 * 剧本改动给「原文 → 替换」的局部建议，不重写整篇；提示词范围不许反改剧情；建议只是建议，用户采用才写入。
 */
public final class DirectorAssistant {
    private DirectorAssistant() {}

    public static final Set<String> SCOPES = Set.of("work", "script", "selection", "storyboard", "clip", "prompt", "asset", "image");
    static final int MAX_PROPOSALS = 6;
    static final int MAX_MESSAGE = 2000;
    static final int MAX_SELECTION = 6000;
    static final int HISTORY = 10;

    /** 这一轮允许出现的建议类型。范围之外的建议在校验时直接丢掉（并计数），不交给用户。 */
    static List<String> allowed(String scope, boolean hasScript, boolean hasEpisodes) {
        return switch (scope) {
            case "script" -> !hasScript ? List.of("script.draft", "idea.update") : List.of("script.replace", "script.append");
            case "selection" -> List.of("script.replace");
            case "storyboard", "clip" -> List.of("clip.shots", "clip.prompt");
            case "prompt" -> List.of("clip.prompt");
            case "asset" -> List.of("asset.update");
            case "image" -> List.of("asset.update", "clip.prompt");
            default -> List.of();
        };
    }

    /** 助手一轮的提示词（环节 stage-director-assistant，正文在提示词库）：material 是作品与当前对象，text 是用户这次说的话。 */
    static DirectorPrompts.Text prompt(StudioPromptAssembler prompts, String material, String text) {
        return DirectorPrompts.text(prompts, StudioPromptCallPoints.DIRECTOR_ASSISTANT, List.of(), java.util.Map.of("input", material, "text", text));
    }

    /**
     * 结构校验（worker 内执行）：类型不在本轮范围、id 不在 material 里、缺字段的建议丢掉并计数；
     * 原文能不能在当前正文里找到不在这里判（正文可能已被用户改过），采用时再判。
     */
    static JsonNode validate(ObjectMapper om, JsonNode meta, JsonNode out) {
        String reply = DirectorPrompts.clip(plain(DirectorPrompts.text(out, "reply")), 4000);
        Set<String> allowed = DirectorPrompts.strings(meta.path("allowed"));
        Set<String> targets = DirectorPrompts.strings(meta.path("scriptTargets"));
        Set<String> clips = DirectorPrompts.strings(meta.path("clipIds"));
        Set<String> assets = DirectorPrompts.strings(meta.path("assetIds"));
        Set<String> whichAllowed = DirectorPrompts.strings(meta.path("which"));
        // 选中了一段：原文必须落在选中的文字里，超出选区的改动不交给用户（不靠模型自觉）。
        String selection = meta.path("selection").asText(null);
        ArrayNode result = om.createArrayNode();
        int dropped = 0;
        for (JsonNode p : out.path("proposals")) {
            if (result.size() >= MAX_PROPOSALS) { dropped++; continue; }
            ObjectNode r = proposal(om, p, allowed, targets, clips, assets, whichAllowed);
            if (r != null && selection != null && "script.replace".equals(r.path("type").asText()) && locate(selection, r.path("original").asText()) == null) r = null;
            if (r == null) dropped++; else result.add(r);
        }
        if (reply.isBlank() && result.isEmpty()) throw DirectorPrompts.bad("助手没有给出回复");
        ObjectNode r = om.createObjectNode().put("reply", reply.isBlank() ? "按你的要求整理了修改建议：" : reply).put("dropped", dropped);
        r.set("proposals", result);
        return r;
    }

    private static ObjectNode proposal(ObjectMapper om, JsonNode raw, Set<String> allowed, Set<String> targets, Set<String> clips,
                                       Set<String> assets, Set<String> whichAllowed) {
        // 这一轮只针对一个对象时，模型常省掉 id（2026-10-28 真实模型：改视频提示词不写 clipId、改资产不写 assetId）：
        // 唯一时补上；有多个可选对象时缺 id 照样丢掉，不猜。
        ObjectNode p = raw.isObject() ? ((ObjectNode) raw).deepCopy() : om.createObjectNode();
        if (DirectorPrompts.text(p, "target").isEmpty() && targets.size() == 1) p.put("target", targets.iterator().next());
        if (DirectorPrompts.text(p, "clipId").isEmpty() && clips.size() == 1) p.put("clipId", clips.iterator().next());
        if (DirectorPrompts.text(p, "assetId").isEmpty() && assets.size() == 1) p.put("assetId", assets.iterator().next());
        if (DirectorPrompts.text(p, "which").isEmpty() && whichAllowed.size() == 1) p.put("which", whichAllowed.iterator().next());
        String type = DirectorPrompts.text(p, "type");
        if (!allowed.contains(type)) return null;
        ObjectNode r = om.createObjectNode().put("type", type).put("note", DirectorPrompts.clip(DirectorPrompts.text(p, "note"), 200));
        switch (type) {
            case "script.replace" -> {
                String target = DirectorPrompts.text(p, "target"), original = DirectorPrompts.text(p, "original");
                String replacement = p.path("replacement").asText("");
                if (!targets.contains(target) || original.isBlank() || original.length() > MAX_SELECTION || replacement.length() > 12000
                        || original.equals(replacement)) return null;
                r.put("target", target).put("original", original).put("replacement", replacement);
            }
            case "script.append" -> {
                String target = DirectorPrompts.text(p, "target"), text = DirectorPrompts.text(p, "text");
                if (!targets.contains(target) || text.isBlank() || text.length() > 12000) return null;
                r.put("target", target).put("text", text);
            }
            case "script.draft" -> {
                String content = DirectorPrompts.text(p, "content");
                if (content.isBlank()) return null; // 剧本不限长度（2026-10-29），只挡明显不是剧本的短内容
                r.put("content", content).put("title", DirectorPrompts.clip(DirectorPrompts.text(p, "title"), 60))
                        .put("logline", DirectorPrompts.clip(DirectorPrompts.text(p, "logline"), 200));
            }
            case "idea.update" -> {
                String text = DirectorPrompts.text(p, "text");
                if (text.isBlank() || text.length() > 2000) return null;
                r.put("text", text);
            }
            case "clip.shots" -> {
                String clipId = DirectorPrompts.text(p, "clipId");
                JsonNode shots = p.path("shots");
                if (!clips.contains(clipId) || !shots.isArray() || shots.isEmpty() || shots.size() > 12) return null;
                ArrayNode out = r.put("clipId", clipId).putArray("shots");
                for (JsonNode s : shots) {
                    double d = s.path("durationSec").asDouble(0);
                    if (!(d > 0) || d > 60) return null;
                    ObjectNode shot = out.addObject();
                    String id = DirectorPrompts.text(s, "id");
                    if (id.isEmpty()) shot.putNull("id"); else shot.put("id", DirectorPrompts.clip(id, 40));
                    shot.put("durationSec", d).put("size", DirectorPrompts.clip(DirectorPrompts.text(s, "size"), 40))
                            .put("camera", DirectorPrompts.clip(DirectorPrompts.text(s, "camera"), 1000))
                            .put("action", DirectorPrompts.clip(DirectorPrompts.text(s, "action"), 1000))
                            .put("still", DirectorPrompts.clip(DirectorPrompts.text(s, "still"), 1000));
                    ArrayNode dialogue = shot.putArray("dialogue");
                    for (JsonNode line : s.path("dialogue")) {
                        String t = DirectorPrompts.clip(DirectorPrompts.text(line, "text"), 1000);
                        if (t.isEmpty()) continue;
                        String sp = DirectorPrompts.text(line, "speakerId");
                        ObjectNode l = dialogue.addObject();
                        if (sp.isEmpty() || "null".equals(sp)) l.putNull("speakerId"); else l.put("speakerId", DirectorPrompts.clip(sp, 40));
                        l.put("text", t);
                    }
                }
            }
            case "clip.prompt" -> {
                String clipId = DirectorPrompts.text(p, "clipId"), which = DirectorPrompts.text(p, "which"), text = DirectorPrompts.text(p, "text");
                if (!clips.contains(clipId) || !Set.of("board", "video").contains(which) || (!whichAllowed.isEmpty() && !whichAllowed.contains(which))
                        || text.isBlank() || text.length() > 7000) return null;
                r.put("clipId", clipId).put("which", which).put("text", text).put("regenerate", "board".equals(which) && p.path("regenerate").asBoolean(false));
            }
            case "asset.update" -> {
                String assetId = DirectorPrompts.text(p, "assetId");
                if (!assets.contains(assetId)) return null;
                r.put("assetId", assetId);
                boolean any = false;
                for (var f : List.of(new Object[]{"description", 2000}, new Object[]{"prompt", 4000}, new Object[]{"voiceDesc", 200})) {
                    String name = (String) f[0];
                    if (!p.hasNonNull(name)) continue;
                    String v = DirectorPrompts.text(p, name);
                    if (v.isEmpty()) continue;
                    if (v.length() > (int) f[1]) return null;
                    r.put(name, v);
                    any = true;
                }
                if (!any) return null;
                r.put("regenerate", p.path("regenerate").asBoolean(false));
            }
            default -> { return null; }
        }
        return r;
    }

    // ── 写剧本前的创意对话（有限澄清）────────────────────────────────────────

    /** AI 提问最多几轮；到上限后按已有信息和合理默认收敛，不再追问。 */
    public static final int MAX_BRIEF_ROUNDS = 2;
    static final int MAX_BRIEF_QUESTIONS = 4;

    /** 用户说这些话就不再问，直接开始写剧本。整句只由这些话（加语气词、标点）组成才算，避免把回答里的「都行」误判。 */
    static boolean saysGo(String message) {
        String t = message == null ? "" : message.replaceAll("[\\s，。！!,.~～、…]+", "").replaceAll("[吧呀啊哈呢了吗]+$", "");
        if (t.isEmpty()) return false;
        // 整句只是「你决定 / 开始写」这类话；或者明确以「直接 / 马上 / 开始 + 写 / 生成」开头（后面可以带要求，如「直接写三集」）。
        // 「写三集」「写实一点」「写成悲剧」是回答，不算（2026-10-28 review）。
        if (t.matches("^(你(来)?(决定|定|看着办|看着写)|(都)?交给你|不用(再)?问|别(再)?问|就这样|都行|随便|可以开始|开始|行开始|可以写|写|写剧本|生成|生成剧本|出剧本)$")) return true;
        return t.matches("^(那就|就|现在)?(直接|马上|立刻|立即|开始)(写|生成|出)(剧本)?.*");
    }

    /** 写剧本前问答一轮的提示词（环节 stage-director-brief）：第一轮没有用户回答。 */
    static DirectorPrompts.Text briefPrompt(StudioPromptAssembler prompts, String material, boolean opening, String text) {
        java.util.Map<String, Object> vars = new java.util.LinkedHashMap<>();
        vars.put("input", material);
        vars.put("opening", opening);
        vars.put("text", text == null ? "" : text);
        vars.put("maxQuestions", MAX_BRIEF_QUESTIONS);
        return DirectorPrompts.text(prompts, StudioPromptCallPoints.DIRECTOR_BRIEF, List.of(), vars);
    }

    static JsonNode validateBrief(ObjectMapper om, JsonNode meta, JsonNode out) {
        ObjectNode r = om.createObjectNode().put("reply", DirectorPrompts.clip(plain(DirectorPrompts.text(out, "reply")), 600));
        boolean mustConclude = meta.path("mustConclude").asBoolean(false);
        ArrayNode qs = r.putArray("questions");
        if (!mustConclude) for (JsonNode q : out.path("questions")) {
            String text = DirectorPrompts.clip(DirectorPrompts.text(q, "q"), 120);
            if (text.isEmpty() || qs.size() >= MAX_BRIEF_QUESTIONS) continue;
            ObjectNode item = qs.addObject().put("q", text);
            ArrayNode opts = item.putArray("options");
            for (JsonNode o : q.path("options")) { String v = DirectorPrompts.clip(o.asText("").trim(), 20); if (!v.isEmpty() && opts.size() < 4) opts.add(v); }
        }
        boolean ready = mustConclude || out.path("ready").asBoolean(false) || qs.isEmpty();
        if (ready) qs.removeAll();
        r.put("ready", ready).put("summary", DirectorPrompts.clip(DirectorPrompts.text(out, "summary"), 1500))
                .put("title", DirectorPrompts.clip(DirectorPrompts.text(out, "title"), 30));
        String genre = DirectorPrompts.text(out, "genre"), tone = DirectorPrompts.text(out, "tone");
        r.put("genre", DirectorPrompts.GENRES.containsKey(genre) ? genre : "").put("tone", DirectorPrompts.TONES.containsKey(tone) ? tone : "");
        if (r.path("reply").asText().isBlank() && qs.isEmpty() && r.path("summary").asText().isBlank()) throw DirectorPrompts.bad("模型没有给出回复");
        return r;
    }

    /** 界面按纯文本显示：去掉模型常带的 Markdown 强调与标题符号（2026-10-28 真实模型回复里带 **…**）。 */
    static String plain(String s) {
        String t = s.replaceAll("\\*\\*|__", "").replaceAll("(?m)^#{1,6}\\s+", "").replaceAll("(?m)^\\s*[*-]\\s+", "· ");
        // 提示词里要求了不说内部名词，真实模型仍会写（2026-10-28 实测），这里换成界面上的叫法。
        t = t.replaceAll("(一条|两条|几条)?\\s*(script\\.replace|script\\.append|script\\.draft|idea\\.update|clip\\.shots|clip\\.prompt|asset\\.update)", "$1修改建议");
        return t.replaceAll(" ?\\bdescription\\b( ?字段)? ?", "外观设定").replaceAll(" ?\\bvoiceDesc\\b ?", "音色描述").replaceAll(" ?\\bprompt\\b( ?字段)? ?", "出图提示词");
    }

    // ── 原文定位 ────────────────────────────────────────────────────────────

    /**
     * 在 content 里找 original：先逐字找；找不到再忽略空白差异找（模型常把换行、空格写得不一样）。
     * 多处相同时取第一处 —— 前端预览（director-text.ts 的 locate）用同一规则，预览看到的位置就是采用时替换的位置。
     * 返回 [start, end)，找不到返回 null。
     */
    public static int[] locate(String content, String original) {
        if (content == null || original == null || original.isEmpty()) return null;
        int at = content.indexOf(original);
        if (at >= 0) return new int[]{at, at + original.length()};
        StringBuilder norm = new StringBuilder();
        int[] map = new int[content.length() + 1];
        int n = 0;
        for (int i = 0; i < content.length(); i++) {
            char ch = content.charAt(i);
            if (Character.isWhitespace(ch)) continue;
            norm.append(ch);
            map[n++] = i;
        }
        String needle = original.replaceAll("\\s+", "");
        if (needle.isEmpty()) return null;
        int k = norm.indexOf(needle);
        if (k < 0) return null;
        return new int[]{map[k], map[k + needle.length() - 1] + 1};
    }

    /** 所有出现位置：先逐字找；一处都没有再忽略空白差异找。 */
    static java.util.List<int[]> locateAll(String content, String original) {
        java.util.List<int[]> out = new java.util.ArrayList<>();
        if (content == null || original == null || original.isEmpty()) return out;
        for (int at = content.indexOf(original); at >= 0; at = content.indexOf(original, at + 1)) out.add(new int[]{at, at + original.length()});
        if (!out.isEmpty()) return out;
        int[] first = locate(content, original);
        if (first == null) return out;
        out.add(first);
        // 宽松匹配再往后找，用来判断是否唯一
        int[] next = locate(content.substring(first[1]), original);
        if (next != null) out.add(new int[]{first[1] + next[0], first[1] + next[1]});
        return out;
    }

    static final int CONTEXT = 30;

    /** 一处文字在正文里的锚点：位置、确切文字、前后各 30 字的上下文。采用和撤销都按它找回「那一处」。 */
    static com.fasterxml.jackson.databind.node.ObjectNode anchorAt(ObjectMapper om, String content, int start, int end) {
        return om.createObjectNode().put("start", start).put("end", end).put("text", content.substring(start, end))
                .put("before", content.substring(Math.max(0, start - CONTEXT), start))
                .put("after", content.substring(end, Math.min(content.length(), end + CONTEXT)));
    }

    /**
     * 没有回复时正文快照的旧建议：只认「前文 + 文字 + 后文」整体还在的那一处（多处取离原位置最近的），不做任何宽松匹配。
     * 新建议走 {@link #mapRange}。
     */
    static int[] findAnchor(String content, String text, String before, String after, int hint) {
        String full = before + text + after;
        if (full.isEmpty()) return null;
        int best = -1;
        for (int at = content.indexOf(full); at >= 0; at = content.indexOf(full, at + 1))
            if (best < 0 || Math.abs(at + before.length() - hint) < Math.abs(best + before.length() - hint)) best = at;
        return best < 0 ? null : new int[]{best + before.length(), best + before.length() + text.length()};
    }

    /**
     * 把快照 base 里的 [start, end) 映射到用户改过之后的 current 里（按行比对）。
     * 只有这段所在的行原样还在（行内一个字没动、前后顺序连着）才映射过去；这几行被改过、删掉，
     * 或者是好几行一模一样的文字而数目变了（认不准用户改的是哪一行），一律返回 null —— 宁可不改，也不改到别处。
     * 用文字去找「那一处」做不到这点：同一人物两场说同一句话，第二场被用户改掉后，剩下的第一场在文字上和目标一模一样
     * （2026-10-28 两轮 review）。
     */
    public static int[] mapRange(String base, String current, int start, int end) {
        if (base == null || current == null || start < 0 || end < start || end > base.length()) return null;
        if (base.equals(current)) return new int[]{start, end};
        String[] a = base.split("\n", -1), b = current.split("\n", -1);
        int[] as = lineStarts(a), bs = lineStarts(b);
        int ls = lineOf(as, start), le = end > start ? lineOf(as, end - 1) : ls;
        int[] match = matchLines(a, b);
        for (int i = ls; i <= le; i++) {
            if (match[i] < 0 || (i > ls && match[i] != match[i - 1] + 1)) return null;
            long ca = java.util.Arrays.stream(a).filter(a[i]::equals).count(), cb = java.util.Arrays.stream(b).filter(a[i]::equals).count();
            if (ca > 1 && ca != cb) return null;
        }
        int ns = bs[match[ls]] + (start - as[ls]), ne = bs[match[le]] + (end - as[le]);
        if (ne < ns || ne > current.length() || !current.substring(ns, ne).equals(base.substring(start, end))) return null;
        return new int[]{ns, ne};
    }

    private static int[] lineStarts(String[] lines) {
        int[] out = new int[lines.length];
        for (int i = 1; i < lines.length; i++) out[i] = out[i - 1] + lines[i - 1].length() + 1;
        return out;
    }

    private static int lineOf(int[] starts, int offset) {
        int i = 0;
        while (i + 1 < starts.length && starts[i + 1] <= offset) i++;
        return i;
    }

    /** 行级最长公共子序列：match[i] = 旧第 i 行在新正文里的行号，没对上为 -1。太大时只认首尾原样相同的行。 */
    static int[] matchLines(String[] a, String[] b) {
        int n = a.length, m = b.length;
        int[] match = new int[n];
        java.util.Arrays.fill(match, -1);
        if ((long) n * m > 4_000_000L) {
            int p = 0;
            while (p < n && p < m && a[p].equals(b[p])) { match[p] = p; p++; }
            for (int s = 1; s <= Math.min(n, m) - p && a[n - s].equals(b[m - s]); s++) match[n - s] = m - s;
            return match;
        }
        int[][] dp = new int[n + 1][m + 1];
        for (int i = n - 1; i >= 0; i--) for (int j = m - 1; j >= 0; j--)
            dp[i][j] = a[i].equals(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        int i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i].equals(b[j]) && dp[i][j] == dp[i + 1][j + 1] + 1) { match[i++] = j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
            else j++;
        }
        return match;
    }

    /** 把 [start, end) 换成 replacement。 */
    public static String splice(String content, int[] range, String replacement) {
        return content.substring(0, range[0]) + replacement + content.substring(range[1]);
    }

    static Set<String> ids(JsonNode arr, String field) {
        Set<String> out = new HashSet<>();
        for (JsonNode x : arr) out.add(x.path(field).asText());
        return out;
    }
}
