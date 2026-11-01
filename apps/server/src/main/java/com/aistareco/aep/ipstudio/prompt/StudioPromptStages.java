package com.aistareco.aep.ipstudio.prompt;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

/**
 * 调用点登记表（docs/studio-prompt-architecture.md §3.2）：代码里每个调用模型的地方用哪个环节、能用哪些变量、有哪几段输出格式。
 * 这是代码和提示词库之间唯一的约定：环节正文由后台改，变量清单和输出格式由代码定；发布环节时按这里核对，
 * 用了没登记的变量、缺了必填变量或某段格式，都不让发布。
 *
 * <p>输出格式由代码生成（它和解析代码是一对），按调用时的变量渲染，比如镜头行例子里的秒数跟着时长走。
 */
public final class StudioPromptStages {
    private StudioPromptStages() {}

    /**
     * @param vars     能用的运行时变量：名字 → 说明（后台预览时显示）
     * @param required 必须出现在模板里的变量
     * @param formats  输出格式：名字（模板里写 {@code {{format.<名>}}}）→ 按变量生成格式文字
     * @param sample   后台预览用的示例变量
     * @param base     拼哪份底座：默认平台底座 {@code base}；导演台用自己的 {@code base-director}（短剧是虚构创作，
     *                 平台底座里面向商品宣传的事实规则不适用）；只看画面、不写文案的环节（看图、复刻逐页观察、拉片、分批读图）
     *                 为 null，不拼底座（docs/studio-prompt-architecture.md §14.2）
     */
    public record Stage(String key, String target, String title, Map<String, String> vars, Set<String> required,
                        Map<String, Function<Map<String, ?>, String>> formats, Map<String, Object> sample, String base) {
        public Stage(String key, String target, String title, Map<String, String> vars, Set<String> required,
                     Map<String, Function<Map<String, ?>, String>> formats, Map<String, Object> sample) {
            this(key, target, title, vars, required, formats, sample, StudioPromptEntry.BASE);
        }

        /** 不拼底座的调用点（只看画面、不写文案）。 */
        public Stage withoutBase() { return new Stage(key, target, title, vars, required, formats, sample, null); }

        public Map<String, String> renderFormats(Map<String, ?> vars) {
            Map<String, String> out = new LinkedHashMap<>();
            formats.forEach((name, f) -> out.put(name, f.apply(vars == null ? Map.of() : vars)));
            return out;
        }
    }

    private static final Map<String, Stage> STAGES = new LinkedHashMap<>();

    static synchronized void register(Stage stage) {
        if (STAGES.containsKey(stage.key())) throw new IllegalStateException("duplicate prompt stage " + stage.key());
        // base / method / scene 是拼装器填的分层正文，同名的运行时变量会被盖掉（导演台资产图的 scene 开关就这样失效过）
        for (String name : stage.vars().keySet())
            if (PromptTemplate.LAYER_VARS.contains(name) || name.startsWith(PromptTemplate.FORMAT_PREFIX))
                throw new IllegalStateException(stage.key() + " 的变量 " + name + " 和分层变量或输出格式重名");
        STAGES.put(stage.key(), stage);
    }

    static {
        StudioPromptCallPoints.registerAll();
    }

    public static Optional<Stage> find(String key) { return Optional.ofNullable(STAGES.get(key)); }

    public static Collection<Stage> all() { return Collections.unmodifiableCollection(STAGES.values()); }

    /** 环节条目和它的调用点对得上：target 一致、变量都登记过、必填变量和每段格式都在、要拼底座的放了 {{base}}。 */
    static void check(StudioPromptEntry entry) {
        Stage stage = STAGES.get(entry.key());
        if (stage == null) throw new IllegalArgumentException("环节「" + entry.key() + "」没有对应的调用点（代码里没有登记）");
        if (!stage.target().equals(entry.target()))
            throw new IllegalArgumentException("环节「" + entry.key() + "」的 target 应为 " + stage.target());
        Set<String> names = new LinkedHashSet<>(PromptTemplate.names(entry.system()));
        names.addAll(PromptTemplate.names(entry.user()));
        for (String n : names) {
            if (PromptTemplate.LAYER_VARS.contains(n)) continue;
            if (n.startsWith(PromptTemplate.FORMAT_PREFIX)) {
                if (!stage.formats().containsKey(n.substring(PromptTemplate.FORMAT_PREFIX.length())))
                    throw new IllegalArgumentException("{{" + n + "}} 不是这个调用点的输出格式");
                continue;
            }
            if (!stage.vars().containsKey(n)) throw new IllegalArgumentException("{{" + n + "}} 不是这个调用点登记的变量");
        }
        if (StudioPromptEntry.LLM.equals(stage.target()) && stage.base() != null && !names.contains("base"))
            throw new IllegalArgumentException("调用大模型的环节必须放 {{base}}");
        for (String f : stage.formats().keySet())
            if (!names.contains(PromptTemplate.FORMAT_PREFIX + f)) throw new IllegalArgumentException("缺少输出格式 {{format." + f + "}}");
        for (String r : stage.required())
            if (!names.contains(r)) throw new IllegalArgumentException("缺少必填变量 {{" + r + "}}");
    }
}
