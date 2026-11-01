package com.aistareco.aep.ipstudio.prompt;

import com.aistareco.aep.dto.PromptParamsDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * 按层拼出一次调用的 system 和 user（docs/studio-prompt-architecture.md §3）。
 *
 * <p>先把方法、场景正文按运行时变量渲染出来，再渲染环节模板：{@code {{base}}} {@code {{method}}} {@code {{scene}}} 是渲染好的
 * 各层正文，{@code {{format.<名>}}} 是调用点登记的输出格式（代码按变量生成），其余是运行时变量。
 *
 * <p><b>冻结版本</b>（§3.4）：受理时 {@link #freeze} 记下这个任务可能用到的各条目版本，之后每次调用都按冻结的版本渲染，
 * 后台发布新版本不影响在途任务；每次调用的记录（{@link Assembled#call}）追加在任务输入里，完整文本靠上游调用日志。
 */
@Component
public class StudioPromptAssembler {
    private final StudioPromptLibrary library;

    public StudioPromptAssembler(StudioPromptLibrary library) { this.library = library; }

    public StudioPromptLibrary library() { return library; }

    /**
     * 一次调用。
     *
     * @param method 内容方法的 key，没有就 null（{@code {{method}}} 渲染为空，独占一行时整行去掉）
     * @param scene  场景条目的 key，没有就 null
     * @param frozen 冻结的版本：key → 版本号；为 null 时用当前版本
     * @param sceneFallback 库里没有这个场景条目时用的场景正文（后台新建、还没来得及进库的场景）
     */
    public record Call(String stage, String method, String scene, Map<String, ?> vars, Map<String, Integer> frozen, String sceneFallback) {
        public Call(String stage, String method, String scene, Map<String, ?> vars, Map<String, Integer> frozen) {
            this(stage, method, scene, vars, frozen, null);
        }
    }

    public record Ref(String key, int version, String digest) {}

    /** 拼好的结果：两段文字、环节参数、用到的条目。 */
    public record Assembled(String stage, String system, String user, PromptParamsDto params, List<Ref> refs) {
        public String systemDigest() { return sha256(system); }
        public String userDigest() { return sha256(user); }

        /** 一次调用的记录（§3.4）：环节、用到的版本、两段文字的摘要；参数由调用点补上实际发出的值。 */
        public ObjectNode call(ObjectMapper mapper, int seq, String toolCallId) {
            ObjectNode out = mapper.createObjectNode().put("seq", seq).put("stage", stage);
            if (toolCallId != null) out.put("toolCallId", toolCallId);
            ObjectNode versions = out.putObject("versions");
            for (Ref r : refs) versions.put(r.key(), r.version());
            out.put("systemDigest", systemDigest()).put("userDigest", userDigest());
            return out;
        }
    }

    public Assembled assemble(Call call) {
        StudioPromptEntry stage = entry(call.stage(), call.frozen(), true);
        if (!stage.stage()) throw new IllegalStateException(call.stage() + " 不是环节");
        Map<String, Object> vars = new LinkedHashMap<>();
        if (call.vars() != null) call.vars().forEach(vars::put);
        List<Ref> refs = new ArrayList<>();
        refs.add(new Ref(stage.key(), stage.version(), stage.digest()));
        boolean llm = StudioPromptEntry.LLM.equals(stage.target());
        if (llm) {
            StudioPromptEntry base = entry(StudioPromptEntry.BASE, call.frozen(), false);
            vars.put("base", base == null ? "" : PromptTemplate.render(base.body(), vars));
            if (base != null) refs.add(new Ref(base.key(), base.version(), base.digest()));
        } else vars.put("base", "");
        StudioPromptEntry method = call.method() == null ? null : entry(call.method(), call.frozen(), false);
        vars.put("method", method == null ? "" : PromptTemplate.render(method.body(), vars));
        if (method != null) refs.add(new Ref(method.key(), method.version(), method.digest()));
        StudioPromptEntry scene = call.scene() == null ? null : entry(call.scene(), call.frozen(), false);
        vars.put("scene", scene != null ? PromptTemplate.render(scene.body(), vars) : call.sceneFallback() == null ? "" : call.sceneFallback());
        if (scene != null) refs.add(new Ref(scene.key(), scene.version(), scene.digest()));
        StudioPromptStages.find(stage.key()).ifPresent(s -> s.renderFormats(vars).forEach((name, text) -> vars.put(PromptTemplate.FORMAT_PREFIX + name, text)));
        return new Assembled(stage.key(), PromptTemplate.render(stage.system(), vars), PromptTemplate.render(stage.user(), vars), stage.params(), List.copyOf(refs));
    }

    /** 受理时冻结：这些条目（加上底座）的当前版本；不存在的 key 不记（拼装时按「没有」处理）。 */
    public Map<String, Integer> freeze(Collection<String> keys) {
        Map<String, Integer> out = new LinkedHashMap<>();
        Set<String> all = new LinkedHashSet<>(keys);
        all.add(StudioPromptEntry.BASE);
        for (String key : all) if (key != null) library.find(key).ifPresent(e -> out.put(key, e.version()));
        return out;
    }

    /** 冻结的版本写进任务输入（{@code _exec.prompt.versions}）。 */
    public static ObjectNode frozenNode(ObjectMapper mapper, Map<String, Integer> frozen) {
        ObjectNode out = mapper.createObjectNode();
        frozen.forEach(out::put);
        return out;
    }

    /** 从任务输入读回冻结的版本；没有就返回 null（老任务按当前版本）。 */
    public static Map<String, Integer> frozen(JsonNode prompt) {
        if (prompt == null || !prompt.path("versions").isObject()) return null;
        Map<String, Integer> out = new LinkedHashMap<>();
        prompt.path("versions").fields().forEachRemaining(e -> out.put(e.getKey(), e.getValue().asInt()));
        return out;
    }

    /** 往任务输入的 {@code _exec.prompt.calls} 追加一条调用记录。 */
    public static void appendCall(ObjectNode prompt, ObjectNode call) {
        ArrayNode calls = prompt.has("calls") && prompt.get("calls").isArray() ? (ArrayNode) prompt.get("calls") : prompt.putArray("calls");
        calls.add(call);
    }

    private StudioPromptEntry entry(String key, Map<String, Integer> frozen, boolean required) {
        Integer version = frozen == null ? null : frozen.get(key);
        if (version != null) {
            var pinned = library.version(key, version);
            if (pinned.isPresent()) return pinned.get();
            if (required) throw new IllegalStateException("提示词库缺少 " + key + " v" + version);
            return null;
        }
        if (frozen != null && !required) return null; // frozen without this key: it did not exist when the task was accepted
        var current = library.find(key);
        if (current.isEmpty() || current.get().withdrawn()) {
            if (required) throw new IllegalStateException("提示词库缺少条目 " + key);
            return null;
        }
        return current.get();
    }

    static String sha256(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((text == null ? "" : text).getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
