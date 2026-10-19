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
    public static String line(IpDialogueMessage m) {
        String who = switch (m.getRole()) { case "user" -> "用户"; case "assistant" -> "助手"; default -> "系统"; };
        StringBuilder out = new StringBuilder(who).append("：").append(m.getText() == null ? "" : m.getText().strip());
        for (JsonNode b : blocks(m)) {
            switch (b.path("type").asText()) {
                case "plan" -> out.append(" [方案第").append(b.path("revision").asInt()).append("版：")
                        .append(b.path("plan").path("summary").asText()).append("；").append(b.path("plan").path("steps").size()).append(" 步]");
                case "approval" -> out.append(" [确认卡 ").append(b.path("approvalId").asText()).append("：报价 ")
                        .append(b.path("quotedCost").asLong()).append("，上限 ").append(b.path("budgetCap").asLong()).append("，").append(b.path("status").asText()).append("]");
                case "question" -> out.append(" [提问：").append(b.path("text").asText()).append("]");
                case "adoption" -> out.append(" [改稿建议 ").append(b.path("nodeId").asText()).append("：").append(b.path("status").asText()).append("]");
                case "tool_call" -> out.append(" [").append(b.path("title").asText()).append("：").append(b.path("status").asText())
                        .append(b.path("result").path("summary").isTextual() ? "，" + b.path("result").path("summary").asText() : "").append("]");
                default -> { }
            }
        }
        return out.toString();
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
