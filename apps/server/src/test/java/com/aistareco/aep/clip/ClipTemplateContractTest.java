package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.ClipTemplate;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClipTemplateContractTest {
    @Test
    void configuredTailVideoUpdatesTemplateSkeletonPreviewAndDurationTogether() {
        ClipTemplate template = ClipTemplate.builder()
                .id("ct_demo").name("门店故事").industry("本地生活").themeKey("daily").description("demo")
                .status("published").ownerScope("official").ratio("9:16")
                .scriptSkeletonJson(Map.of("segments", List.of(
                        Map.of("no", 1, "role", "avatar", "text", "大家好"),
                        Map.of("no", 2, "role", "tail", "text", "旧收尾", "durationSec", 20)
                )))
                .build();
        List<Map<String, Object>> clips = List.of(Map.of(
                "assetId", "ca_tail", "label", "门店信息卡", "durationSec", 6,
                "previewUrl", "https://cdn.example/tail.jpg", "contentUrl", "https://cdn.example/tail.mp4"
        ));

        var dto = ClipDtos.TemplateDto.from(template, null, null, clips, 7);
        var tail = ClipDtos.mapListValue(dto.scriptSkeleton().get("segments")).get(1);

        assertEquals(7, dto.estDurationSec());
        assertEquals("门店信息卡", dto.tailLabel());
        assertEquals(6, dto.tailDurationSec());
        assertEquals("ca_tail", dto.tailAssetId());
        assertEquals("https://cdn.example/tail.jpg", dto.tailPreviewUrl());
        assertEquals("https://cdn.example/tail.mp4", dto.tailVideoUrl());
        assertEquals(6L, tail.get("durationSec"));
        assertEquals("ca_tail", tail.get("assetId"));
    }
}
