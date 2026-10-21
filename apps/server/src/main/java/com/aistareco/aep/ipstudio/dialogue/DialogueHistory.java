package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

/**
 * Compacted conversation history for the model (§连续线程与自动上下文). Recent messages are kept verbatim within a
 * character budget; older ones are represented by the thread's cached summary (produced by a billed summary call). The
 * latest plan revision and approved authorizations are always carried as structured originals, never paraphrased.
 */
public final class DialogueHistory {
    public static final int RECENT_BUDGET = 12_000;
    private static final ObjectMapper OM = new ObjectMapper();
    private DialogueHistory() {}

    /** Split: which messages fit verbatim (newest first budget), and which older ones still need summarizing. */
    public record Window(List<IpDialogueMessage> verbatim, List<IpDialogueMessage> older) {}

    public static Window window(List<IpDialogueMessage> ascending, int budget) {
        List<IpDialogueMessage> verbatim = new ArrayList<>();
        int used = 0, cut = ascending.size();
        for (int i = ascending.size() - 1; i >= 0; i--) {
            int size = line(ascending.get(i)).length();
            if (used + size > budget && !verbatim.isEmpty()) { cut = i + 1; break; }
            used += size;
            verbatim.add(0, ascending.get(i));
            cut = i;
        }
        return new Window(verbatim, List.copyOf(ascending.subList(0, cut)));
    }

    /**
     * @param summary cached summary covering {@code older} (null when there is none and nothing was summarized)
     * @param omitted older messages that are neither verbatim nor covered by a summary (stated, never invented)
     */
    public static String render(Window window, String summary, int omitted, List<IpDialogueMessage> all) {
        StringBuilder out = new StringBuilder();
        String confirmed = confirmed(all);
        if (!confirmed.isBlank()) out.append("已确认与进行中的事项（原文，不是摘要）：\n").append(confirmed).append('\n');
        if (summary != null && !summary.isBlank()) out.append("更早对话的要点（摘要，可回看原文）：\n").append(summary.strip()).append('\n');
        if (omitted > 0) out.append("（更早的 ").append(omitted).append(" 条对话没有放进来，用户可在对话里回看原文）\n");
        if (window.verbatim().isEmpty()) return out.length() == 0 ? "（这是对话的开始）" : out.toString();
        out.append("近期对话：\n");
        for (var m : window.verbatim()) out.append(line(m)).append('\n');
        return out.toString();
    }

    /** One message as a history line (blocks summarized by their structured fields). */
    /**
     * One message for the prompt. What the server recorded (tool runs, plans, cards, questions) goes on its own
     * 「（服务端记录…）」 line in Chinese, never inline in the assistant's words: the inline 「[查看画布：done，…]」 form was
     * copied by the model into its prose as if it had called the tool (IPT-2f13c2ed42994624907d seq 12, nothing ran).
     */
    public static String line(IpDialogueMessage m) {
        String who = switch (m.getRole()) { case "user" -> "用户"; case "assistant" -> "助手"; default -> "系统"; };
        StringBuilder out = new StringBuilder(who).append("：").append(m.getText() == null ? "" : m.getText().strip());
        List<String> records = new ArrayList<>();
        for (JsonNode b : blocks(m)) {
            switch (b.path("type").asText()) {
                case "plan" -> records.add("提出了方案第 " + b.path("revision").asInt() + " 版（" + b.path("plan").path("summary").asText()
                        + "；" + b.path("plan").path("steps").size() + " 步）");
                case "approval" -> records.add("发出确认卡 " + b.path("approvalId").asText() + "（报价 " + b.path("quotedCost").asLong()
                        + "，上限 " + b.path("budgetCap").asLong() + "，" + approvalStatus(b.path("status").asText()) + "）");
                case "question" -> records.add("向用户提问：" + b.path("text").asText());
                case "adoption" -> records.add("给 " + b.path("nodeId").asText() + " 提了改稿建议（" + b.path("status").asText() + "）");
                case "tool_call" -> records.add("调用「" + b.path("title").asText() + "」" + toolStatus(b.path("status").asText())
                        + (b.path("result").path("summary").isTextual() ? "，结果：" + b.path("result").path("summary").asText() : ""));
                default -> { }
            }
        }
        if (!records.isEmpty()) out.append("\n  （服务端记录，不是对话内容，不要在回复里模仿：").append(String.join("；", records)).append("）");
        return out.toString();
    }

    private static String toolStatus(String status) {
        return switch (status) { case "done" -> "已完成"; case "failed" -> "失败"; case "running" -> "进行中"; default -> status; };
    }

    private static String approvalStatus(String status) {
        return switch (status) { case "pending" -> "待确认"; case "approved" -> "已确认"; case "superseded" -> "已被新方案取代"; case "expired" -> "已过期"; default -> status; };
    }

    /** Latest plan revision and every approved approval, verbatim (structured originals survive any compaction). */
    static String confirmed(List<IpDialogueMessage> all) {
        JsonNode latestPlan = null;
        List<String> approvals = new ArrayList<>();
        for (var m : all) for (JsonNode b : blocks(m)) {
            if ("plan".equals(b.path("type").asText())) latestPlan = b;
            if ("approval".equals(b.path("type").asText()) && "approved".equals(b.path("status").asText()))
                approvals.add("确认卡 " + b.path("approvalId").asText() + "：阶段 " + b.path("stage").asText() + "，方案指纹 "
                        + b.path("planFingerprint").asText() + "，报价 " + b.path("quotedCost").asLong() + "，上限 " + b.path("budgetCap").asLong()
                        + (b.hasNonNull("approvedMessageId") ? "，确认消息 " + b.path("approvedMessageId").asText() : ""));
        }
        StringBuilder out = new StringBuilder();
        if (latestPlan != null) out.append("最新方案（第").append(latestPlan.path("revision").asInt()).append("版，指纹 ")
                .append(latestPlan.path("fingerprint").asText()).append("）：").append(bounded(latestPlan.path("plan").toString(), 12_000)).append('\n');
        approvals.forEach(a -> out.append(a).append('\n'));
        return out.toString();
    }

    private static String bounded(String text, int max) { return text.length() <= max ? text : text.substring(0, max) + "…（方案原文较长，完整内容见对话中的方案卡）"; }

    static List<JsonNode> blocks(IpDialogueMessage m) {
        try {
            JsonNode node = m.getBlocksJson() == null ? null : OM.readTree(m.getBlocksJson());
            List<JsonNode> out = new ArrayList<>();
            if (node != null && node.isArray()) node.forEach(out::add);
            return out;
        } catch (Exception e) { return List.of(); }
    }
}
