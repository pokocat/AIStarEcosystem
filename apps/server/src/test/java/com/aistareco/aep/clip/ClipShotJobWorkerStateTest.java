package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.ClipShotJobRepository;
import com.aistareco.aep.clip.service.*;
import com.aistareco.aep.clip.service.shiliu.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 段级 worker：报价只在落 succeeded 的那一刻变成实扣，别的路径 credits 一律停在 0。 */
class ClipShotJobWorkerStateTest {
    private ClipShotJobRepository jobs;
    private ClipProjectService projects;
    private ClipAssemblyService assembly;
    private ClipShotJobWorkerState state;

    @BeforeEach
    void setUp() {
        jobs = mock(ClipShotJobRepository.class);
        projects = mock(ClipProjectService.class);
        assembly = mock(ClipAssemblyService.class);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", List.of(new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", "十二个字的一句台词啊"))));
        payload.put("shots", ClipShotPlan.defaultShots(com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("segments"))));
        ClipProject project = ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1")
                .templateName("模板").title("项目").status("draft").payloadJson(payload)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(projects.required("owner-1", "cp_1")).thenReturn(project);
        when(jobs.save(any())).thenAnswer(inv -> inv.getArgument(0));
        state = new ClipShotJobWorkerState(jobs, projects, mock(ShiliuService.class), mock(ClipAvatarService.class),
                mock(ClipOutputStorage.class), assembly, mock(ClipAssetThumbnailExtractor.class));
    }

    private ClipShotJob job(String status) {
        return ClipShotJob.builder().id("csj_1").externalOwnerId("owner-1").projectId("cp_1").shotNo(1)
                .clientRequestId("req-shot-0001").model("avatar").status(status).progress(0)
                .quotedCredits(7).credits(0).fingerprint("fp-1").mock(true).leaseOwner("w1").build();
    }

    @Test
    void successChargesTheQuoteExactlyOnceAndPinsTheArtifactOntoTheProject() {
        ClipShotJob row = job("queued");
        when(jobs.findById("csj_1")).thenReturn(Optional.of(row));
        when(assembly.renderMockShot(eq("owner-1"), anyMap()))
                .thenReturn(new ClipAssemblyService.Result("clip/segments/a.mp4", "clip/thumbnails/a.jpg", 3, 1024));

        state.advance("csj_1", "w1");

        assertEquals("succeeded", row.getStatus());
        assertEquals(7, row.getCredits(), "成功那一刻才把报价抄成实扣");
        assertEquals("clip/segments/a.mp4", row.getArtifactCdnKey());
        // 产物的真源是项目 payload，不是任务行 —— 换台手机重新拉项目还要看得见
        verify(projects).recordShotArtifact(eq("owner-1"), eq("cp_1"), eq(1), argThat(a ->
                "clip/segments/a.mp4".equals(a.get("cdnKey")) && "fp-1".equals(a.get("fingerprint"))), eq("avatar"), isNull());
    }

    @Test
    void failureLeavesTheChargeAtZeroSoThereIsNothingToRefund() {
        ClipShotJob row = job("running");
        when(jobs.findById("csj_1")).thenReturn(Optional.of(row));

        state.fail("csj_1", "CLIP_ENGINE_CALL_FAILED", "上游炸了");

        assertEquals("failed", row.getStatus());
        assertEquals(0, row.getCredits());
        assertEquals(7, row.getQuotedCredits(), "报价留着可查，但它不是实扣");
        assertEquals("CLIP_ENGINE_CALL_FAILED", row.getErrorCode());
    }

    @Test
    void aJobThatAlreadyEndedIsNeverReopenedByALateFailure() {
        ClipShotJob row = job("succeeded"); row.setCredits(7);
        when(jobs.findById("csj_1")).thenReturn(Optional.of(row));

        state.fail("csj_1", "CLIP_SHOT_TIMEOUT", "迟到的 reaper");

        assertEquals("succeeded", row.getStatus());
        assertEquals(7, row.getCredits());
        verify(jobs, never()).save(any());
    }

    @Test
    void anotherWorkersLeaseIsNotStolen() {
        ClipShotJob row = job("queued");
        when(jobs.findById("csj_1")).thenReturn(Optional.of(row));
        state.advance("csj_1", "someone-else");
        verifyNoInteractions(assembly);
        verify(jobs, never()).save(any());
    }
}
