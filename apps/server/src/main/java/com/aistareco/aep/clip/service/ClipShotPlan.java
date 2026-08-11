package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.common.BusinessException;

import java.util.*;

/**
 * 文案句子与视觉镜头之间的唯一投影层。句子负责改稿，shot 负责一段连续句子共用哪个画面；
 * worker、报价、预检和总装只能消费 materialize 后的生成段，禁止再直接逐句切片。
 */
public final class ClipShotPlan {
    private static final Set<String> ROLES = Set.of("avatar", "broll", "tail");
    private ClipShotPlan() {}

    public static List<Map<String, Object>> shots(Map<String, Object> payload) {
        List<Map<String, Object>> segments = ClipDtos.mapListValue(payload == null ? null : payload.get("segments"));
        List<Map<String, Object>> explicit = ClipDtos.mapListValue(payload == null ? null : payload.get("shots"));
        if (explicit.isEmpty()) return defaultShots(segments);
        validate(explicit, segments);
        return explicit.stream().map(LinkedHashMap::new).map(row -> (Map<String,Object>) row).toList();
    }

    public static List<Map<String, Object>> defaultShots(List<Map<String, Object>> segments) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int index = 0; index < segments.size();) {
            Map<String, Object> first = segments.get(index);
            String role = text(first.get("role"));
            int endIndex = index;
            if ("broll".equals(role)) {
                while (endIndex + 1 < segments.size()
                        && "broll".equals(text(segments.get(endIndex + 1).get("role")))
                        && text(segments.get(endIndex + 1).get("assetId")).equals(text(first.get("assetId")))
                        && endIndex - index + 1 < 3) endIndex++;
            }
            Map<String, Object> last = segments.get(endIndex);
            int startNo = number(first.get("no"));
            int endNo = number(last.get("no"));
            Map<String, Object> shot = new LinkedHashMap<>();
            shot.put("id", id(startNo, endNo)); shot.put("startNo", startNo); shot.put("endNo", endNo); shot.put("role", role);
            copy(first, shot, "assetId", "assetLabel", "brollSource", "hint");
            result.add(shot); index = endIndex + 1;
        }
        return result;
    }

    public static List<Map<String, Object>> materialize(Map<String, Object> payload) {
        List<Map<String, Object>> source = ClipDtos.mapListValue(payload == null ? null : payload.get("segments"));
        List<Map<String, Object>> shots = shots(payload);
        List<Map<String, Object>> result = new ArrayList<>();
        for (int index = 0; index < shots.size(); index++) {
            Map<String, Object> shot = shots.get(index);
            int start = number(shot.get("startNo")); int end = number(shot.get("endNo"));
            List<Map<String, Object>> members = source.stream()
                    .filter(row -> number(row.get("no")) >= start && number(row.get("no")) <= end).toList();
            Map<String, Object> row = new LinkedHashMap<>(shot);
            row.put("no", index + 1);
            row.put("sourceNos", members.stream().map(item -> number(item.get("no"))).toList());
            row.put("text", members.stream().map(item -> text(item.get("text"))).reduce("", String::concat));
            row.put("captions", members.stream().map(item -> {
                Map<String, Object> cue = new LinkedHashMap<>();
                cue.put("sourceNo", number(item.get("no")));
                cue.put("text", text(item.get("text")));
                double actual = decimal(item.get("actualDurationSec"));
                cue.put("durationSec", actual > 0 ? actual : ClipProjectService.seconds(item));
                return cue;
            }).toList());
            row.put("durationSec", members.stream().mapToInt(ClipProjectService::seconds).sum());
            boolean allActual = !members.isEmpty() && members.stream().allMatch(item -> decimal(item.get("actualDurationSec")) > 0);
            row.put("actualDurationSec", allActual ? members.stream().mapToDouble(item -> decimal(item.get("actualDurationSec"))).sum() : 0);
            if (text(row.get("hint")).isBlank()) row.put("hint", members.stream().map(item -> text(item.get("hint"))).filter(v -> !v.isBlank()).reduce((a,b) -> a + " · " + b).orElse(""));
            result.add(row);
        }
        return result;
    }

    public static void validate(List<Map<String, Object>> shots, List<Map<String, Object>> segments) {
        if (shots.isEmpty() || shots.size() > 200) invalid();
        Set<Integer> sourceNos = new LinkedHashSet<>();
        for (Map<String, Object> segment : segments) sourceNos.add(number(segment.get("no")));
        Set<Integer> covered = new LinkedHashSet<>();
        int previousEnd = 0;
        for (Map<String, Object> shot : shots) {
            int start = number(shot.get("startNo")); int end = number(shot.get("endNo"));
            String role = text(shot.get("role"));
            if (text(shot.get("id")).isBlank() || start < 1 || end < start || start <= previousEnd || !ROLES.contains(role)) invalid();
            for (int no = start; no <= end; no++) if (!sourceNos.contains(no) || !covered.add(no)) invalid();
            previousEnd = end;
        }
        if (!covered.equals(sourceNos)) invalid();
    }

    private static void copy(Map<String,Object> from, Map<String,Object> to, String... keys) {
        for (String key : keys) if (from.containsKey(key)) to.put(key, from.get(key));
    }
    private static String id(int start, int end) { return "shot_" + start + "_" + end; }
    private static int number(Object value) { return value instanceof Number n ? n.intValue() : -1; }
    private static double decimal(Object value) { return value instanceof Number n ? n.doubleValue() : 0; }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static void invalid() { throw BusinessException.badRequest("CLIP_PROJECT_INVALID", "镜头范围结构不合法"); }
}
