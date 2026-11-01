package com.aistareco.aep.ipstudio.prompt;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 提示词模板（docs/studio-prompt-architecture.md §3.3）：Mustache 的无逻辑子集，只有三种写法 ——
 * {@code {{变量}}}、{@code {{#有}}…{{/有}}} / {@code {{^有}}…{{/有}}}、列表逐项（列表里可用 {@code -first} / {@code -last} / {@code -index}）。
 * 不转义、不做运算；判断和数值由代码算好传进来。
 *
 * <p>和旧的 {@code PromptService.fill} 兼容：{@code {{ name }}} 两边可以有空格，缺的变量替换成空串，所以现有提示词原样搬进来
 * 渲染结果逐字不变。另外两条行规则：
 * <ul>
 *   <li>只有一个区段标签（{@code {{#x}}} {@code {{/x}}} {@code {{^x}}}）的行整行去掉（Mustache 规范的 standalone）；</li>
 *   <li>只有一个分层变量（{@code {{base}}} {@code {{method}}} {@code {{scene}}}）或输出格式（{@code {{format.<名>}}}）且它渲染为空的
 *       行整行去掉：底座为空、没有内容方法、这次不需要某段格式时都不留空行。</li>
 * </ul>
 * 变量名先按整个名字找（调用方可以直接传 {@code "format.output"} 这样的键），找不到再按点号逐级找。
 */
public final class PromptTemplate {
    private PromptTemplate() {}

    /** 分层变量：环节模板用它们说明底座、方法、场景放在哪。 */
    public static final Set<String> LAYER_VARS = Set.of("base", "method", "scene");
    /** 代码提供的输出格式：{@code {{format.<名>}}}。 */
    public static final String FORMAT_PREFIX = "format.";

    private static final Pattern TAG = Pattern.compile("\\{\\{\\s*([#^/]?)\\s*([A-Za-z0-9_.\\-]+|\\.)\\s*}}");

    private sealed interface Node permits Text, Var, Section {}
    private record Text(String text) implements Node {}
    /** {@code lead} / {@code trail}: a standalone layer variable's indentation and line break, dropped together when it renders empty. */
    private record Var(String name, String lead, String trail) implements Node {}
    private record Section(String name, boolean inverted, List<Node> children) implements Node {}

    /** 渲染。语法错误（区段没关、关错）抛 {@link IllegalArgumentException}。 */
    public static String render(String template, Map<String, ?> vars) {
        if (template == null || template.isEmpty()) return "";
        StringBuilder out = new StringBuilder();
        Deque<Object> stack = new ArrayDeque<>();
        stack.push(vars == null ? Map.of() : vars);
        renderNodes(parse(template), stack, out);
        return out.toString();
    }

    /** 只检查语法（发布、灌种子时用）。 */
    public static void check(String template) { if (template != null) parse(template); }

    /** 模板里用到的所有名字（变量和区段），用于核对是否都是调用点登记过的变量；{@code .} 和 {@code -first} 这类不算。 */
    public static Set<String> names(String template) {
        Set<String> out = new LinkedHashSet<>();
        if (template != null) collect(parse(template), out, 0);
        return out;
    }

    private static void collect(List<Node> nodes, Set<String> out, int depth) {
        for (Node node : nodes) {
            if (node instanceof Var v) { if (counts(v.name(), depth)) out.add(v.name()); }
            else if (node instanceof Section s) {
                if (counts(s.name(), depth)) out.add(s.name());
                collect(s.children(), out, depth + 1);
            }
        }
    }

    /** 区段里面的名字可能是列表项的字段（{@code {{#refs}}{{title}}{{/refs}}}），只核对最外层。 */
    /** 独占一行、渲染为空时整行去掉的变量：分层变量和输出格式。 */
    static boolean block(String name) { return LAYER_VARS.contains(name) || name.startsWith(FORMAT_PREFIX); }

    private static boolean counts(String name, int depth) { return depth == 0 && !".".equals(name) && !name.startsWith("-"); }

    // ── 解析 ──────────────────────────────────────────────────────────────────────────────────────────────────

    private static List<Node> parse(String template) {
        List<Node> root = new ArrayList<>();
        Deque<List<Node>> lists = new ArrayDeque<>();
        Deque<String> open = new ArrayDeque<>();
        lists.push(root);
        Matcher m = TAG.matcher(template);
        int pos = 0;
        while (m.find(pos)) {
            String sigil = m.group(1), name = m.group(2);
            int start = m.start(), end = m.end();
            int lineStart = template.lastIndexOf('\n', start - 1) + 1;
            int lineEnd = template.indexOf('\n', end);
            boolean aloneBefore = template.substring(lineStart, start).isBlank();
            boolean aloneAfter = template.substring(end, lineEnd < 0 ? template.length() : lineEnd).isBlank();
            boolean standalone = aloneBefore && aloneAfter;
            int textEnd = standalone ? lineStart : start;
            int next = standalone ? (lineEnd < 0 ? template.length() : lineEnd + 1) : end;
            // only section tags and layer variables are standalone-aware; any other variable keeps its line as written
            if (sigil.isEmpty() && standalone && !block(name)) { textEnd = start; next = end; }
            if (textEnd > pos) lists.peek().add(new Text(template.substring(pos, textEnd)));
            switch (sigil) {
                case "#", "^" -> {
                    List<Node> children = new ArrayList<>();
                    lists.peek().add(new Section(name, "^".equals(sigil), children));
                    lists.push(children);
                    open.push(name);
                }
                case "/" -> {
                    if (open.isEmpty() || !open.peek().equals(name))
                        throw new IllegalArgumentException("区段 {{/" + name + "}} 没有对应的开头" + (open.isEmpty() ? "" : "（应先关 {{/" + open.peek() + "}}）"));
                    open.pop();
                    lists.pop();
                }
                default -> {
                    if (standalone && block(name))
                        lists.peek().add(new Var(name, template.substring(lineStart, start), lineEnd < 0 ? "" : "\n"));
                    else lists.peek().add(new Var(name, "", ""));
                }
            }
            pos = next;
        }
        if (!open.isEmpty()) throw new IllegalArgumentException("区段 {{#" + open.peek() + "}} 没有结尾 {{/" + open.peek() + "}}");
        if (pos < template.length()) root.add(new Text(template.substring(pos)));
        return root;
    }

    // ── 渲染 ──────────────────────────────────────────────────────────────────────────────────────────────────

    private static void renderNodes(List<Node> nodes, Deque<Object> stack, StringBuilder out) {
        for (Node node : nodes) {
            if (node instanceof Text t) out.append(t.text());
            else if (node instanceof Var v) {
                String value = text(lookup(v.name(), stack));
                if (!v.lead().isEmpty() || !v.trail().isEmpty()) {
                    if (value.isEmpty()) continue;
                    out.append(v.lead()).append(value).append(v.trail());
                } else out.append(value);
            } else if (node instanceof Section s) {
                Object value = lookup(s.name(), stack);
                if (s.inverted()) { if (!truthy(value)) renderNodes(s.children(), stack, out); continue; }
                if (!truthy(value)) continue;
                if (value instanceof Collection<?> items) {
                    int i = 0, n = items.size();
                    for (Object item : items) {
                        Map<String, Object> meta = new LinkedHashMap<>();
                        meta.put("-first", i == 0); meta.put("-last", i == n - 1); meta.put("-index", i + 1);
                        stack.push(meta); stack.push(item);
                        renderNodes(s.children(), stack, out);
                        stack.pop(); stack.pop();
                        i++;
                    }
                } else {
                    stack.push(value);
                    renderNodes(s.children(), stack, out);
                    stack.pop();
                }
            }
        }
    }

    private static Object lookup(String name, Deque<Object> stack) {
        if (".".equals(name)) return stack.peek();
        for (Object frame : stack) {
            if (!(frame instanceof Map<?, ?> map)) continue;
            if (map.containsKey(name)) return map.get(name);
            int dot = name.indexOf('.');
            if (dot > 0 && map.containsKey(name.substring(0, dot))) return dotted(map.get(name.substring(0, dot)), name.substring(dot + 1));
        }
        return null;
    }

    private static Object dotted(Object value, String rest) {
        for (String part : rest.split("\\.")) {
            if (!(value instanceof Map<?, ?> map)) return null;
            value = map.get(part);
        }
        return value;
    }

    static boolean truthy(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean b) return b;
        if (value instanceof CharSequence s) return !s.isEmpty();
        if (value instanceof Collection<?> c) return !c.isEmpty();
        return true;
    }

    private static String text(Object value) {
        if (value == null || value instanceof Map<?, ?> || value instanceof Collection<?>) return "";
        return String.valueOf(value);
    }
}
