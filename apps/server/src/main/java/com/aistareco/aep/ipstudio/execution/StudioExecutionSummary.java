package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

/**
 * The closing message of an execution (D07, plan §时间线中的审批追问与收尾): one sentence with how it ended and what it
 * really cost (the refreshed spent of every stage, dialogue included, never quotes), the steps it did not finish, the
 * checks that did not pass or could not judge (with the check's own reason), and two or three follow-ups derived from
 * what was actually produced. What was finished is not listed again: the step list in the timeline already shows it,
 * each with 「在画布上看」 (docs/ip-studio-new-canvas-and-threads.md §4). Follow-ups are prompts the user can send;
 * anything paid they lead to still goes through a card.
 */
final class StudioExecutionSummary {
    private StudioExecutionSummary() {}

    record Summary(String text, List<String> suggestions) {}

    /** Native run projection by id (null when not visible). */
    interface Runs { IpRunDto run(String runId); }

    static Summary build(IpPlanExecution e, ObjectNode state, ObjectNode budget, Runs runs) {
        List<String> lines = new ArrayList<>();
        lines.add(headline(e, budget));

        Map<String, String> titles = new HashMap<>();
        for (JsonNode step : state.path("steps")) titles.put(step.path("id").asText(), step.path("title").asText());
        List<String> unfinished = new ArrayList<>(), checks = new ArrayList<>();
        for (JsonNode step : state.path("steps")) {
            String status = step.path("status").asText();
            if (!"done".equals(status) && (!"skipped".equals(status) || !IpPlanExecution.DONE.equals(e.getStatus())))
                unfinished.add("「" + step.path("title").asText() + "」");
            if ("check".equals(step.path("operation").asText()) && "done".equals(status)) {
                String verdict = step.path("checkStatus").asText("unknown");
                if ("pass".equals(verdict)) continue;
                // Name what was checked (the clip), not the check step: 「片段 1」检查没通过，not 「检查片段 1」检查没通过.
                String target = titles.get(step.path("definition").path("settings").path("targetStepId").asText());
                String subject = "「" + (target == null || target.isBlank() ? step.path("title").asText() : target) + "」";
                checks.add(subject + ("fail".equals(verdict) ? "检查没通过" : "没法判断") + reason(step, runs));
            }
        }
        if (!unfinished.isEmpty()) lines.add("没做完：" + String.join("", unfinished) + "。");
        lines.addAll(checks);
        return new Summary(String.join("\n", lines), suggestions(e, state));
    }

    /** 「做好了，花了 41 积分。」: how it ended and the total really spent (every stage, dialogue included). */
    private static String headline(IpPlanExecution e, JsonNode budget) {
        long spent = 0, settling = 0;
        for (String stage : List.of("analysis", "production")) {
            JsonNode b = budget.path(stage);
            if (!b.isObject()) continue;
            spent += b.path("spent").asLong();
            settling += b.path("inFlight").asLong(0);
        }
        String cost = "花了 " + spent + " 积分。";
        String head = switch (e.getStatus()) {
            case IpPlanExecution.DONE -> "做好了，" + cost;
            case IpPlanExecution.PARTIAL -> "做了 90 分钟还没做完，先停在这里，" + cost;
            case IpPlanExecution.FAILED -> "没有做完，" + cost;
            default -> "已停止，" + cost;
        };
        return settling > 0 ? head + "还有部分积分在结算。" : head;
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
            if (!why.isEmpty()) return "：" + (why.length() > 80 ? why.substring(0, 80) + "…" : why) + "。";
        }
        return "。";
    }

    /** Two or three follow-ups from the real outputs, only for actions that exist. */
    static List<String> suggestions(IpPlanExecution e, ObjectNode state) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        List<JsonNode> videos = new ArrayList<>();
        JsonNode assembled = null, lastText = null;
        String firstUnfinished = null;
        int images = 0;
        boolean produced = false;
        for (JsonNode step : state.path("steps")) {
            String op = step.path("operation").asText(), status = step.path("status").asText();
            if ("production".equals(step.path("stage").asText()) && "video".equals(op)) videos.add(step);
            if ("assemble".equals(op) && "done".equals(status)) assembled = step;
            if ("text".equals(op) && "done".equals(status)) lastText = step;
            if ("image".equals(op) && "done".equals(status)) images++;
            if ("done".equals(status) && !"check".equals(op)) produced = true;
            if (firstUnfinished == null && !"done".equals(status) && !"skipped".equals(status)) firstUnfinished = step.path("title").asText();
        }
        boolean videoDone = assembled != null || videos.stream().anyMatch(v -> "done".equals(v.path("status").asText()));
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
        } else if (videoDone) {
            out.add("把做好的片段合成一条成片");
        }
        // Pictures came out: turn them into a clip (unless this run already made one), or try another look.
        if (images > 0) {
            if (!videoDone) out.add(images == 1 ? "用这张图做一段视频" : "用这些图做一段视频");
            out.add(images == 1 ? "换个风格再出一张" : "换个风格再出一组");
        }
        if (firstUnfinished != null && !IpPlanExecution.DONE.equals(e.getStatus())) out.add("接着做没完成的「" + firstUnfinished + "」");
        if (lastText != null) out.add("把「" + lastText.path("title").asText() + "」再改得精炼一些");
        if (out.size() < 2) out.add(produced ? "把这张画布存为模板" : "再试一次");
        return out.stream().limit(3).toList();
    }
}
