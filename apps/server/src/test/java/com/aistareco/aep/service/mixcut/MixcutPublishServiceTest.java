package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.MixcutPublishBatchRequest;
import com.aistareco.aep.dto.MixcutPublishBatchResultDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.aep.service.publish.ScheduleExpander;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 例行 QA 巡检（2026-07-03）回归测试：{@code bumpPublishTracker} 此前仅
 * {@code outputRepository.findById(outputId)}，未校验 output 归属当前用户 ——
 * 恶意认证用户在批量发布请求体里传入他人的 outputId，即可污染其
 * publishCount / lastPublishedAt 计数（视频库「已发 ×N」徽标错乱）。
 *
 * 锁定：① 归属当前用户的 output → 正常累加；② 归属他人的 output → 静默跳过、
 * 不落库、不影响本次派单业务结果（派单本身照常成功，只是 tracker 不更新）。
 */
class MixcutPublishServiceTest {

    private static final String USER = "u1";
    private static final String OTHER_USER = "u2";

    private PublishJobService publishJobService;
    private MixcutRenderOutputRepository outputRepository;
    private MixcutPublishService svc;

    @BeforeEach
    void setUp() {
        publishJobService = mock(PublishJobService.class);
        outputRepository = mock(MixcutRenderOutputRepository.class);
        svc = new MixcutPublishService(publishJobService, outputRepository, new ScheduleExpander());
    }

    private static MixcutRenderOutput outputOwnedBy(String outputId, String ownerUserId) {
        MixcutRenderJob job = new MixcutRenderJob();
        job.setId("job-" + outputId);
        job.setUserId(ownerUserId);
        MixcutRenderOutput o = new MixcutRenderOutput();
        o.setId(outputId);
        o.setJob(job);
        o.setPublishCount(0);
        return o;
    }

    private static PublishJobDto fakeJob(String id) {
        return new PublishJobDto(
                id, USER, "proj-1", "acct-1", "douyin", "抖音",
                "queued", 0, "https://cdn.example.com/v.mp4", "title", "desc",
                List.of(), null, null, null, null, null, null, null,
                0L, null, Instant.now(), Instant.now(), Instant.now());
    }

    private static MixcutPublishBatchRequest singleOutputRequest(String outputId) {
        return new MixcutPublishBatchRequest(
                null,
                List.of(new MixcutPublishBatchRequest.OutputItem(outputId, "https://cdn.example.com/v.mp4", null)),
                "标题", null, null, null,
                List.of(new MixcutPublishBatchRequest.TargetItem("douyin", "acct-1")),
                new MixcutPublishBatchRequest.ScheduleSpec.Immediate(),
                null, null, null);
    }

    @Test
    void bumpsTrackerWhenOutputOwnedByCaller() {
        MixcutRenderOutput owned = outputOwnedBy("out-1", USER);
        when(outputRepository.findById("out-1")).thenReturn(Optional.of(owned));
        when(publishJobService.createBatch(eq(USER), any(CreatePublishJobInputDto.class)))
                .thenReturn(List.of(fakeJob("job-1")));

        MixcutPublishBatchResultDto result = svc.batchPublish(USER, singleOutputRequest("out-1"));

        assertEquals(1, result.successJobs().size());
        assertTrue(result.failedItems() == null || result.failedItems().isEmpty());
        assertEquals(1, owned.getPublishCount());
        assertNotNull(owned.getLastPublishedAt());
        verify(outputRepository).save(owned);
    }

    @Test
    void skipsTrackerWhenOutputOwnedByAnotherUser() {
        MixcutRenderOutput ownedByOther = outputOwnedBy("out-2", OTHER_USER);
        when(outputRepository.findById("out-2")).thenReturn(Optional.of(ownedByOther));
        when(publishJobService.createBatch(eq(USER), any(CreatePublishJobInputDto.class)))
                .thenReturn(List.of(fakeJob("job-2")));

        MixcutPublishBatchResultDto result = svc.batchPublish(USER, singleOutputRequest("out-2"));

        // 派单本身仍应成功（tracker 只是旁路计数，不影响主业务结果）。
        assertEquals(1, result.successJobs().size());
        // 但归属他人的 output 不应被本次调用污染。
        assertEquals(0, ownedByOther.getPublishCount());
        assertNull(ownedByOther.getLastPublishedAt());
        verify(outputRepository, never()).save(any());
    }
}
