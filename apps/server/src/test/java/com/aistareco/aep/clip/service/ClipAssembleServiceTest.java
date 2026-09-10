package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.AssembleResult;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 总装单独下单：只接不生成。缺产物必须在提交之前点名挡住，
 * 别让用户为一条注定拼不出来的片子先付一次总装费。
 */
class ClipAssembleServiceTest {
    private ClipRenderJobRepository jobs;
    private ClipShotJobRepository shotJobs;
    private ClipProjectRepository projectRepo;
    private ClipTtsPreviewRepository ttsPreviews;
    private ClipTtsPreviewService ttsPreviewService;
    private ClipAssembleService service;
    private ClipProject project;

    private static List<Map<String, Object>> segments() {
        return new ArrayList<>(List.of(
                new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", "第一句出镜话")),
                new LinkedHashMap<>(Map.of("no", 2, "role", "broll", "text", "第二句配画面", "assetId", "ca_1")),
                new LinkedHashMap<>(Map.of("no", 3, "role", "tail", "text", "结尾", "durationSec", 3))));
    }

    @BeforeEach
    void setUp() {
        jobs = mock(ClipRenderJobRepository.class);
        shotJobs = mock(ClipShotJobRepository.class);
        projectRepo = mock(ClipProjectRepository.class);
        ttsPreviews = mock(ClipTtsPreviewRepository.class);
        ttsPreviewService = mock(ClipTtsPreviewService.class);
        ClipProjectService projects = mock(ClipProjectService.class);
        ClipProperties props = new ClipProperties();
        props.setPricingAvatarSecond("1"); props.setPricingTtsPerKchar("5"); props.setPricingAssemble("3");
        props.setPricingT2iPerImage("2"); props.setPricingT2vSecond("1"); props.setPricingI2vSecond("1");
        ClipEstimateService estimates = new ClipEstimateService(props, projects, mock(ClipAvatarService.class), mock(ClipAssetService.class));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", segments());
        payload.put("shots", new ArrayList<>(ClipShotPlan.defaultShots(segments())));
        project = ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1").templateName("模板")
                .title("项目").status("draft").payloadJson(payload).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(projects.required("owner-1", "cp_1")).thenReturn(project);
        when(jobs.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(shotJobs.findByProjectId("cp_1")).thenReturn(List.of());
        service = new ClipAssembleService(jobs, shotJobs, projectRepo, projects, estimates, ttsPreviews,
                ttsPreviewService, mock(ClipAssetService.class));
    }

    /** 给 avatar 镜挂上产物、给 broll 镜挂上当前这版文案的配音。 */
    private void everythingReady() {
        List<Map<String, Object>> shots = ClipDtos.mapListValue(project.getPayloadJson().get("shots"));
        shots.get(0).put("source", Map.of("artifact", Map.of("cdnKey", "clip/segments/a.mp4", "fingerprint", "fp-1")));
        project.getPayloadJson().put("shots", shots);
        ClipTtsPreview preview = ClipTtsPreview.builder().id("ctp_1").externalOwnerId("owner-1").projectId("cp_1")
                .timelineHash("hash-1").status("ready")
                .segmentsJson(Map.of("items", List.of(Map.of("no", 2, "role", "broll", "audioCdnKey", "clip/segment-audio/b.mp3")))).build();
        when(ttsPreviews.findByExternalOwnerIdAndProjectId("owner-1", "cp_1")).thenReturn(Optional.of(preview));
        when(ttsPreviewService.timeline(project)).thenReturn(new ClipTtsPreviewService.Timeline("hash-1", "v1", List.of(), List.of()));
    }

    @Test
    void submitsOneAssembleOnlyJobThatCarriesTheAlreadyPaidArtifacts() {
        everythingReady();
        AssembleResult result = service.assemble("owner-1", "cp_1", "req-assemble-1", 3);
        assertEquals("assembling", result.status());
        assertEquals("cp_1", result.projectId());
        verify(jobs).save(org.mockito.ArgumentMatchers.argThat(j -> {
            List<Map<String, Object>> rows = ClipDtos.mapListValue(ClipDtos.safeMap(j.getSegmentJobsJson()).get("segments"));
            return "assemble".equals(j.getStage()) && !j.isMock() && j.getCreditsHeld() == 3
                    && "clip/segments/a.mp4".equals(rows.get(0).get("videoCdnKey"))
                    && "clip/segment-audio/b.mp3".equals(rows.get(1).get("audioCdnKey"));
        }));
    }

    @Test
    void everyShotWithoutAnArtifactIsNamedInOneGoInsteadOfOneRoundTripEach() {
        BusinessException error = assertThrows(BusinessException.class, () -> service.assemble("owner-1", "cp_1", "req-assemble-1", 3));
        assertEquals("CLIP_SHOT_ARTIFACT_MISSING", error.getCode());
        assertTrue(error.getMessage().contains("第 1、2 镜"), "要一次点清是哪几镜：" + error.getMessage());
        verify(jobs, never()).save(any());
    }

    @Test
    void staleVoiceoverCountsAsMissingRatherThanBeingGluedOntoNewScript() {
        List<Map<String, Object>> shots = ClipDtos.mapListValue(project.getPayloadJson().get("shots"));
        shots.get(0).put("source", Map.of("artifact", Map.of("cdnKey", "clip/segments/a.mp4")));
        project.getPayloadJson().put("shots", shots);
        ClipTtsPreview preview = ClipTtsPreview.builder().id("ctp_1").externalOwnerId("owner-1").projectId("cp_1")
                .timelineHash("hash-old")
                .segmentsJson(Map.of("items", List.of(Map.of("no", 2, "audioCdnKey", "clip/segment-audio/old.mp3")))).build();
        when(ttsPreviews.findByExternalOwnerIdAndProjectId("owner-1", "cp_1")).thenReturn(Optional.of(preview));
        when(ttsPreviewService.timeline(project)).thenReturn(new ClipTtsPreviewService.Timeline("hash-1", "v1", List.of(), List.of()));

        BusinessException error = assertThrows(BusinessException.class, () -> service.assemble("owner-1", "cp_1", "req-assemble-1", 3));
        assertEquals("CLIP_SHOT_ARTIFACT_MISSING", error.getCode());
    }

    @Test
    void theSameClientRequestIdNeverOpensASecondAssembleOrder() {
        everythingReady();
        ClipRenderJob existing = ClipRenderJob.builder().id("cj_existing").externalOwnerId("owner-1").projectId("cp_1")
                .clientRequestId("req-assemble-1").status("assembling").stage("assemble").build();
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-1", "req-assemble-1")).thenReturn(Optional.of(existing));

        assertEquals("cj_existing", service.assemble("owner-1", "cp_1", "req-assemble-1", 3).jobId());
        verify(jobs, never()).save(any());
    }

    @Test
    void aStaleAssembleQuoteIsRefusedBeforeTheJobExists() {
        everythingReady();
        BusinessException error = assertThrows(BusinessException.class, () -> service.assemble("owner-1", "cp_1", "req-assemble-1", 99));
        assertEquals("CLIP_QUOTE_CHANGED", error.getCode());
        verify(jobs, never()).save(any());
    }

    @Test
    void theProjectRecordsWhatTheFilmActuallyCostNotJustTheAssembleFee() {
        everythingReady();
        when(shotJobs.findByProjectId("cp_1")).thenReturn(List.of(
                ClipShotJob.builder().externalOwnerId("owner-1").status("succeeded").credits(12).build(),
                ClipShotJob.builder().externalOwnerId("owner-1").status("failed").credits(0).build()));
        service.assemble("owner-1", "cp_1", "req-assemble-1", 3);
        assertEquals(15, project.getCreditsHeld(), "12（已成功的段级实扣）+ 3（总装）");
    }
}
