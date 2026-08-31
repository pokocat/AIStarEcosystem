package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 短视频「提示词直出」拆解服务（v0.143，drama 子产品）。
 *
 * 只做一件事：把用户自己写好的整段提示词（人物设定卡 / 场景光影 / 全片基调 / 带时间码的分镜脚本，
 * 也可能只是散文式描述）拆解成短视频草稿能直接投产的结构化数据 —— 人物卡、场景、全片画面基调、逐镜分镜。
 * 复用 DRAMA_SCRIPT_DRAFT 已绑定端点 + 独立 promptKey {@link PromptService#KEY_DRAMA_SHORT_PROMPT_PARSE}。
 *
 * 与「AI 对话出脚本」并列的第二条入口：那条是「一句话 → AI 创作」，这条是「整段提示词 → 忠实拆解」。
 *
 * 不落库、不扣费（与脑暴 chat/outline 同惯例）：结果返回前端预览 / 修改，
 * 真正建草稿走 {@code POST /me/drama/shorts}（seed），那一步才按 drama.credit.short-entry 扣一次开拍费。
 *
 * §8.0：端点 / 提示词未配置 → 503 且不产假数据；模型调用失败 / 输出不可解析 → 502。
 * 绝不用正则或规则模板兜底拼一份「看起来像拆解结果」的假分镜。
 */
@Service
public class DramaShortPromptService {

    private static final Logger log = LoggerFactory.getLogger(DramaShortPromptService.class);

    /** 单次可拆解的提示词上限（字符）。超出直接 400，不静默截断用户设定。 */
    static final int MAX_PROMPT_CHARS = 20_000;
    /** 太短的输入拆不出有效分镜，直接挡回并给出写法提示。 */
    static final int MIN_PROMPT_CHARS = 20;
    /** 一条短视频的分镜上限；超出如实在 notes 告知「建议拆成多条」。 */
    static final int MAX_SHOTS = 40;
    /** 单镜时长区间（秒）。逐镜出片，过长的段落必须切分。 */
    static final int MIN_SHOT_SEC = 2;
    static final int MAX_SHOT_SEC = 15;
    /** 人物 / 场景视觉描述与全片基调的落库上限（会逐镜进图像与视频提示词，过长反而稀释重点）。 */
    static final int VISUAL_CHARS = 240;
    static final int UNIVERSAL_CHARS = 320;
    static final int SHOT_VISUAL_CHARS = 300;
    static final int VO_CHARS = 400;
    static final int SHORT_FIELD_CHARS = 60;
    static final int MAX_CHARACTERS = 6;
    static final int MAX_SCENES = 6;
    /** 拆解输出比常规脚本长（逐镜 + 人物卡），prompt 级放宽上限，不动共享端点默认。 */
    static final int DEFAULT_MAX_TOKENS = 8192;

    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final ObjectMapper om;

    public DramaShortPromptService(AiModelInvocationService invocation,
                                   PromptService promptService,
                                   ObjectMapper om) {
        this.invocation = invocation;
        this.promptService = promptService;
        this.om = om;
    }

    /**
     * 拆解提示词。body: { prompt, instruction? } →
     * { title, logline, style[], universalPrompt, characters[], scenes[], shots[], shotCount, totalDurationSec, notes[] }。
     * 不落库、不扣费。instruction = 在原提示词基础上追加的调整要求（工作台「重新拆解」用）。
     */
    public JsonNode parse(JsonNode body, String userId) {
        String prompt = trimToNull(text(body, "prompt"));
        if (prompt == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_REQUIRED", "请先粘贴你的提示词");
        }
        if (prompt.length() < MIN_PROMPT_CHARS) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_TOO_SHORT",
                    "提示词太短，拆不出分镜：至少写清画面、人物或台词（" + MIN_PROMPT_CHARS + " 字以上）。");
        }
        if (prompt.length() > MAX_PROMPT_CHARS) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_TOO_LONG",
                    "提示词长度 " + prompt.length() + " 字，超过单次上限 " + MAX_PROMPT_CHARS
                            + " 字。请拆成多条短视频分别制作。");
        }
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "提示词拆解还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_DRAMA_SHORT_PROMPT_PARSE);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "提示词拆解的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_SHORT_PROMPT_PARSE
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }

        String instruction = trimToNull(text(body, "instruction"));
        if (instruction != null && instruction.length() > 600) instruction = instruction.substring(0, 600);
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("prompt", prompt);
        vars.put("maxShots", String.valueOf(MAX_SHOTS));
        vars.put("maxShotSec", String.valueOf(MAX_SHOT_SEC));
        vars.put("maxCharacters", String.valueOf(MAX_CHARACTERS));
        vars.put("maxScenes", String.valueOf(MAX_SCENES));
        vars.put("instructionClause", instruction == null ? ""
                : "【本次调整要求】在忠实还原上面提示词的前提下，按这条要求调整拆解结果：" + instruction + "\n");

        List<Map<String, String>> messages = new ArrayList<>();
        // system 段也要填占位符：镜数 / 时长 / 角色场景上限写在规则里（system），
        // 不填会把字面 {{maxShots}} 发给模型，上限约束等于没说。
        if (p.system() != null && !p.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", PromptService.fill(p.system(), vars)));
        }
        messages.add(Map.of("role", "user", "content", PromptService.fill(p.userTemplate(), vars)));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", p.params().temperature() != null ? p.params().temperature() : 0.4);
        options.put("max_tokens", p.params().maxTokens() != null && p.params().maxTokens() > 0
                ? p.params().maxTokens() : DEFAULT_MAX_TOKENS);
        if (p.params().jsonMode() == null || p.params().jsonMode()) {
            options.put("response_format", Map.of("type", "json_object"));
        }
        options.put("timeout_seconds", 120);

        log.info("[drama-short-prompt] parse start user={} promptChars={} withInstruction={}",
                userId, prompt.length(), instruction != null);
        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "提示词拆解调用失败，请稍后重试。");
        }
        if ("length".equalsIgnoreCase(resp.finishReason())) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_OUTPUT_TRUNCATED",
                    "拆解结果超出模型输出上限：请把提示词拆短一些再试；运营也可在「短剧专区 · 提示词设置」调高 max_tokens。");
        }
        JsonNode root = readJson(resp.content());
        if (root == null || !root.isObject()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "拆解结果无法解析，请重试；若反复失败，把提示词里的分镜段落和时间码写清楚会更稳。");
        }
        ObjectNode out = normalize((ObjectNode) root);
        log.info("[drama-short-prompt] parse ok user={} shots={} totalSec={} characters={} model={}",
                userId, out.path("shotCount").asInt(), out.path("totalDurationSec").asInt(),
                out.path("characters").size(), resp.modelUsed());
        return out;
    }

    // ── 归一化（模型输出 → 前端契约形状；越界如实写进 notes，不静默改设定） ──────────

    ObjectNode normalize(ObjectNode root) {
        List<String> notes = new ArrayList<>();
        for (JsonNode n : root.path("notes")) {
            String s = cap(clean(n.asText("")), 160);
            if (!s.isBlank() && notes.size() < 6) notes.add(s);
        }

        ObjectNode out = om.createObjectNode();
        out.put("title", cap(orDefault(clean(text(root, "title")), "未命名短视频"), 40));
        out.put("logline", cap(clean(text(root, "logline")), 200));
        out.put("universalPrompt", capNoting(clean(text(root, "universalPrompt")), UNIVERSAL_CHARS,
                notes, "全片画面基调超过 " + UNIVERSAL_CHARS + " 字，已保留前半段。"));

        ArrayNode style = out.putArray("style");
        for (JsonNode s : root.path("style")) {
            String t = cap(clean(s.asText("")), 16);
            if (!t.isBlank() && style.size() < 4) style.add(t);
        }

        // 人物卡：visual 只留视觉（逐镜锚点），performance 留表演，互不混入。
        ArrayNode characters = out.putArray("characters");
        Set<String> names = new LinkedHashSet<>();
        boolean charactersDropped = false;
        for (JsonNode c : root.path("characters")) {
            if (!c.isObject()) continue;
            if (characters.size() >= MAX_CHARACTERS) {
                charactersDropped = true;
                continue;
            }
            String name = cap(clean(text(c, "name")), 24);
            if (name.isBlank() || !names.add(name)) continue;
            ObjectNode item = characters.addObject();
            item.put("name", name);
            item.put("visual", capNoting(clean(text(c, "visual")), VISUAL_CHARS, notes,
                    "角色「" + name + "」的视觉描述超过 " + VISUAL_CHARS + " 字，已保留前半段。"));
            item.put("performance", cap(clean(text(c, "performance")), VISUAL_CHARS));
        }

        if (charactersDropped) {
            notes.add("提示词里的角色超过 " + MAX_CHARACTERS + " 位，只保留了前 " + MAX_CHARACTERS
                    + " 位；其余角色请拆成另一条短视频。");
        }

        ArrayNode scenes = out.putArray("scenes");
        Set<String> sceneNames = new LinkedHashSet<>();
        boolean scenesDropped = false;
        for (JsonNode s : root.path("scenes")) {
            if (!s.isObject()) continue;
            if (scenes.size() >= MAX_SCENES) {
                scenesDropped = true;
                continue;
            }
            String name = cap(clean(text(s, "name")), 24);
            if (name.isBlank()) name = "主场景";
            if (!sceneNames.add(name)) continue;
            ObjectNode item = scenes.addObject();
            item.put("name", name);
            item.put("visual", capNoting(clean(text(s, "visual")), VISUAL_CHARS, notes,
                    "场景「" + name + "」的描述超过 " + VISUAL_CHARS + " 字，已保留前半段。"));
        }

        if (scenesDropped) {
            notes.add("提示词里的场景超过 " + MAX_SCENES + " 个，只保留了前 " + MAX_SCENES + " 个。");
        }

        ArrayNode shots = out.putArray("shots");
        int total = 0;
        boolean clamped = false;
        boolean dropped = false;
        for (JsonNode s : root.path("shots")) {
            if (!s.isObject()) continue;
            if (shots.size() >= MAX_SHOTS) {
                dropped = true;
                break;
            }
            String visual = cap(clean(text(s, "visual")), SHOT_VISUAL_CHARS);
            String voText = cap(clean(text(s, "voText")), VO_CHARS);
            if (visual.isBlank() && voText.isBlank()) continue; // 空镜不入表
            int raw = shotSeconds(s);
            int dur = raw <= 0 ? 4 : Math.min(MAX_SHOT_SEC, Math.max(MIN_SHOT_SEC, raw));
            if (raw > MAX_SHOT_SEC) clamped = true;
            ObjectNode item = shots.addObject();
            item.put("no", shots.size()); // addObject 已入表 → size 即本镜镜号（从 1 开始）
            item.put("timecode", cap(clean(text(s, "timecode")), 24));
            item.put("durationSec", dur);
            String sceneName = cap(clean(text(s, "sceneName")), 24);
            item.put("sceneName", sceneNames.contains(sceneName) ? sceneName : "");
            // 出场人物：模型给了就按它（空数组 = 本镜确实没人）；漏写时从画面文本按角色名兜底推断，
            // 仍推不出就**不写这个字段** —— 让下游按「未标注 → 全员锚定」处理，
            // 绝不能把「模型漏写」变成「明确无人」（那会静默丢掉人物一致性）。
            JsonNode rawCast = declaredCast(s);
            if (rawCast != null) {
                ArrayNode cast = item.putArray("castNames");
                for (JsonNode c : rawCast) {
                    String n = clean(c.asText(""));
                    if (names.contains(n) && !containsText(cast, n)) cast.add(n);
                }
            } else {
                ArrayNode inferred = om.createArrayNode();
                for (String n : names) {
                    if (n.length() >= 2 && visual.contains(n)) inferred.add(n);
                }
                if (!inferred.isEmpty()) item.set("castNames", inferred);
            }
            item.put("beat", cap(clean(text(s, "beat")), 12));
            item.put("visual", visual);
            item.put("size", cap(clean(text(s, "size")), SHORT_FIELD_CHARS));
            item.put("move", cap(clean(text(s, "move")), SHORT_FIELD_CHARS));
            item.put("voWho", cap(clean(text(s, "voWho")), 24));
            item.put("voText", voText);
            item.put("sfx", cap(clean(text(s, "sfx")), SHORT_FIELD_CHARS));
            item.put("bgm", cap(clean(text(s, "bgm")), SHORT_FIELD_CHARS));
            item.put("fx", cap(clean(text(s, "fx")), SHORT_FIELD_CHARS));
            total += dur;
        }
        if (shots.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "没能从这段提示词里拆出可用分镜：请补上画面描述或分镜段落（带时间码更准）后重试。");
        }
        if (clamped) {
            notes.add("有镜头超过 " + MAX_SHOT_SEC + " 秒，已经压到 " + MAX_SHOT_SEC
                    + " 秒；想保留原来的长度，在分镜表里手动拆成多镜。");
        }
        if (dropped) {
            notes.add("提示词内容超过单条短视频上限（" + MAX_SHOTS + " 镜），后面的部分没有拆解；建议拆成多条分别制作。");
        }

        ArrayNode notesOut = out.putArray("notes");
        notes.forEach(notesOut::add);
        out.put("shotCount", shots.size());
        out.put("totalDurationSec", total);
        return out;
    }

    // ── seed → 草稿 payload（DramaShortService 建草稿时复用） ─────────────────────

    /**
     * 把（可能已被用户在预览页改过的）拆解结果转成一份合法的 ShortDraftData。
     *
     * 只接收创作内容：分镜一律 flow=draft、不带首帧 / 视频 / 配音产物 —— 客户端不得借 seed 伪造成片（§8.0）。
     * promptSource 保留原始提示词，供工作台展示与「按提示词重新拆解」。
     */
    public static ObjectNode seedToDraftData(JsonNode seed, ObjectMapper om) {
        ObjectNode parsed = seed != null && seed.isObject() ? (ObjectNode) seed : om.createObjectNode();
        ObjectNode data = om.createObjectNode();

        ArrayNode style = om.createArrayNode();
        for (JsonNode s : parsed.path("style")) {
            String t = cap(clean(s.asText("")), 16);
            if (!t.isBlank() && style.size() < 4) style.add(t);
        }
        // 人物卡 / 场景 / 全片基调 —— 逐镜出图与出片的一致性锚点（visualBible）。
        ArrayNode characters = om.createArrayNode();
        for (JsonNode c : parsed.path("characters")) {
            if (!c.isObject() || characters.size() >= MAX_CHARACTERS) continue;
            String name = cap(clean(text(c, "name")), 24);
            if (name.isBlank()) continue;
            ObjectNode item = characters.addObject();
            item.put("name", name);
            item.put("visual", cap(clean(text(c, "visual")), VISUAL_CHARS));
            item.put("performance", cap(clean(text(c, "performance")), VISUAL_CHARS));
        }
        ArrayNode scenes = om.createArrayNode();
        for (JsonNode s : parsed.path("scenes")) {
            if (!s.isObject() || scenes.size() >= MAX_SCENES) continue;
            String name = cap(clean(text(s, "name")), 24);
            ObjectNode item = scenes.addObject();
            item.put("name", name.isBlank() ? "主场景" : name);
            item.put("visual", cap(clean(text(s, "visual")), VISUAL_CHARS));
        }
        String universal = cap(clean(text(parsed, "universalPrompt")), UNIVERSAL_CHARS);
        String title = cap(orDefault(clean(text(parsed, "title")), "未命名短视频"), 40);

        ObjectNode meta = om.createObjectNode();
        meta.put("title", title);
        meta.set("style", style.deepCopy());
        // 主场景一句话：优先第一个场景的视觉描述，其次全片基调（分镜表与出图前缀都读它）。
        String mainScene = scenes.size() > 0 ? scenes.get(0).path("visual").asText("") : "";
        meta.put("scene", mainScene.isBlank() ? universal : mainScene);
        ObjectNode character = meta.putObject("character");
        character.put("name", characters.size() > 0 ? characters.get(0).path("name").asText("") : "");
        character.put("description", characters.size() > 0
                ? firstNonBlank(characters.get(0).path("visual").asText(""),
                                characters.get(0).path("performance").asText(""))
                : "");

        ArrayNode shots = om.createArrayNode();
        for (JsonNode s : parsed.path("shots")) {
            if (!s.isObject() || shots.size() >= MAX_SHOTS) continue;
            String visual = cap(clean(text(s, "visual")), SHOT_VISUAL_CHARS);
            String voText = cap(clean(text(s, "voText")), VO_CHARS);
            if (visual.isBlank() && voText.isBlank()) continue;
            int no = shots.size() + 1;
            int raw = shotSeconds(s);
            ObjectNode shot = shots.addObject();
            shot.put("id", "sh_p" + no + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            shot.put("no", no);
            shot.put("dur", raw <= 0 ? 4 : Math.min(MAX_SHOT_SEC, Math.max(MIN_SHOT_SEC, raw)));
            shot.put("visual", visual);
            shot.put("size", orDefault(cap(clean(text(s, "size")), SHORT_FIELD_CHARS), "中景"));
            shot.put("move", orDefault(cap(clean(text(s, "move")), SHORT_FIELD_CHARS), "固定"));
            shot.put("voWho", voText.isBlank() ? cap(clean(text(s, "voWho")), 24)
                    : orDefault(cap(clean(text(s, "voWho")), 24), "旁白"));
            shot.put("voText", voText);
            shot.put("sfx", cap(clean(text(s, "sfx")), SHORT_FIELD_CHARS));
            shot.put("bgm", cap(clean(text(s, "bgm")), SHORT_FIELD_CHARS));
            shot.put("fx", cap(clean(text(s, "fx")), SHORT_FIELD_CHARS));
            shot.put("beat", cap(clean(text(s, "beat")), 12));
            shot.put("timecode", cap(clean(text(s, "timecode")), 24));
            String sceneName = cap(clean(text(s, "sceneName")), 24);
            if (!sceneName.isBlank()) shot.put("sceneName", sceneName);
            // 与 normalize 同规则：字段缺失就不落，交给 ensureDraft 的「未标注 → 全员」兜底。
            JsonNode declared = declaredCast(s);
            if (declared != null) {
                ArrayNode cast = shot.putArray("castNames");
                for (JsonNode c : declared) {
                    String n = cap(clean(c.asText("")), 24);
                    if (!n.isBlank() && !containsText(cast, n)) cast.add(n);
                }
            }
            shot.set("refs", om.createArrayNode());
            shot.put("sub", true);
            shot.put("flow", "draft");   // 产物只能由服务端渲染写入，seed 不得带成片
            shot.put("engine", "avatar");
            shot.put("frameIdx", 0);
        }

        data.putNull("idea");
        data.putNull("reopen");
        data.putNull("fmtKey");
        // 展示与出片风格名同源：用拆解出的风格标签，避免回落到「口播带货」这类误导性默认。
        data.put("fmtName", style.size() > 0 ? cap(joinStyle(style), 24) : "自定义短片");
        data.put("title", title);
        data.put("step", "script");
        data.set("meta", meta);
        data.put("logline", cap(clean(text(parsed, "logline")), 200));
        ObjectNode bible = data.putObject("visualBible");
        bible.put("universal", universal);
        bible.set("characters", characters);
        bible.set("scenes", scenes);
        ObjectNode source = data.putObject("promptSource");
        String raw = clean(text(parsed.path("promptSource"), "raw"));
        source.put("raw", cap(raw, MAX_PROMPT_CHARS));
        source.put("parsedAt", OffsetDateTime.now().toString());
        data.set("shots", shots);
        ArrayNode chat = data.putArray("chat");
        ObjectNode hello = chat.addObject();
        hello.put("who", "ai");
        hello.put("text", "已按你的提示词拆成 " + shots.size() + " 镜，人物和画面设定都在右侧「提示词设定」里。"
                + "分镜表里的字段都能直接改；想整张表重来，点分镜表右上的「按提示词重拆」。");
        data.set("refs", om.createArrayNode());
        ArrayNode notes = data.putArray("promptNotes");
        for (JsonNode n : parsed.path("notes")) {
            String t = cap(clean(n.asText("")), 160);
            if (!t.isBlank() && notes.size() < 6) notes.add(t);
        }
        return data;
    }

    /**
     * 显式给出的出场人物数组，没有则返回 null（**不要**退化成空数组：
     * 空数组表示「本镜确实没人」，null 表示「未标注」，两者下游行为不同）。
     * 契约字段是 castNames；模型偶尔回 cast，一并接受（字段名容错，不造数据）。
     */
    private static JsonNode declaredCast(JsonNode shot) {
        JsonNode named = shot.get("castNames");
        if (named != null && named.isArray()) return named;
        JsonNode legacy = shot.get("cast");
        return legacy != null && legacy.isArray() ? legacy : null;
    }

    /**
     * 建草稿前的 seed 语义校验（**必须在扣费之前调用**）：
     * 至少要有一镜带画面或台词，否则用户会为一张空分镜表付一笔开拍费。
     */
    public static void requireUsableSeed(JsonNode seed) {
        int usable = 0;
        if (seed != null && seed.isObject()) {
            for (JsonNode s : seed.path("shots")) {
                if (!s.isObject()) continue;
                if (!clean(text(s, "visual")).isBlank() || !clean(text(s, "voText")).isBlank()) usable++;
            }
        }
        if (usable == 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_SEED_EMPTY",
                    "拆解结果里没有可用分镜：请至少给一镜填上画面或台词，再开始制作。");
        }
    }

    /** 拆解结果的秒数字段兼容：durationSec（契约）/ duration_sec（模型习惯）/ dur（草稿形状回灌）。 */
    private static int shotSeconds(JsonNode shot) {
        int v = shot.path("durationSec").asInt(0);
        if (v <= 0) v = shot.path("duration_sec").asInt(0);
        if (v <= 0) v = shot.path("dur").asInt(0);
        return v;
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    private static String joinStyle(ArrayNode style) {
        StringBuilder sb = new StringBuilder();
        for (JsonNode s : style) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(s.asText(""));
        }
        return sb.toString();
    }

    private static boolean containsText(ArrayNode arr, String value) {
        for (JsonNode n : arr) if (value.equals(n.asText(""))) return true;
        return false;
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : (b == null ? "" : b);
    }

    /** 粘贴来的提示词常夹不换行空格（U+00A0），先归一成普通空格再 trim。 */
    private static String clean(String s) {
        return s == null ? "" : s.replace(' ', ' ').trim();
    }

    private static String cap(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }

    /** 超长即截断并（可选）在 notes 里如实记一条，绝不悄悄改用户的设定。 */
    private static String capNoting(String s, int max, List<String> notes, String note) {
        if (s == null) return "";
        if (s.length() <= max) return s;
        if (notes != null && note != null && notes.size() < 6) notes.add(note);
        return s.substring(0, max);
    }

    private static String orDefault(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private JsonNode readJson(String content) {
        if (content == null || content.isBlank()) return null;
        String s = content.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) s = s.substring(nl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            s = s.trim();
        }
        try {
            return om.readTree(s);
        } catch (Exception ignore) {
            int start = s.indexOf('{');
            int end = s.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    return om.readTree(s.substring(start, end + 1));
                } catch (Exception ignore2) {
                    return null;
                }
            }
            return null;
        }
    }
}
