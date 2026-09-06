package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.repository.ClipProjectRepository;
import com.aistareco.aep.clip.service.ClipAvatarService;
import com.aistareco.aep.clip.service.ClipProjectService;
import com.aistareco.aep.clip.service.ClipScriptService;
import com.aistareco.aep.clip.service.shiliu.MockShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * WORKPLAN 2026-09-05 §1.3：{@code scope="all"} 时 {@code text} 是改写/生成指令，
 * 而且只准在模板骨架内写 —— 段数与 role 一个都不能动。
 */
class ClipScriptRewriteTest {
    private ClipProjectService projects;
    private ClipProjectRepository repo;
    private ShiliuService shiliu;
    private ClipScriptService scripts;

    @BeforeEach
    void setUp() {
        projects = mock(ClipProjectService.class);
        repo = mock(ClipProjectRepository.class);
        shiliu = mock(ShiliuService.class);
        ClipAvatarService avatars = mock(ClipAvatarService.class);
        scripts = new ClipScriptService(projects, repo, shiliu, avatars);
        when(shiliu.required()).thenReturn(new MockShiliuGateway());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void theBriefIsUsedAsAnInstructionAndReachesEverySpokenSegment() {
        ClipProject project = project();
        when(projects.required("owner-1", "cp_1")).thenReturn(project);

        Map<String, Object> result = scripts.rewrite("owner-1", "cp_1", "all", null,
                "我在学院路开了十二年修鞋铺，手艺是跟我爸学的，想让街坊知道我们还在");

        List<Map<String, Object>> segments = ClipDtos.mapListValue(result.get("segments"));
        assertEquals(4, segments.size(), "不改段数");
        assertEquals(List.of("avatar", "broll", "avatar", "tail"),
                segments.stream().map(row -> String.valueOf(row.get("role"))).toList(), "不改 role");
        assertTrue(segments.get(0).get("text").toString().contains("学院路"), "brief 必须真的进到文案里");
        assertTrue(segments.stream().limit(3).map(row -> String.valueOf(row.get("text")))
                .noneMatch(text -> text.contains("原始模板句")), "指令模式下不该只是在模板句上加尾巴");
        assertEquals("结尾固定段", segments.get(3).get("text"), "结尾固定段一个字都不碰");
        assertTrue(segments.stream().limit(3).allMatch(row -> ClipDtos.number(row.get("actualDurationSec")) == 0),
                "文案变了，上一版的真实配音时长必须作废");
    }

    @Test
    void differentBriefsProduceDifferentScripts() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project());
        String first = String.valueOf(ClipDtos.mapListValue(
                scripts.rewrite("owner-1", "cp_1", "all", null, "我在学院路开修鞋铺").get("segments")).get(0).get("text"));
        when(projects.required("owner-1", "cp_1")).thenReturn(project());
        String second = String.valueOf(ClipDtos.mapListValue(
                scripts.rewrite("owner-1", "cp_1", "all", null, "我做了二十年家常菜馆").get("segments")).get(0).get("text"));
        assertNotEquals(first, second);
    }

    @Test
    void anEmptyTextKeepsTheOlderPolishBehaviourSoTheExistingButtonStillWorks() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project());
        Map<String, Object> result = scripts.rewrite("owner-1", "cp_1", "all", null, null);
        List<Map<String, Object>> segments = ClipDtos.mapListValue(result.get("segments"));
        assertTrue(String.valueOf(segments.get(0).get("text")).startsWith("原始模板句一"));
        assertEquals("结尾固定段", segments.get(3).get("text"));
    }

    @Test
    void anOverlongInstructionIsRejectedRatherThanTruncatedSilently() {
        when(projects.required("owner-1", "cp_1")).thenReturn(project());
        BusinessException error = assertThrows(BusinessException.class,
                () -> scripts.rewrite("owner-1", "cp_1", "all", null, "字".repeat(501)));
        assertEquals("CLIP_REWRITE_INVALID", error.getCode());
    }

    @Test
    void aProductionGatewayStillRefusesInsteadOfPretendingToGenerate() {
        com.aistareco.aep.clip.service.shiliu.ShiliuGateway real =
                mock(com.aistareco.aep.clip.service.shiliu.ShiliuGateway.class);
        when(real.mock()).thenReturn(false);
        when(shiliu.required()).thenReturn(real);
        BusinessException error = assertThrows(BusinessException.class,
                () -> scripts.rewrite("owner-1", "cp_1", "all", null, "一句话"));
        assertEquals("CLIP_SCRIPT_ENGINE_NOT_CONFIGURED", error.getCode());
    }

    private static ClipProject project() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", new ArrayList<>(List.of(
                new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", "原始模板句一。", "hint", "一句话说清你是谁", "actualDurationSec", 6)),
                new LinkedHashMap<>(Map.of("no", 2, "role", "broll", "text", "原始模板句二。", "assetId", "ca_1", "actualDurationSec", 5)),
                new LinkedHashMap<>(Map.of("no", 3, "role", "avatar", "text", "原始模板句三。", "actualDurationSec", 4)),
                new LinkedHashMap<>(Map.of("no", 4, "role", "tail", "text", "结尾固定段", "durationSec", 3)))));
        return ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1").templateName("模板")
                .title("作品").payloadJson(payload).createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
}
