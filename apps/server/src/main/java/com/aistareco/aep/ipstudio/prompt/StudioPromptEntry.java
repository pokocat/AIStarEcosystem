package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 提示词库里的一个条目（docs/studio-prompt-architecture.md §2、§4.3）：底座、环节、内容方法、场景。和制作做法（workflow skill）
 * 存在同一组表里（{@code ip_skill} / {@code ip_skill_version}），靠文件头的 {@code layer} / {@code kind} 区分；做法仍由
 * {@link StudioSkillCatalog} 解析，这里只认其它几层。
 *
 * @param header 校验过的文件头（JSON 可存的类型）；场景的界面配置、环节的参数都在这里
 * @param body   正文。环节的正文用一行 {@code ---} 分成 system 和 user 两段（同旧 Prompt 管理的写法）
 */
public record StudioPromptEntry(String key, String name, int version, String status, String layer, String kind, String target,
                                String summary, Map<String, Object> header, String body, String digest) {
    public static final String BASE = "base", STAGE = "stage", METHOD = "method", SCENE = "scene";
    public static final String CONTENT = "content";
    /** {@code message}：拼成一段话交给别处（如场景交给助手的第一条消息），本身不调模型，不拼底座。 */
    public static final String LLM = "llm", IMAGE_MODEL = "image-model", VIDEO_MODEL = "video-model", MESSAGE = "message";
    static final Set<String> LAYERS = Set.of(BASE, STAGE, METHOD, SCENE);
    static final Set<String> TARGETS = Set.of(LLM, IMAGE_MODEL, VIDEO_MODEL, MESSAGE);
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9-]{0,63}");
    private static final Set<String> COMMON = Set.of("key", "name", "version", "status", "layer", "summary");
    private static final Map<String, Set<String>> FIELDS = Map.of(
            BASE, Set.of(),
            STAGE, Set.of("target", "callPoints", "params", "importFrom"),
            METHOD, Set.of("kind", "usedBy", "groups"),
            SCENE, Set.of("sceneId", "sceneKind", "importFrom", "scene"));
    private static final Set<String> PARAM_FIELDS = Set.of("temperature", "maxTokens", "jsonMode");

    public boolean active() { return "active".equals(status); }
    public boolean withdrawn() { return "withdrawn".equals(status); }
    public boolean stage() { return STAGE.equals(layer); }

    /** 环节正文的 system 段（{@code ---} 之前）。 */
    public String system() { return split(body)[0]; }
    /** 环节正文的 user 段（{@code ---} 之后）；没有分隔行时整段是 user。 */
    public String user() { return split(body)[1]; }

    /** 环节的调用参数（§4.7）；没写的项为 null，由调用点按原来的规则补。 */
    public PromptParamsDto params() {
        if (!(header.get("params") instanceof Map<?, ?> p)) return new PromptParamsDto(null, null, null);
        return new PromptParamsDto(p.get("temperature") instanceof Number t ? t.doubleValue() : null,
                p.get("maxTokens") instanceof Number n ? n.intValue() : null,
                p.get("jsonMode") instanceof Boolean j ? j : null);
    }

    /** 切换时从哪里导入线上生效的内容（旧 Prompt 管理的 key，或 {@code scene-catalog}）。 */
    public String importFrom() { return header.get("importFrom") instanceof String s && !s.isBlank() ? s : null; }

    public String sceneId() { return header.get("sceneId") instanceof String s ? s : null; }

    /** 场景条目文件头里的场景配置（界面配置和要用到的信息等）。 */
    @SuppressWarnings("unchecked")
    public Map<String, Object> scene() { return header.get("scene") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of(); }

    public List<String> usedBy() { return strings(header.get("usedBy")); }
    public List<String> groups() { return strings(header.get("groups")); }

    /** 和旧 {@code PromptService.splitSystemUser} 同一个规则：首个独占 {@code ---} 的行分开，两段各自去掉首尾空白。 */
    static String[] split(String body) {
        if (body == null) return new String[]{"", ""};
        String[] lines = body.split("\n", -1);
        int sep = -1;
        for (int i = 0; i < lines.length; i++) if (lines[i].strip().equals("---")) { sep = i; break; }
        if (sep < 0) return new String[]{"", body.strip()};
        StringBuilder sys = new StringBuilder(), usr = new StringBuilder();
        for (int i = 0; i < sep; i++) sys.append(lines[i]).append('\n');
        for (int i = sep + 1; i < lines.length; i++) usr.append(lines[i]).append('\n');
        return new String[]{sys.toString().strip(), usr.toString().strip()};
    }

    // ── 解析与校验 ────────────────────────────────────────────────────────────────────────────────────────────

    /** 解析一个仓库文件。不是提示词库条目（是制作做法）或格式不对都抛 {@link IllegalArgumentException}。 */
    public static StudioPromptEntry parse(String text) {
        var split = StudioSkillCatalog.splitFile(text);
        return fromHeader(split.header(), split.body(), split.digest());
    }

    /**
     * 文件头 + 正文 → 条目。仓库文件、后台发布、回滚和库里读出来都走这一个方法，哪条路都不会比别的松。
     * 环节还要过调用点登记的变量和格式核对（{@link StudioPromptStages#check}）。
     */
    public static StudioPromptEntry fromHeader(Map<String, ?> map, String body, String digest) { return fromHeader(map, body, digest, true); }

    /**
     * {@code checkStage = false} 只用于读冻结在任务里的旧版本：它发布时已经核对过，之后代码里登记的变量变了也要能照原样渲染。
     */
    public static StudioPromptEntry fromHeader(Map<String, ?> map, String body, String digest, boolean checkStage) {
        if (StudioSkillCatalog.isWorkflowHeader(map)) throw new IllegalArgumentException("这是制作做法，不是提示词库条目");
        String layer = map.get("layer") instanceof String l ? l : "";
        if (!LAYERS.contains(layer)) throw new IllegalArgumentException("layer 只能是 base / stage / method / scene");
        for (Object field : map.keySet()) {
            String f = String.valueOf(field);
            if (!COMMON.contains(f) && !FIELDS.get(layer).contains(f)) throw new IllegalArgumentException("unknown header field " + f);
        }
        String key = string(map.get("key"), "key", 64);
        if (!KEY.matcher(key).matches()) throw new IllegalArgumentException("invalid key");
        String name = string(map.get("name"), "name", 64);
        if (!(map.get("version") instanceof Integer version) || version < 1) throw new IllegalArgumentException("version must be an integer >= 1");
        String status = string(map.get("status"), "status", 16);
        if (!StudioSkillCatalog.STATUSES.contains(status)) throw new IllegalArgumentException("invalid status " + status);
        String summary = map.get("summary") == null ? "" : string(map.get("summary"), "summary", 500);
        String text = body == null ? "" : body.strip();
        if (text.length() > 64000) throw new IllegalArgumentException("正文太长（最多 64000 字）");

        String kind = null, target = null;
        switch (layer) {
            case METHOD -> {
                kind = string(map.get("kind"), "kind", 16);
                if (!CONTENT.equals(kind)) throw new IllegalArgumentException("kind 只能是 content（制作做法另由技能目录管理）");
                if (map.get("usedBy") != null) strings(map.get("usedBy"), "usedBy");
                if (map.get("groups") != null) strings(map.get("groups"), "groups");
                requireBody(text);
            }
            case STAGE -> {
                target = map.get("target") == null ? LLM : string(map.get("target"), "target", 16);
                if (!TARGETS.contains(target)) throw new IllegalArgumentException("target 只能是 llm / image-model / video-model / message");
                if (map.get("params") != null) {
                    if (!(map.get("params") instanceof Map<?, ?> p)) throw new IllegalArgumentException("params 需为对象");
                    for (Object f : p.keySet()) if (!PARAM_FIELDS.contains(String.valueOf(f))) throw new IllegalArgumentException("unknown params field " + f);
                    if (p.get("temperature") != null && !(p.get("temperature") instanceof Number)) throw new IllegalArgumentException("params.temperature 需为数字");
                    if (p.get("maxTokens") != null && !(p.get("maxTokens") instanceof Integer)) throw new IllegalArgumentException("params.maxTokens 需为整数");
                    if (p.get("jsonMode") != null && !(p.get("jsonMode") instanceof Boolean)) throw new IllegalArgumentException("params.jsonMode 需为 true/false");
                }
                if (map.get("importFrom") != null) string(map.get("importFrom"), "importFrom", 64);
                requireBody(text);
            }
            case SCENE -> {
                string(map.get("sceneId"), "sceneId", 64);
                String sceneKind = string(map.get("sceneKind"), "sceneKind", 16);
                if (!Set.of("video", "image").contains(sceneKind)) throw new IllegalArgumentException("sceneKind 只能是 video / image");
                if (map.get("scene") != null && !(map.get("scene") instanceof Map<?, ?>)) throw new IllegalArgumentException("scene 需为对象");
                if (map.get("importFrom") != null) string(map.get("importFrom"), "importFrom", 64);
            }
            default -> { } // base: the body may be empty (it is empty while prompts are moved byte for byte)
        }
        Map<String, Object> header = new LinkedHashMap<>();
        map.forEach((k, v) -> header.put(String.valueOf(k), v));
        StudioPromptEntry entry = new StudioPromptEntry(key, name, (Integer) map.get("version"), status, layer, kind, target, summary,
                Collections.unmodifiableMap(header), text, digest);
        if (entry.stage()) {
            checkSyntax(entry.system(), "system 段");
            checkSyntax(entry.user(), "user 段");
            if (checkStage) StudioPromptStages.check(entry);
        } else {
            checkSyntax(text, "正文");
            for (String n : PromptTemplate.names(text))
                if (PromptTemplate.LAYER_VARS.contains(n) || n.startsWith(PromptTemplate.FORMAT_PREFIX))
                    throw new IllegalArgumentException("只有环节能放 {{" + n + "}}，" + layer + " 的正文里不能用");
        }
        return entry;
    }

    private static void checkSyntax(String template, String where) {
        try { PromptTemplate.check(template); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException(where + "的模板写法不对：" + e.getMessage()); }
    }

    private static void requireBody(String text) { if (text.isBlank()) throw new IllegalArgumentException("正文不能为空"); }

    private static String string(Object value, String field, int max) {
        if (!(value instanceof String s) || s.isBlank()) throw new IllegalArgumentException(field + " missing");
        if (s.strip().length() > max) throw new IllegalArgumentException(field + " too long");
        return s.strip();
    }

    private static List<String> strings(Object value, String field) {
        if (!(value instanceof List<?> items)) throw new IllegalArgumentException(field + " must be a list");
        List<String> out = new ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof String s) || s.isBlank() || s.length() > 64) throw new IllegalArgumentException(field + " has an invalid item");
            out.add(s.strip());
        }
        return List.copyOf(out);
    }

    private static List<String> strings(Object value) {
        if (!(value instanceof List<?> items)) return List.of();
        List<String> out = new ArrayList<>();
        for (Object item : items) if (item instanceof String s && !s.isBlank()) out.add(s.strip());
        return List.copyOf(out);
    }
}
