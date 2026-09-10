package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.dto.ClipRequests.GenerateShot;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.ClipShotJobRepository;
import com.aistareco.aep.clip.service.*;
import com.aistareco.aep.clip.service.shiliu.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 段级生成的四条钱的口径：指纹命中不重扣、重复请求不重扣、报价对不上不下单、成功才扣。 */
class ClipShotJobServiceTest {
    private ClipShotJobRepository jobs;
    private ClipProjectService projects;
    private ClipShotJobService service;
    private ClipProject project;

    /** 一条 avatar 镜（12 字 → 3 秒）+ 一条 tail 镜。单价 1/秒，所以 avatar 那镜报价 3。 */
    private static Map<String, Object> payload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("segments", List.of(
                new LinkedHashMap<>(Map.of("no", 1, "role", "avatar", "text", "十二个字的一句台词啊")),
                new LinkedHashMap<>(Map.of("no", 2, "role", "tail", "text", "结尾", "durationSec", 3))));
        payload.put("shots", new ArrayList<>(ClipShotPlan.defaultShots(
                com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("segments")))));
        return payload;
    }

    @BeforeEach
    void setUp() {
        jobs = mock(ClipShotJobRepository.class);
        projects = mock(ClipProjectService.class);
        ClipProperties props = new ClipProperties();
        props.setPricingAvatarSecond("1"); props.setPricingTtsPerKchar("5"); props.setPricingAssemble("3");
        props.setPricingT2iPerImage("2"); props.setPricingT2vSecond("1"); props.setPricingI2vSecond("1");
        ClipEstimateService estimates = new ClipEstimateService(props, projects, mock(ClipAvatarService.class), mock(ClipAssetService.class));
        ShiliuService shiliu = mock(ShiliuService.class);
        when(shiliu.required()).thenReturn(mock(ShiliuGateway.class));
        when(shiliu.mockMode()).thenReturn(true);
        project = ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1").templateName("模板")
                .title("项目").status("draft").payloadJson(payload()).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(projects.required("owner-1", "cp_1")).thenReturn(project);
        when(jobs.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new ClipShotJobService(jobs, projects, estimates, shiliu, props, mock(FileStorageService.class));
    }

    private static GenerateShot request(String model, String fingerprint, Integer credits) {
        return new GenerateShot(model, null, null, null, null, null, fingerprint, "req-shot-0001", credits);
    }

    @Test
    void acceptsOneJobWithNothingChargedYet() {
        ShotGenerateResult result = service.generate("owner-1", "cp_1", 1, request("avatar", "fp-1", 3));
        assertEquals("queued", result.status());
        assertTrue(result.jobId().startsWith("csj_"));
        assertEquals(0, result.credits(), "受理时一分都不该扣，成功才扣");
        verify(jobs).save(argThat(j -> j.getQuotedCredits() == 3 && j.getCredits() == 0 && j.getShotNo() == 1));
    }

    @Test
    void aFingerprintHitReturnsTheExistingArtifactWithoutRunningOrChargingAgain() {
        Map<String, Object> payload = payload();
        List<Map<String, Object>> shots = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("shots"));
        shots.get(0).put("source", Map.of("model", "avatar", "artifact", Map.of("cdnKey", "clip/segments/a.mp4", "fingerprint", "fp-1", "durationSec", 3.0)));
        payload.put("shots", shots);
        project.setPayloadJson(payload);
        when(jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoAndFingerprintAndStatusOrderByCreatedAtDesc("owner-1", "cp_1", 1, "fp-1", "succeeded"))
                .thenReturn(Optional.of(ClipShotJob.builder().id("csj_old").quotedCredits(3).credits(3).build()));

        ShotGenerateResult result = service.generate("owner-1", "cp_1", 1, request("avatar", "fp-1", 3));
        assertEquals("succeeded", result.status());
        // 回的是**原来那一单**，调用方按 jobId 结算就结算不出第二笔 —— 不重扣靠的是这条身份，不是数字
        assertEquals("csj_old", result.jobId());
        assertEquals(3, result.credits(), "报的是这条 job 一共扣过多少，与 generation 同口径");
        verify(jobs, never()).save(any());
    }

    @Test
    void aChangedFingerprintStillCostsAFreshRun() {
        Map<String, Object> payload = payload();
        List<Map<String, Object>> shots = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("shots"));
        shots.get(0).put("source", Map.of("artifact", Map.of("cdnKey", "clip/segments/a.mp4", "fingerprint", "fp-old")));
        payload.put("shots", shots);
        project.setPayloadJson(payload);

        assertEquals("queued", service.generate("owner-1", "cp_1", 1, request("avatar", "fp-new", 3)).status());
        verify(jobs).save(any());
    }

    @Test
    void theSameClientRequestIdNeverOpensASecondOrder() {
        ClipShotJob existing = ClipShotJob.builder().id("csj_existing").externalOwnerId("owner-1").projectId("cp_1")
                .shotNo(1).clientRequestId("req-shot-0001").model("avatar").status("running").quotedCredits(3).credits(0).build();
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-1", "req-shot-0001")).thenReturn(Optional.of(existing));

        ShotGenerateResult result = service.generate("owner-1", "cp_1", 1, request("avatar", "fp-1", 3));
        assertEquals("csj_existing", result.jobId());
        assertEquals(0, result.credits());
        verify(jobs, never()).save(any());
    }

    @Test
    void aRequestIdReusedForADifferentShotIsRefusedRatherThanSilentlyRebound() {
        ClipShotJob existing = ClipShotJob.builder().id("csj_existing").externalOwnerId("owner-1").projectId("cp_1")
                .shotNo(2).clientRequestId("req-shot-0001").model("avatar").status("running").build();
        when(jobs.findByExternalOwnerIdAndClientRequestId("owner-1", "req-shot-0001")).thenReturn(Optional.of(existing));

        BusinessException error = assertThrows(BusinessException.class, () -> service.generate("owner-1", "cp_1", 1, request("avatar", "fp-1", 3)));
        assertEquals("CLIP_SHOT_REQUEST_CONFLICT", error.getCode());
    }

    @Test
    void aStaleQuoteIsRefusedBeforeAnyJobExists() {
        BusinessException error = assertThrows(BusinessException.class, () -> service.generate("owner-1", "cp_1", 1, request("avatar", "fp-1", 2)));
        assertEquals("CLIP_QUOTE_CHANGED", error.getCode());
        verify(jobs, never()).save(any());
    }

    @Test
    void anOverlongAvatarShotIsRefusedByTheSameLimitTheWholeFilmUses() {
        Map<String, Object> payload = payload();
        List<Map<String, Object>> segments = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("segments"));
        segments.get(0).put("actualDurationSec", 99);
        payload.put("segments", segments);
        project.setPayloadJson(payload);

        BusinessException error = assertThrows(BusinessException.class, () -> service.generate("owner-1", "cp_1", 1, request("avatar", "fp-1", 99)));
        assertEquals("CLIP_SEGMENT_TOO_LONG", error.getCode());
        verify(jobs, never()).save(any());
    }

    @Test
    void ipStudioModelsSayTheyAreNotWiredInsteadOfTakingMoneyForNothing() {
        for (String model : List.of("t2i", "t2v", "i2v")) {
            BusinessException error = assertThrows(BusinessException.class, () -> service.generate("owner-1", "cp_1", 1, request(model, "fp-1", 3)));
            assertEquals("CLIP_ENGINE_NOT_CONFIGURED", error.getCode(), model);
        }
        verify(jobs, never()).save(any());
    }

    @Test
    void aShotNumberOutsideThePlanIs404NotASilentFirstShot() {
        BusinessException error = assertThrows(BusinessException.class, () -> service.generate("owner-1", "cp_1", 9, request("avatar", "fp-1", 3)));
        assertEquals("CLIP_SHOT_NOT_FOUND", error.getCode());
    }

    @Test
    void pollingAShotThatWasNeverGeneratedReportsNoneSoTheClientCanOfferToRun() {
        when(jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoOrderByCreatedAtDesc("owner-1", "cp_1", 1)).thenReturn(Optional.empty());
        ShotGenerationDto view = service.generation("owner-1", "cp_1", 1);
        assertEquals("none", view.status());
        assertNull(view.artifact());
    }

    @Test
    void aStoredArtifactSurvivesTheJobRowSoASecondDeviceStillSeesIt() {
        Map<String, Object> payload = payload();
        List<Map<String, Object>> shots = com.aistareco.aep.clip.dto.ClipDtos.mapListValue(payload.get("shots"));
        shots.get(0).put("source", Map.of("artifact", Map.of("cdnKey", "clip/segments/a.mp4", "fingerprint", "fp-1", "durationSec", 3.0)));
        payload.put("shots", shots);
        project.setPayloadJson(payload);
        when(jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoOrderByCreatedAtDesc("owner-1", "cp_1", 1)).thenReturn(Optional.empty());

        ShotGenerationDto view = service.generation("owner-1", "cp_1", 1);
        assertEquals("succeeded", view.status());
        assertNotNull(view.artifact());
        assertEquals("fp-1", view.artifact().fingerprint());
    }

    @Test
    void cancellingLeavesTheChargeAtZeroAndCancellingAFinishedOneIsNotAnError() {
        ClipShotJob running = ClipShotJob.builder().id("csj_1").externalOwnerId("owner-1").projectId("cp_1").shotNo(1)
                .clientRequestId("req-shot-0001").model("avatar").status("running").progress(30).quotedCredits(3).credits(0).build();
        when(jobs.findFirstByExternalOwnerIdAndProjectIdAndShotNoOrderByCreatedAtDesc("owner-1", "cp_1", 1)).thenReturn(Optional.of(running));

        ShotGenerationDto cancelled = service.cancel("owner-1", "cp_1", 1);
        assertEquals("cancelled", cancelled.status());
        assertEquals(0, cancelled.credits(), "取消不扣费");
        assertNull(cancelled.artifact(), "取消掉的一单没产出任何东西，不能把上一版的产物挂到它名下");

        // 再取消一次：已经是终态，回当前状态而不是抛错
        assertEquals("cancelled", service.cancel("owner-1", "cp_1", 1).status());
        verify(jobs, times(1)).save(any());
    }
}
