package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 画布文档（{@code DramaCanvasDoc}，契约 packages/types/src/drama-canvas.ts）的只读工具：查找、挑中版本、连线、
 * 引用标记、收 key / 剥 url、规范化与指纹。<b>纯静态、无状态、不改入参</b>（{@link #stripDerivedUrls} 除外，它就是用来改的）。
 *
 * <p>存储层（{@link DramaCanvasService}）和生成层（运行记录）都用这一份，别在别处再写一遍同样的查找 / 挑版本规则
 * （AGENTS.md §8.0.1 ④：同一条规则写两遍，迟早只改一处）。前端对应的实现在 {@code apps/web-drama/src/canvas/core}
 * （refs.ts / doc-ops.ts），两边规则要一致。
 *
 * <p>所有查找对形状不对的文档都宽容：字段缺失、类型不对一律当「找不到」，不抛。
 */
public final class DramaCanvasDocs {

    private DramaCanvasDocs() {
    }

    /**
     * 片段文本里的引用：{@code @[显示名](look|scene|material:<id>)}。与前端 refs.ts 同一个正则
     * （drama-canvas.ts {@code CanvasSegment} 注释）。显示名 1–40 个字符、不含 {@code ]} 与换行；id 1–64 个 {@code [A-Za-z0-9_-]}。
     */
    public static final Pattern REF_PATTERN =
            Pattern.compile("@\\[([^\\]\\n]{1,40})\\]\\((look|scene|material):([A-Za-z0-9_-]{1,64})\\)");

    /** 一个引用：kind = look | scene | material；[start, end) 是整个标记在原文里的位置（UTF-16 下标，与 JS 一致）。 */
    public record Ref(String kind, String id, String label, int start, int end) {
    }

    /** 只用来写规范化 JSON（不读），线程安全。 */
    private static final ObjectMapper WRITER = new ObjectMapper();

    // ── 引用标记 ────────────────────────────────────────────────────────────────

    /** 按出现顺序列出所有引用；null / 空串 → 空列表。 */
    public static List<Ref> parseRefs(String text) {
        List<Ref> out = new ArrayList<>();
        if (text == null || text.isEmpty()) return out;
        Matcher m = REF_PATTERN.matcher(text);
        while (m.find()) {
            out.add(new Ref(m.group(2), m.group(3), m.group(1), m.start(), m.end()));
        }
        return out;
    }

    /** 把每个标记换成它的显示名（拼提示词、预览用）；null → 空串。 */
    public static String stripRefs(String text) {
        if (text == null || text.isEmpty()) return "";
        Matcher m = REF_PATTERN.matcher(text);
        StringBuilder sb = new StringBuilder(text.length());
        while (m.find()) m.appendReplacement(sb, Matcher.quoteReplacement(m.group(1)));
        m.appendTail(sb);
        return sb.toString();
    }

    // ── 查找 ────────────────────────────────────────────────────────────────────

    /** characters[].looks[] 里 id 相等的造型。 */
    public static Optional<JsonNode> findLook(JsonNode doc, String lookId) {
        if (doc == null || isBlank(lookId)) return Optional.empty();
        for (JsonNode ch : arr(doc, "characters")) {
            Optional<JsonNode> look = byId(arr(ch, "looks"), lookId);
            if (look.isPresent()) return look;
        }
        return Optional.empty();
    }

    /** 这个造型所属的角色。 */
    public static Optional<JsonNode> findCharacterOfLook(JsonNode doc, String lookId) {
        if (doc == null || isBlank(lookId)) return Optional.empty();
        for (JsonNode ch : arr(doc, "characters")) {
            if (ch.isObject() && byId(arr(ch, "looks"), lookId).isPresent()) return Optional.of(ch);
        }
        return Optional.empty();
    }

    public static Optional<JsonNode> findScene(JsonNode doc, String sceneId) {
        if (doc == null || isBlank(sceneId)) return Optional.empty();
        return byId(arr(doc, "scenes"), sceneId);
    }

    public static Optional<JsonNode> findMaterial(JsonNode doc, String materialId) {
        if (doc == null || isBlank(materialId)) return Optional.empty();
        return byId(arr(doc, "materials"), materialId);
    }

    /** script.episodes[] 里 no 相等的那一集剧本。 */
    public static Optional<JsonNode> findScriptEpisode(JsonNode doc, int no) {
        if (doc == null) return Optional.empty();
        return byNo(arr(doc.path("script"), "episodes"), no);
    }

    /** doc.episodes[]（逐集制作）里 no 相等的那一集。 */
    public static Optional<JsonNode> findEpisode(JsonNode doc, int no) {
        if (doc == null) return Optional.empty();
        return byNo(arr(doc, "episodes"), no);
    }

    /** 第 no 集里 id 相等的片段。 */
    public static Optional<JsonNode> findSegment(JsonNode doc, int no, String segmentId) {
        if (isBlank(segmentId)) return Optional.empty();
        return findEpisode(doc, no).flatMap(ep -> byId(arr(ep, "segments"), segmentId));
    }

    // ── 挑中的版本 ──────────────────────────────────────────────────────────────

    /**
     * 一组候选图（{@code CanvasImageSet}）挑中的那张的 key：{@code pickedKey} 在 versions 里就用它，否则第一张带 key 的；
     * 一张都没有 → empty。与前端 doc-ops.ts {@code pickedImage} 同一套规则。
     */
    public static Optional<String> pickedImageKey(JsonNode imageSet) {
        return pickedVersion(imageSet).map(v -> text(v, "key"));
    }

    /** 一组视频（{@code CanvasVideoSet}）挑中的那一版（整条 version 对象）；规则同 {@link #pickedImageKey}。 */
    public static Optional<JsonNode> pickedVideo(JsonNode videoSet) {
        return pickedVersion(videoSet);
    }

    private static Optional<JsonNode> pickedVersion(JsonNode set) {
        if (set == null || !set.isObject()) return Optional.empty();
        String picked = text(set, "pickedKey");
        JsonNode first = null;
        for (JsonNode v : arr(set, "versions")) {
            String k = text(v, "key");
            if (k == null) continue;
            if (first == null) first = v;
            if (k.equals(picked)) return Optional.of(v);
        }
        return Optional.ofNullable(first);
    }

    // ── 连线 ────────────────────────────────────────────────────────────────────

    /** board.edges 里 target == targetId 的连线，按文档顺序（出图参考的先后就是它）。 */
    public static List<JsonNode> incomingEdges(JsonNode doc, String targetId) {
        List<JsonNode> out = new ArrayList<>();
        if (doc == null || isBlank(targetId)) return out;
        for (JsonNode e : arr(doc.path("board"), "edges")) {
            if (e.isObject() && targetId.equals(text(e, "target"))) out.add(e);
        }
        return out;
    }

    // ── 资产 key / 派生 url ─────────────────────────────────────────────────────

    /** 递归收集所有对象上的 {@code key} / {@code lastFrameKey}（字符串且非空白）。 */
    public static void collectAssetKeys(JsonNode node, Set<String> out) {
        if (node == null || out == null) return;
        if (node.isObject()) {
            String k = text(node, "key");
            if (k != null) out.add(k);
            String lf = text(node, "lastFrameKey");
            if (lf != null) out.add(lf);
            for (Iterator<JsonNode> it = node.elements(); it.hasNext(); ) collectAssetKeys(it.next(), out);
        } else if (node.isArray()) {
            for (JsonNode child : node) collectAssetKeys(child, out);
        }
    }

    /**
     * 递归剥掉所有对象上的 {@code url} / {@code lastFrameUrl}（派生值，签名有 TTL，不许进库）。
     * 只剥字符串 / null 值：值是对象的同名字段不是派生地址（比如 board.positions 里恰好有个节点 id 叫 url），不动。
     */
    public static void stripDerivedUrls(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            removeIfScalar(o, "url");
            removeIfScalar(o, "lastFrameUrl");
            for (Iterator<JsonNode> it = o.elements(); it.hasNext(); ) stripDerivedUrls(it.next());
        } else if (node.isArray()) {
            for (JsonNode child : node) stripDerivedUrls(child);
        }
    }

    private static void removeIfScalar(ObjectNode o, String field) {
        JsonNode v = o.get(field);
        if (v != null && (v.isTextual() || v.isNull())) o.remove(field);
    }

    // ── 规范化与指纹 ────────────────────────────────────────────────────────────

    /** 规范化 JSON：对象按键名排序、紧凑输出。同一份内容无论字段顺序如何都得到同一个字符串。 */
    public static String canonicalJson(JsonNode doc) {
        try {
            return WRITER.writeValueAsString(canonicalize(doc, JsonNodeFactory.instance));
        } catch (Exception e) {
            throw new IllegalArgumentException("画布文档无法序列化", e);
        }
    }

    private static JsonNode canonicalize(JsonNode n, JsonNodeFactory f) {
        if (n == null) return f.nullNode();
        if (n.isObject()) {
            ObjectNode out = f.objectNode();
            TreeSet<String> names = new TreeSet<>();
            n.fieldNames().forEachRemaining(names::add);
            for (String name : names) out.set(name, canonicalize(n.get(name), f));
            return out;
        }
        if (n.isArray()) {
            ArrayNode out = f.arrayNode();
            for (JsonNode c : n) out.add(canonicalize(c, f));
            return out;
        }
        return n;
    }

    /**
     * 只对文档内容的指纹 = 规范化 JSON（UTF-8）的 SHA-256 前 16 位 hex。
     *
     * <p><b>这不是库里存的 docVersion</b>：画布的版本还要覆盖标题（{@link #docVersionOf(String, String)}），
     * 否则 A 页面只改名、B 页面带旧版本保存能无冲突地把新标题盖掉（Codex 评审 P2-7）。
     * 这个单参数版只给「比两份内容是否相同」这类不涉及保存的场景用。
     */
    public static String docVersionOf(String canonicalJson) {
        return sha256Head(canonicalJson == null ? "" : canonicalJson);
    }

    /**
     * 画布版本（库里 {@code doc_version} 的真值，保存 / 生成请求比对的就是它）
     * = SHA-256(规范化 JSON + NUL（U+0000）+ 标题) 前 16 位 hex。文档或标题任一变了版本就变。
     * NUL 做分隔：JSON 规范化输出里不会出现裸的 NUL（字符串里的会被转义成 \\u0000 六个字符），两段拼不出歧义。
     */
    public static String docVersionOf(String canonicalJson, String title) {
        return sha256Head((canonicalJson == null ? "" : canonicalJson) + "\0" + (title == null ? "" : title));
    }

    private static String sha256Head(String input) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    // ── 小工具 ──────────────────────────────────────────────────────────────────

    /** 字段是数组就返回它，否则空数组（不抛）。 */
    static JsonNode arr(JsonNode n, String field) {
        if (n == null) return JsonNodeFactory.instance.arrayNode();
        JsonNode v = n.get(field);
        return v != null && v.isArray() ? v : JsonNodeFactory.instance.arrayNode();
    }

    /** 字段是非空白字符串就返回它（原样），否则 null。 */
    static String text(JsonNode n, String field) {
        if (n == null || !n.isObject()) return null;
        JsonNode v = n.get(field);
        if (v == null || !v.isTextual()) return null;
        String s = v.asText();
        return s.isBlank() ? null : s;
    }

    private static Optional<JsonNode> byId(JsonNode array, String id) {
        for (JsonNode n : array) {
            if (n.isObject() && id.equals(text(n, "id"))) return Optional.of(n);
        }
        return Optional.empty();
    }

    private static Optional<JsonNode> byNo(JsonNode array, int no) {
        for (JsonNode n : array) {
            if (!n.isObject()) continue;
            JsonNode v = n.get("no");
            if (v != null && v.isIntegralNumber() && v.canConvertToInt() && v.intValue() == no) return Optional.of(n);
        }
        return Optional.empty();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
