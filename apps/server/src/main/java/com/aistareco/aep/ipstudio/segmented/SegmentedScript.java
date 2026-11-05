package com.aistareco.aep.ipstudio.segmented;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 分段脚本的结构：校验模型输出、归一时长、查硬问题、写成人能读的正文。
 *
 * <p>镜头字段和导演台的片段一样（durationSec / size / camera / still / action / dialogue[speakerId,text]），
 * 分镜图和视频提示词直接用 {@code DirectorPrompts} 编。结构不对判失败、全额退回；
 * 能修的（秒数对不上就按比例摊、镜头比上限多就并进最后一镜）在这里修，不让它卡住后面的付费步骤。
 */
public final class SegmentedScript {
    private SegmentedScript() {}

    public static final String NARRATOR = "旁白";
    private static final Set<String> KINDS = Set.of("character", "scene", "prop");
    /** 每秒能说几个字（同 stage-director-storyboard 的台词量规则）。 */
    private static final int CHARS_PER_SECOND = 4;

    public static ObjectNode normalize(ObjectMapper om, JsonNode raw, List<SegmentedPlan.Segment> plan, int refCount) {
        if (raw == null || !raw.isObject() || !raw.path("segments").isArray()) throw bad("结构不对");
        JsonNode segments = raw.path("segments");
        if (segments.size() != plan.size()) throw bad("段数不对：要 " + plan.size() + " 段，写了 " + segments.size() + " 段");
        ObjectNode out = om.createObjectNode();
        out.put("title", text(raw.path("title"), 60, "未命名"));
        out.put("summary", text(raw.path("summary"), 400, ""));
        out.put("style", text(raw.path("style"), 40, "真人写实"));
        ArrayNode assets = out.putArray("assets");
        for (JsonNode a : raw.path("assets")) {
            String name = text(a.path("name"), 40, "");
            if (name.isEmpty() || assets.size() >= 12) continue;
            ObjectNode item = assets.addObject().put("name", name)
                    .put("kind", KINDS.contains(a.path("kind").asText()) ? a.path("kind").asText() : "character")
                    .put("description", text(a.path("description"), 400, ""))
                    .put("voice", text(a.path("voice"), 120, ""));
            String ref = a.path("ref").asText("").strip();
            if (ref.matches("图[1-9][0-9]?") && Integer.parseInt(ref.substring(1)) <= refCount) item.put("ref", ref);
        }
        ArrayNode outSegments = out.putArray("segments");
        for (int i = 0; i < plan.size(); i++) outSegments.add(segment(om, segments.get(i), plan.get(i)));
        ArrayNode changes = out.putArray("changes");
        for (JsonNode c : raw.path("changes")) {
            String line = text(c, 200, "");
            if (!line.isEmpty() && changes.size() < 8) changes.add(line);
        }
        return out;
    }

    private static ObjectNode segment(ObjectMapper om, JsonNode raw, SegmentedPlan.Segment spec) {
        JsonNode shots = raw.path("shots");
        if (!shots.isArray() || shots.isEmpty()) throw bad("第 " + spec.no() + " 段没有镜头");
        List<ObjectNode> list = new ArrayList<>();
        for (JsonNode s : shots) {
            ObjectNode shot = om.createObjectNode();
            double seconds = s.path("durationSec").asDouble();
            shot.put("durationSec", seconds > 0 && Double.isFinite(seconds) ? seconds : 3);
            shot.put("size", text(s.path("size"), 20, "中景"));
            shot.put("camera", text(s.path("camera"), 80, "固定机位"));
            String still = text(s.path("still"), 240, ""), action = text(s.path("action"), 400, "");
            if (still.isEmpty() && action.isEmpty()) throw bad("第 " + spec.no() + " 段有镜头没写画面");
            shot.put("still", still.isEmpty() ? action : still);
            shot.put("action", action);
            ArrayNode lines = shot.putArray("dialogue");
            for (JsonNode line : s.path("dialogue")) {
                String words = text(line.path("text"), 300, "");
                if (words.isEmpty()) continue;
                ObjectNode item = lines.addObject();
                String who = text(line.path("speaker"), 40, text(line.path("speakerId"), 40, ""));
                if (!who.isEmpty() && !NARRATOR.equals(who)) item.put("speakerId", who);
                item.put("text", words);
            }
            list.add(shot);
        }
        while (list.size() > spec.shotsHi()) merge(list);
        fitDuration(list, spec.seconds());
        ObjectNode out = om.createObjectNode().put("no", spec.no()).put("title", text(raw.path("title"), 60, "第 " + spec.no() + " 段"))
                .put("summary", text(raw.path("summary"), 200, "")).put("durationSec", spec.seconds());
        ArrayNode outShots = out.putArray("shots");
        list.forEach(outShots::add);
        return out;
    }

    /** 比上限多的镜头并进前一镜（分镜图放不下、视频也拍不完）：画面和台词都留着，不丢内容。 */
    private static void merge(List<ObjectNode> shots) {
        ObjectNode last = shots.remove(shots.size() - 1), keep = shots.get(shots.size() - 1);
        keep.put("durationSec", keep.path("durationSec").asDouble() + last.path("durationSec").asDouble());
        keep.put("action", (keep.path("action").asText() + " " + last.path("still").asText() + " " + last.path("action").asText()).strip());
        last.path("dialogue").forEach(((ArrayNode) keep.path("dialogue"))::add);
    }

    /** 镜头秒数加起来对不上这一段：按比例摊，保留一位小数，尾差放最后一镜。 */
    private static void fitDuration(List<ObjectNode> shots, int seconds) {
        double total = shots.stream().mapToDouble(s -> s.path("durationSec").asDouble()).sum();
        if (Math.abs(total - seconds) < 0.05) return;
        double used = 0;
        for (int i = 0; i < shots.size(); i++) {
            ObjectNode shot = shots.get(i);
            double value = i == shots.size() - 1 ? seconds - used : round(shot.path("durationSec").asDouble() * seconds / total);
            shot.put("durationSec", round(value));
            used += shot.path("durationSec").asDouble();
        }
    }

    private static double round(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    /** 程序查得出的硬问题，交给审稿那一轮改掉。 */
    public static List<String> issues(JsonNode script, List<SegmentedPlan.Segment> plan) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < plan.size(); i++) {
            var spec = plan.get(i);
            JsonNode shots = script.path("segments").path(i).path("shots");
            if (shots.size() < spec.shotsLo()) out.add("第 " + spec.no() + " 段只有 " + shots.size() + " 个镜头，这段 " + spec.seconds() + " 秒要 " + spec.shotsLo() + "–" + spec.shotsHi() + " 个");
            for (int s = 0; s < shots.size(); s++) {
                JsonNode shot = shots.get(s);
                int chars = 0;
                java.util.Set<String> speakers = new java.util.HashSet<>();
                for (JsonNode line : shot.path("dialogue")) {
                    chars += line.path("text").asText().length();
                    speakers.add(line.path("speakerId").asText(NARRATOR));
                }
                double seconds = shot.path("durationSec").asDouble();
                if (chars > seconds * CHARS_PER_SECOND + 1) out.add("第 " + spec.no() + " 段第 " + (s + 1) + " 镜 " + fmt(seconds) + " 秒有 " + chars + " 个字，念不完");
                if (speakers.size() > 1) out.add("第 " + spec.no() + " 段第 " + (s + 1) + " 镜有 " + speakers.size() + " 个人说话，拆成两镜");
            }
        }
        return out;
    }

    /** 这一段第几张分镜图放哪几镜：前四镜一张，后面的一张；用不上第二张返回空。 */
    public static List<JsonNode> boardShots(JsonNode segment, int part) {
        List<JsonNode> out = new ArrayList<>();
        JsonNode shots = segment.path("shots");
        int from = part * SegmentedPlan.SHOTS_PER_BOARD;
        for (int i = from; i < shots.size() && i < from + SegmentedPlan.SHOTS_PER_BOARD; i++) out.add(shots.get(i));
        return out;
    }

    /** 给人看的正文（画布上的文字节点、资产库里的脚本）。 */
    public static String render(JsonNode script, List<SegmentedPlan.Segment> plan) {
        StringBuilder b = new StringBuilder();
        b.append(script.path("title").asText()).append('\n');
        if (!script.path("summary").asText().isBlank()) b.append(script.path("summary").asText()).append('\n');
        if (script.path("changes").size() > 0) {
            b.append("\n审核改动\n");
            script.path("changes").forEach(c -> b.append("· ").append(c.asText()).append('\n'));
        }
        if (script.path("assets").size() > 0) {
            b.append("\n人物与物件\n");
            for (JsonNode a : script.path("assets")) {
                b.append("· ").append(a.path("name").asText());
                if (a.hasNonNull("ref")) b.append("（").append(a.path("ref").asText()).append("）");
                if (!a.path("description").asText().isBlank()) b.append("：").append(a.path("description").asText());
                if (!a.path("voice").asText().isBlank()) b.append(" 声音：").append(a.path("voice").asText());
                b.append('\n');
            }
        }
        for (int i = 0; i < plan.size(); i++) {
            var spec = plan.get(i);
            JsonNode segment = script.path("segments").path(i);
            b.append("\n第").append(spec.no()).append("段（").append(spec.startSec()).append("–").append(spec.startSec() + spec.seconds()).append(" 秒）");
            if (!segment.path("title").asText().isBlank()) b.append(" ").append(segment.path("title").asText());
            b.append('\n');
            double at = 0;
            int no = 0;
            for (JsonNode shot : segment.path("shots")) {
                double end = at + shot.path("durationSec").asDouble();
                b.append("第").append(++no).append("镜（").append(fmt(at)).append("–").append(fmt(end)).append(" 秒）")
                        .append(shot.path("size").asText()).append("，").append(shot.path("camera").asText()).append("：")
                        .append(shot.path("still").asText());
                if (!shot.path("action").asText().isBlank()) b.append(" ").append(shot.path("action").asText());
                for (JsonNode line : shot.path("dialogue"))
                    b.append(" ").append(line.path("speakerId").asText(NARRATOR)).append("说：「").append(line.path("text").asText()).append("」");
                b.append('\n');
                at = end;
            }
        }
        return b.toString().strip();
    }

    private static String fmt(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(round(v));
    }

    private static String text(JsonNode node, int max, String fallback) {
        String value = node != null && node.isTextual() ? node.asText().strip() : "";
        if (value.isEmpty()) return fallback;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static BusinessException bad(String detail) {
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "模型写的分镜脚本格式不对，本次未扣积分", "Segmented script: " + detail);
    }
}
