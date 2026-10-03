package com.aistareco.aep.service.ai;

import java.util.ArrayList;
import java.util.List;

/**
 * 大模型 JSON 输出的最小修复：补齐漏写的容器闭合符（{@code ]} / {@code }}）。
 *
 * <p>部分 OpenAI 兼容模型（线上实测 Qwen3.5-9B）在 {@code finish_reason=stop} 时仍会漏掉一个闭合符，
 * 例如 {@code {"characters":[{"looks":[{...}}]}} 里 looks 少一个 {@code ]}。这里只补
 * <b>由当前嵌套栈唯一确定</b>的闭合符，不改任何字段和值；遇到没法由嵌套关系解释的闭合符就放弃（返回 null）。
 * 修出来的东西是否可用仍由调用方的形状校验决定 —— 这一步只让「差一个括号」不再整份作废。
 *
 * <p>算法原样搬自 {@code DramaScriptService}（commit 92ba5421），两处共用这一份（AGENTS.md §8.0.1 ④）。
 */
public final class ModelJsonRepair {

    private ModelJsonRepair() {}

    /**
     * 修复 JSON 中遗漏的容器闭合符。
     *
     * @return 修好的 JSON 文本（本来就平衡时与输入相同）；输入为 null、停在字符串中间、或出现无法解释的闭合符 → null
     */
    public static String repairUnbalancedClosers(String json) {
        if (json == null) return null;
        StringBuilder repaired = new StringBuilder(json.length() + 8);
        List<Character> stack = new ArrayList<>();
        boolean inString = false;
        boolean escaped = false;

        for (int i = 0; i < json.length(); i++) {
            char ch = json.charAt(i);
            repaired.append(ch);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch == '\\') {
                    escaped = true;
                } else if (ch == '"') {
                    inString = false;
                }
                continue;
            }
            if (ch == '"') {
                inString = true;
            } else if (ch == '{' || ch == '[') {
                stack.add(ch);
            } else if (ch == '}' || ch == ']') {
                char expectedOpen = ch == '}' ? '{' : '[';
                int matchingIndex = stack.lastIndexOf(expectedOpen);
                if (matchingIndex < 0) return null;
                while (stack.size() - 1 > matchingIndex) {
                    char missingOpen = stack.remove(stack.size() - 1);
                    repaired.insert(repaired.length() - 1, missingOpen == '{' ? '}' : ']');
                }
                stack.remove(stack.size() - 1);
            }
        }
        if (inString) return null;
        for (int i = stack.size() - 1; i >= 0; i--) {
            repaired.append(stack.get(i) == '{' ? '}' : ']');
        }
        return repaired.toString();
    }
}
