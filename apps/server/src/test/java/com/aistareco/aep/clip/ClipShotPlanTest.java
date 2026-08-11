package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipShotPlan;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ClipShotPlanTest {
    @Test
    void groupsThreeAdjacentBrollSentencesWithoutMergingScriptText() {
        List<Map<String,Object>> segments = List.of(
                segment(1, "avatar", "开场"), segment(2, "broll", "门头。"),
                segment(3, "broll", "手艺。"), segment(4, "broll", "顾客。"),
                segment(5, "broll", "收束。"), segment(6, "tail", "结尾")
        );
        Map<String,Object> payload = new LinkedHashMap<>(Map.of("segments", segments));

        List<Map<String,Object>> shots = ClipShotPlan.shots(payload);
        assertEquals(List.of(List.of(1,1), List.of(2,4), List.of(5,5), List.of(6,6)),
                shots.stream().map(row -> List.of(row.get("startNo"), row.get("endNo"))).toList());
        List<Map<String,Object>> rendered = ClipShotPlan.materialize(payload);
        assertEquals("门头。手艺。顾客。", rendered.get(1).get("text"));
        List<Map<String,Object>> captions = castRows(rendered.get(1).get("captions"));
        assertEquals(List.of("门头。", "手艺。", "顾客。"), captions.stream().map(row -> row.get("text")).toList());
        assertEquals(List.of(2, 3, 4), captions.stream().map(row -> row.get("sourceNo")).toList());
        assertEquals(6, segments.size(), "文案句子不能因镜头分组被破坏");
    }

    @Test
    void explicitRangeBecomesOneRenderSegmentWithOneAsset() {
        List<Map<String,Object>> segments = List.of(
                segment(1, "broll", "第一句。"), segment(2, "broll", "第二句。"), segment(3, "tail", "结尾")
        );
        List<Map<String,Object>> shots = List.of(
                new LinkedHashMap<>(Map.of("id", "shot_1_2", "startNo", 1, "endNo", 2, "role", "broll", "assetId", "ca_1")),
                new LinkedHashMap<>(Map.of("id", "shot_3_3", "startNo", 3, "endNo", 3, "role", "tail"))
        );
        List<Map<String,Object>> rendered = ClipShotPlan.materialize(new LinkedHashMap<>(Map.of("segments", segments, "shots", shots)));
        assertEquals(2, rendered.size());
        assertEquals(List.of(1,2), rendered.get(0).get("sourceNos"));
        assertEquals("ca_1", rendered.get(0).get("assetId"));
    }

    @Test
    void rejectsGapsAndOverlapsInsteadOfSilentlyDroppingCopy() {
        List<Map<String,Object>> segments = List.of(segment(1, "broll", "一"), segment(2, "broll", "二"), segment(3, "tail", "三"));
        List<Map<String,Object>> shots = List.of(
                new LinkedHashMap<>(Map.of("id", "a", "startNo", 1, "endNo", 1, "role", "broll")),
                new LinkedHashMap<>(Map.of("id", "b", "startNo", 3, "endNo", 3, "role", "tail"))
        );
        BusinessException error = assertThrows(BusinessException.class, () -> ClipShotPlan.validate(shots, segments));
        assertEquals("CLIP_PROJECT_INVALID", error.getCode());
    }

    private static Map<String,Object> segment(int no, String role, String text) {
        return new LinkedHashMap<>(Map.of("no", no, "role", role, "text", text));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> castRows(Object value) {
        return (List<Map<String,Object>>) value;
    }
}
