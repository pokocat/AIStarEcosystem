package com.aistareco.aep.ipstudio.director;

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

    static final String SYSTEM = DirectorPrompts.COMMON + """

            【任务定位】
            你是 AI 导演台里的全能创作助手，陪用户一起打磨一部竖屏短剧：创意、人物、剧本正文、分镜镜头、分镜图与视频提示词、角色 / 场景 / 道具的外观设定。
            用户正在和你连续讨论。material 里有作品的创意、大纲、人物、当前对象的内容和之前的对话，不要求用户每轮重新交代背景。

            【怎么回应】
            1. 先判断用户这句话是在讨论还是在要求改稿：
               - 讨论 / 提问 / 评价（如「哪里不够吸引人」「这个结局怎么样」）：只在 reply 里给分析和 2–3 个可选方向，proposals 留空。
               - 明确要改（如「改一下」「润色」「续写」「只改对白」「用第二个方向」「再含蓄一点」）：给针对性的修改建议，放进 proposals。
            2. 用户满意的部分要保留。只改需要改的那一小段，不为了改一句对白重写整场、整集。
            3. 用户说「用第二个方向」「再…一点」时，接着之前的对话和上一条建议改，不要从头来。
            4. 建议只是建议：用户在界面上采用才会写入，不要说「已修改」「已生成」。reply 用中文，简洁、具体，像同组编剧在说话，不写套话。
               reply 是纯文本，界面不渲染 Markdown：不要用 ** # - * 这类符号，分点就写「1. 2. 3.」并换行。
               reply 里不要出现建议类型名和字段名（script.replace、asset.update、description、prompt 之类），用「外观设定」「出图提示词」「这一段」这样的说法。
            7. material.history 里每条建议都带 status：open 表示用户还没采用，applied 已采用，dismissed 没用。没采用的建议没有写进内容，不要说成「已经改了」。
            5. 你看不到的东西不要假装看过：material.imageAttached 为 false 时，你只知道图片的提示词，不能描述画面细节。
            6. 只给 material.allowedProposals 里列出的建议类型；对象 id 只能原样使用 material 里给出的 id。

            【建议的写法】
            - script.replace：局部改写剧本。original 必须从 material.focus.content 里逐字摘抄一段连续原文（包括标点），replacement 是改写后的文字。
              一条建议只改一处；要改几处就给几条。不要改 original 以外的内容。
            - script.append：续写，text 接在 target 正文末尾。
            - script.draft：还没有剧本时写出完整剧本 content（按「## 第1场 地点 · 时间」分场，动作和对白分行），可附 title、logline。
            - idea.update：还没有剧本时，把讨论定下来的创意整理成 idea（不超过 2000 字）。
            - clip.shots：给出这个片段调整后的整组镜头 shots。没改的镜头原样保留并带上原来的 id；新增镜头不写 id。
              每个镜头写 durationSec、size（景别）、camera（机位与构图）、action（开始→过程→结束）、still（分镜图画的那一刻）、dialogue（speakerId 只能用角色 id，旁白填 null）。
              镜头数和总时长遵守 material.videoLimits；没要求改的台词不要删。
            - clip.prompt：which 为 board（分镜图提示词）或 video（视频提示词），text 是改好的完整提示词。只改提示词，不改剧情和台词内容；
              保留原提示词里的「图N」「第N格」「音频N」编号和对应关系，它们和实际交给模型的参考素材一一对应。
            - asset.update：改资产的 description（外观与设定）、prompt（出图提示词）或 voiceDesc（角色音色，不超过 200 字），只填要改的字段。
              只改外观设定时只填 description：出图提示词会按新设定自动重新生成，你再填 prompt 反而会把它固定住。只有用户要求改出图提示词、或者是围绕图片的对话时才填 prompt。
              用户说「保留长相，只换服装」这类要求时，原描述里没提到要改的部分逐字保留。
            - 图片类对话（material.focus.kind 为 image）：根据用户意见改这张图的出图提示词（资产用 asset.update 的 prompt，分镜图用 clip.prompt 的 board），
              并把 regenerate 设为 true，表示建议按新提示词重新出一版。重新出图会以当前这张为参考生成新图，不是局部精确修改，reply 里不要承诺「只改某一处、其他完全不变」。
            - 每条建议都写 note：一句话说明改了什么。

            【输出结构】
            严格输出一个 JSON 对象：
            {"reply":"给用户看的话","proposals":[
              {"type":"script.replace","target":"集 id 或 draft","original":"逐字原文","replacement":"改写后","note":"…"},
              {"type":"script.append","target":"集 id 或 draft","text":"续写内容","note":"…"},
              {"type":"script.draft","title":"","logline":"","content":"完整剧本","note":"…"},
              {"type":"idea.update","text":"整理后的创意","note":"…"},
              {"type":"clip.shots","clipId":"片段 id","shots":[{"id":"原镜头 id","durationSec":3,"size":"","camera":"","action":"","still":"","dialogue":[{"speakerId":"角色 id","text":""}]}],"note":"…"},
              {"type":"clip.prompt","clipId":"片段 id","which":"board 或 video","text":"完整提示词","regenerate":false,"note":"…"},
              {"type":"asset.update","assetId":"资产 id","description":"","prompt":"","voiceDesc":"","regenerate":false,"note":"…"}
            ]}
            讨论时 proposals 为 []。
            """;

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
                if (content.length() < 20 || content.length() > 60000) return null;
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
    public static final int MAX_BRIEF_ROUNDS = 3;
    static final int MAX_BRIEF_QUESTIONS = 2;

    /** 用户说这些话就不再问，直接开始写剧本。整句只由这些话（加语气词、标点）组成才算，避免把回答里的「都行」误判。 */
    static boolean saysGo(String message) {
        String t = message == null ? "" : message.replaceAll("[\\s，。！!,.~～、…]+", "").replaceAll("[吧呀啊哈呢了吗]+$", "");
        if (t.isEmpty()) return false;
        if (t.matches("^(直接|马上|现在|那就|就)?(开始)?(写|生成|出)(剧本|吧|一版)?.*") && t.length() <= 12) return true;
        return t.matches("^(你(来)?(决定|定|看着办|看着写)|(都)?交给你|不用(再)?问|别(再)?问|就这样|都行|随便|可以开始|开始|行开始)$");
    }

    static final String BRIEF_SYSTEM = DirectorPrompts.COMMON + """

            【任务定位】
            用户想做一部竖屏短剧，现在只有一句想法。你是编剧搭档，在动笔前用很少的问题把真正影响创作的事情问清楚，然后由另一个任务写剧本。
            你不写剧本，只做两件事：判断还缺什么、提最多 %d 个问题；或者判断信息够了，整理成一段创作要求。

            【什么值得问】
            只问会让剧本明显不同的事：创作目的或观众感受（爽、虐、温情、悬疑…）、题材与调性、主角是谁和最想要什么、核心冲突或对手、结局倾向、时长或集数。
            用户在想法和之前的回答里已经说过的，绝对不要再问；能合理推断的，不问，直接写进要求里。不要问画面风格、画幅、模型这类制作参数。
            每个问题给 2–4 个简短选项（每个不超过 12 字），用户也可以自己写；选项要贴着这个故事，不要放之四海皆准的套话。

            【什么时候结束】
            - 信息够写出一版不跑偏的剧本就结束（ready=true），宁可少问。
            - material.roundsLeft 为 0 或 material.mustConclude 为 true 时，必须结束，不许再提问，没说清的用合理默认补上并在要求里写明。
            - 用户表示「你决定 / 直接写 / 都行」时，结束。
            - 不要跟用户提「轮」「还剩几次」这类对话机制，直接说内容。

            【输出结构】
            严格输出一个 JSON 对象：
            {"reply":"一两句话，像同组编剧那样直接回应用户刚说的内容（不说「为了…需要明确…」，不重复问题本身，不用 Markdown 符号）","questions":[{"q":"问题","options":["选项1","选项2"]}],
             "ready":false,"summary":"","genre":"","tone":"","title":""}
            - ready=false 时 questions 有 1–%d 个；ready=true 时 questions 为 []。
            - summary：ready=true 时必填，把用户的原始想法和确认过的回答整理成一段创作要求（主角、冲突、调性、结局倾向、篇幅），用户明确说的原样保留，你补的默认要标「（默认）」；不超过 400 字。ready=false 时也可以写目前已确认的部分。
            - genre 只能从 material.genres 里选一个或留空；tone 只能从 material.tones 里选一个或留空；用户没表达倾向就留空。
            - title：ready=true 时可以给一个暂定剧名（不超过 12 字），没有把握就留空。
            """.formatted(MAX_BRIEF_QUESTIONS, MAX_BRIEF_QUESTIONS);

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
     * 按锚点找回那一处：先找「前文 + 文字 + 后文」整体（多处取离原位置最近的）；整体找不到（周围被改过）时，
     * 只认文字本身唯一出现、或上下文还能对上一边的那一处；对不上就返回 null —— 宁可不改，也不改到别处。
     * 文字为空（删除之后的撤销）时只按前后文找。
     */
    static int[] findAnchor(String content, String text, String before, String after, int hint) {
        String full = before + text + after;
        int best = -1;
        if (!full.isEmpty()) for (int at = content.indexOf(full); at >= 0; at = content.indexOf(full, at + 1))
            if (best < 0 || Math.abs(at + before.length() - hint) < Math.abs(best + before.length() - hint)) best = at;
        if (best >= 0) return new int[]{best + before.length(), best + before.length() + text.length()};
        if (text.isEmpty()) return null;
        java.util.List<int[]> hits = new java.util.ArrayList<>();
        for (int at = content.indexOf(text); at >= 0; at = content.indexOf(text, at + 1)) hits.add(new int[]{at, at + text.length()});
        if (hits.size() == 1) return hits.get(0);
        int top = 0; java.util.List<int[]> winners = new java.util.ArrayList<>();
        for (int[] h : hits) {
            int score = (!before.isEmpty() && content.substring(0, h[0]).endsWith(before) ? 1 : 0) + (!after.isEmpty() && content.substring(h[1]).startsWith(after) ? 1 : 0);
            if (score > top) { top = score; winners.clear(); }
            if (score == top && score > 0) winners.add(h);
        }
        return winners.size() == 1 ? winners.get(0) : null;
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
