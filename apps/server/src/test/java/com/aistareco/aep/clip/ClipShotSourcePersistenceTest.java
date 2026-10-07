package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.ProjectDto;
import com.aistareco.aep.clip.dto.ClipRequests.SaveProject;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.clip.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * {@code shots[].source} 必须活着穿过保存 → 读取这条路。存不住，用户换台手机就丢掉一段花过钱的产物。
 */
class ClipShotSourcePersistenceTest {
    private ClipProjectRepository repo;
    private ClipProjectService service;
    private ClipProject project;

    private static List<Map<String, Object>> segments() {
        return new ArrayList<>(List.of(
                new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", "第一句话")),
                new LinkedHashMap<>(Map.of("no", 2, "role", "tail", "text", "结尾", "durationSec", 3))));
    }

    private static Map<String, Object> sourceWithArtifact() {
        return new LinkedHashMap<>(Map.of("model", "avatar", "prompt", "正面出镜",
                "artifact", new LinkedHashMap<>(Map.of("cdnKey", "clip/segments/a.mp4", "fingerprint", "fp-1", "durationSec", 3.0))));
    }

    @BeforeEach
    void setUp() {
        repo = mock(ClipProjectRepository.class);
        service = new ClipProjectService(repo, mock(ClipTemplateService.class), mock(ClipRenderJobRepository.class),
                mock(ClipShotJobRepository.class), mock(ClipTtsPreviewRepository.class), mock(FileStorageService.class));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", segments());
        payload.put("shots", new ArrayList<>(ClipShotPlan.defaultShots(segments())));
        project = ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1").templateName("模板")
                .title("项目").status("draft").payloadJson(payload).step(2).creditsHeld(12)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(repo.findByIdAndExternalOwnerIdAndDeletedAtIsNull("cp_1", "owner-1")).thenReturn(Optional.of(project));
        // save / recordShotArtifact 走加写锁的 forUpdate finder（防 payloadJson 读改写丢更新），mock 需一并 stub。
        when(repo.findByIdAndExternalOwnerIdAndDeletedAtIsNullForUpdate("cp_1", "owner-1")).thenReturn(Optional.of(project));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static List<Map<String, Object>> shotsWithSource() {
        List<Map<String, Object>> shots = ClipShotPlan.defaultShots(segments());
        shots.get(0).put("source", sourceWithArtifact());
        return shots;
    }

    @Test
    void savingShotsKeepsSourceAndReadingItBackReturnsTheArtifact() {
        ProjectDto saved = service.save("owner-1", "cp_1",
                new SaveProject(null, segments(), shotsWithSource(), null, null, null, null, null, null, null, null));
        Map<String, Object> artifact = ClipShotPlan.artifact(saved.shots().get(0));
        assertEquals("clip/segments/a.mp4", artifact.get("cdnKey"));
        assertEquals("fp-1", artifact.get("fingerprint"));
        // 再读一次（模拟换台手机拉项目）：产物还在
        assertEquals("fp-1", ClipShotPlan.artifact(ProjectDto.from(project).shots().get(0)).get("fingerprint"));
    }

    @Test
    void rangeValidationStaysStrictWhileLettingSourceThrough() {
        assertDoesNotThrow(() -> ClipShotPlan.validate(shotsWithSource(), segments()));
        List<Map<String, Object>> broken = shotsWithSource();
        broken.get(0).put("endNo", 9);
        assertThrows(com.aistareco.common.BusinessException.class, () -> ClipShotPlan.validate(broken, segments()),
                "放行 source 不等于放松范围校验");
    }

    @Test
    void aPartialSaveThatOmitsSourceDoesNotSilentlyBurnThePaidArtifact() {
        service.save("owner-1", "cp_1", new SaveProject(null, segments(), shotsWithSource(), null, null, null, null, null, null, null, null));
        // 端上只想改个标题，回存的 shots 没带 source —— 不能因此把产物抹掉
        ProjectDto after = service.save("owner-1", "cp_1",
                new SaveProject(null, null, ClipShotPlan.defaultShots(segments()), null, null, null, null, null, null, null, "新标题"));
        assertEquals("clip/segments/a.mp4", ClipShotPlan.artifact(after.shots().get(0)).get("cdnKey"));
    }

    @Test
    void recordingAnArtifactServerSideLandsInThePayloadNotJustTheJobRow() {
        service.recordShotArtifact("owner-1", "cp_1", 1,
                new LinkedHashMap<>(Map.of("cdnKey", "clip/segments/b.mp4", "fingerprint", "fp-2", "durationSec", 4.0)), "avatar", "正面出镜");
        Map<String, Object> shot = ClipShotPlan.shots(project.getPayloadJson()).get(0);
        assertEquals("clip/segments/b.mp4", ClipShotPlan.artifact(shot).get("cdnKey"));
        assertEquals("avatar", ClipDtos.safeMapValue(shot.get("source")).get("model"));
    }

    @Test
    void aDuplicateStartsCleanInsteadOfInheritingSomebodyElsesPaidArtifact() {
        service.save("owner-1", "cp_1", new SaveProject(null, segments(), shotsWithSource(), null, null, null, null, null, null, null, null));
        org.mockito.ArgumentCaptor<ClipProject> saved = org.mockito.ArgumentCaptor.forClass(ClipProject.class);
        ProjectDto copy = service.duplicate("owner-1", "cp_1");
        verify(repo, atLeastOnce()).save(saved.capture());
        assertEquals(0, saved.getValue().getCreditsHeld(), "那笔钱冻在原项目的那一单上，跟副本无关");
        assertNotEquals("cp_1", copy.id());
        assertEquals("draft", copy.status());
        assertTrue(copy.title().endsWith("（副本）"));
        assertTrue(ClipShotPlan.artifact(copy.shots().get(0)).isEmpty(), "复制出来的稿子不该白继承已经花过钱的产物");
        // 创作意图（哪个 model、什么 prompt）保留，否则「复制一版再改改」就退化成重新建项目
        assertEquals("avatar", ClipDtos.safeMapValue(copy.shots().get(0).get("source")).get("model"));
    }
}
