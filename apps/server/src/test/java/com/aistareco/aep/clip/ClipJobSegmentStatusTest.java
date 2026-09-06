package com.aistareco.aep.clip;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.JobDto;
import com.aistareco.aep.clip.dto.ClipDtos.JobSegmentDto;
import com.aistareco.aep.clip.model.ClipRenderJob;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** WORKPLAN 2026-09-05 §1.6：ClipJobView 暴露段级状态，数据源只有 segmentJobsJson。 */
class ClipJobSegmentStatusTest {

    @Test
    void aJobWithoutWorkerStateExposesNoSegmentsSoCallersFallBackToOverallProgress() {
        assertTrue(JobDto.from(job("queued", null)).segments().isEmpty());
        assertTrue(JobDto.from(job("generating", Map.of("segments", List.of()))).segments().isEmpty());
    }

    @Test
    void producedSegmentsAreDoneAndTheFirstUnfinishedOneIsGenerating() {
        ClipRenderJob job = job("generating", Map.of("segments", List.of(
                row(1, "avatar", Map.of("audioCdnKey", "a1", "videoCdnKey", "v1")),
                row(2, "broll", Map.of("audioCdnKey", "a2")),
                row(3, "avatar", Map.of("audioCdnKey", "a3")),
                row(4, "avatar", Map.of()),
                row(5, "tail", Map.of()))));

        List<JobSegmentDto> segments = JobDto.from(job).segments();
        assertEquals(List.of("done", "done", "generating", "queued", "done"),
                segments.stream().map(JobSegmentDto::status).toList());
        assertEquals(List.of(1, 2, 3, 4, 5), segments.stream().map(JobSegmentDto::no).toList());
        assertEquals(List.of("avatar", "broll", "avatar", "avatar", "tail"),
                segments.stream().map(JobSegmentDto::role).toList());
        assertTrue(segments.stream().allMatch(s -> s.errorCode() == null));
    }

    @Test
    void aQueuedJobHasNoSegmentInFlight() {
        ClipRenderJob job = job("queued", Map.of("segments", List.of(row(1, "avatar", Map.of()), row(2, "broll", Map.of()))));
        assertEquals(List.of("queued", "queued"), JobDto.from(job).segments().stream().map(JobSegmentDto::status).toList());
    }

    @Test
    void theSegmentThatActuallyBrokeCarriesTheErrorCode() {
        ClipRenderJob job = job("failed", new LinkedHashMap<>(Map.of(
                "errorCode", "CLIP_ENGINE_CALL_FAILED",
                "segments", List.of(
                        row(1, "avatar", Map.of("audioCdnKey", "a1", "videoCdnKey", "v1")),
                        row(2, "avatar", Map.of("audioCdnKey", "a2", "status", "failed", "errorCode", "CLIP_ENGINE_CALL_FAILED")),
                        row(3, "broll", Map.of())))));

        List<JobSegmentDto> segments = JobDto.from(job).segments();
        assertEquals(List.of("done", "failed", "failed"), segments.stream().map(JobSegmentDto::status).toList());
        assertEquals("CLIP_ENGINE_CALL_FAILED", segments.get(1).errorCode());
        assertEquals("CLIP_ENGINE_CALL_FAILED", segments.get(2).errorCode(), "没做到的段也要带上原因，不能留 null");
    }

    @Test
    void cancellationIsReportedWithItsOwnCode() {
        ClipRenderJob job = job("cancelled", Map.of("segments", List.of(
                row(1, "avatar", Map.of("audioCdnKey", "a1", "videoCdnKey", "v1")),
                row(2, "avatar", Map.of()))));
        List<JobSegmentDto> segments = JobDto.from(job).segments();
        assertEquals("done", segments.get(0).status());
        assertEquals("failed", segments.get(1).status());
        assertEquals("CLIP_RENDER_CANCELLED", segments.get(1).errorCode());
    }

    @Test
    void aSucceededJobHasEverySegmentDone() {
        ClipRenderJob job = job("succeeded", Map.of("segments", List.of(
                row(1, "avatar", Map.of("audioCdnKey", "a1", "videoCdnKey", "v1")),
                row(2, "broll", Map.of("audioCdnKey", "a2")),
                row(3, "tail", Map.of()))));
        assertTrue(JobDto.from(job).segments().stream().allMatch(s -> "done".equals(s.status())));
    }

    @Test
    void theMapperReadsNothingButSegmentJobsJson() {
        ClipRenderJob job = job("generating", Map.of("segments", List.of(row(7, "broll", Map.of()))));
        List<JobSegmentDto> direct = ClipDtos.jobSegments(job);
        assertEquals(1, direct.size());
        assertEquals(7, direct.get(0).no(), "no 用的是 segmentJobsJson 里的镜头编号，不是列表下标");
    }

    private static Map<String, Object> row(int no, String role, Map<String, Object> extra) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("no", no);
        row.put("role", role);
        row.putAll(extra);
        return row;
    }

    private static ClipRenderJob job(String status, Map<String, Object> state) {
        return ClipRenderJob.builder().id("cj_1").externalOwnerId("owner-1").projectId("cp_1")
                .clientRequestId("request-001").status(status).stage("tts").segmentJobsJson(state)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
}
