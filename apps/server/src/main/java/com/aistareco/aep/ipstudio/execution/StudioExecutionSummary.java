package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

/**
 * The closing message of an execution (D07, plan §时间线中的审批追问与收尾): what it really cost per stage (the
 * refreshed spent / in-flight, never quotes), which steps finished and which results the user adopted, which checks the
 * AI judged failed or could not judge (with the check's own reason), and two or three follow-ups derived from what was
 * actually produced. Follow-ups are prompts the user can send; anything paid they lead to still goes through a card.
 */
final class StudioExecutionSummary {
    private StudioExecutionSummary() {}

    record Summary(String text, List<String> suggestions) {}

    /** Native run projection by id (null when not visible). */
    interface Runs { IpRunDto run(String runId); }

    static Summary build(IpPlanExecution e, ObjectNode state, ObjectNode budget, Runs runs) {
        List<String> lines = new ArrayList<>();
        lines.add(switch (e.getStatus()) {
            case IpPlanExecution.DONE -> "这次制作完成了。";
            case IpPlanExecution.PARTIAL -> "这次制作超过 90 分钟，停在了中途。";
            case IpPlanExecution.FAILED -> "这次制作没有完成。";
            default -> "这次制作已经停止。";
        });
        lines.add(costLine(budget));

        Map<String, List<String>> done = new LinkedHashMap<>();
        List<String> unfinished = new ArrayList<>(), checks = new ArrayList<>();
        for (JsonNode step : state.path("steps")) {
            String title = "「" + step.path("title").asText() + "」", status = step.path("status").asText();
            if ("done".equals(status)) done.computeIfAbsent(step.path("stage").asText("production"), k -> new ArrayList<>())
                    .add(title + (step.hasNonNull("acceptedRunId") ? "（已采用）" : ""));
            else if (!"skipped".equals(status) || !IpPlanExecution.DONE.equals(e.getStatus())) unfinished.add(title);
            if ("check".equals(step.path("operation").asText()) && "done".equals(status)) {
                String verdict = step.path("checkStatus").asText("unknown");
                if (!"pass".equals(verdict)) checks.add("检查" + title + "：AI 判断" + ("fail".equals(verdict) ? "没通过" : "无法判断") + reason(step, runs));
            }
        }
        if (done.size() == 1) lines.add("做完的步骤：" + String.join("", done.values().iterator().next()) + "。");
        else if (!done.isEmpty()) {
            List<String> parts = new ArrayList<>();
            done.forEach((stage, titles) -> parts.add(("analysis".equals(stage) ? "分析" : "制作") + String.join("", titles)));
            lines.add("做完的步骤：" + String.join("；", parts) + "。");
        }
        if (!unfinished.isEmpty()) lines.add("没做完的步骤：" + String.join("", unfinished) + "。");
        lines.addAll(checks);
        if (!done.isEmpty()) lines.add("每一步的结果都在画布上。");
        return new Summary(String.join("\n", lines), suggestions(e, state));
    }

    private static String costLine(JsonNode budget) {
        List<String> parts = new ArrayList<>();
        long total = 0, dialogue = 0, settling = 0;
        for (String stage : List.of("analysis", "production")) {
            JsonNode b = budget.path(stage);
            if (!b.isObject()) continue;
            long spent = b.path("spent").asLong();
            parts.add(("analysis".equals(stage) ? "分析 " : "制作 ") + spent + " 积分");
            total += spent;
            dialogue += b.path("dialogueSpent").asLong(0);
            settling += b.path("inFlight").asLong(0);
        }
        StringBuilder out = new StringBuilder("实际花费：").append(parts.isEmpty() ? "0 积分" : String.join("，", parts));
        if (parts.size() > 1) out.append("，共 ").append(total).append(" 积分");
        if (dialogue > 0) out.append("（其中对话 ").append(dialogue).append(" 积分）");
        out.append("。");
        if (settling > 0) out.append("还有任务在结算（最多 ").append(settling).append(" 积分），最终以账单为准。");
        return out.toString();
    }

    /** The first non-passing item's own reason from the check run's output, or nothing. */
    private static String reason(JsonNode step, Runs runs) {
        JsonNode ids = step.path("runIds");
        if (!ids.isArray() || ids.isEmpty()) return "。";
        IpRunDto run = runs.run(ids.get(ids.size() - 1).asText());
        if (run == null || run.output() == null) return "。";
        for (JsonNode item : run.output().path("check").path("items")) {
            if ("pass".equals(item.path("status").asText())) continue;
            String why = item.path("reason").asText("").strip();
            if (!why.isEmpty()) return "，" + (why.length() > 80 ? why.substring(0, 80) + "…" : why) + "。";
        }
        return "。";
    }

    /** Two or three follow-ups from the real outputs, only for actions that exist. */
    static List<String> suggestions(IpPlanExecution e, ObjectNode state) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        List<JsonNode> videos = new ArrayList<>();
        JsonNode assembled = null, lastText = null;
        String firstUnfinished = null;
        for (JsonNode step : state.path("steps")) {
            String op = step.path("operation").asText(), status = step.path("status").asText();
            if ("production".equals(step.path("stage").asText()) && "video".equals(op)) videos.add(step);
            if ("assemble".equals(op) && "done".equals(status)) assembled = step;
            if ("text".equals(op) && "done".equals(status)) lastText = step;
            if (firstUnfinished == null && !"done".equals(status) && !"skipped".equals(status)) firstUnfinished = step.path("title").asText();
        }
        // A check that did not pass points at the clip to redo.
        for (JsonNode step : state.path("steps")) {
            if (!"check".equals(step.path("operation").asText()) || !"done".equals(step.path("status").asText()) || "pass".equals(step.path("checkStatus").asText())) continue;
            String target = step.path("definition").path("settings").path("targetStepId").asText();
            for (int i = 0; i < videos.size(); i++)
                if (target.equals(videos.get(i).path("id").asText())) { out.add("重做第 " + (i + 1) + " 段「" + videos.get(i).path("title").asText() + "」"); break; }
            if (!out.isEmpty()) break;
        }
        if (assembled != null) {
            out.add("把这条成片存为模板");
            String ratio = videos.isEmpty() ? null : videos.get(0).path("definition").path("settings").path("aspectRatio").asText(null);
            out.add("16:9".equals(ratio) ? "换成 9:16 竖屏再出一版" : "换成 16:9 横屏再出一版");
        } else if (videos.stream().anyMatch(v -> "done".equals(v.path("status").asText()))) {
            out.add("把做好的片段合成一条成片");
        }
        if (firstUnfinished != null && !IpPlanExecution.DONE.equals(e.getStatus())) out.add("接着做没完成的「" + firstUnfinished + "」");
        if (lastText != null) out.add("把「" + lastText.path("title").asText() + "」再改得精炼一些");
        if (out.size() < 2) out.add(lastText != null || assembled != null || !videos.isEmpty() ? "把这张画布存为模板" : "重新开始这次制作");
        return out.stream().limit(3).toList();
    }
}
