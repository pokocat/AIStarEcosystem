package com.aistareco.aep.aiavatar;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarJob;
import com.aistareco.aep.aiavatar.model.AiAvatarJobStatus;
import com.aistareco.aep.aiavatar.repository.AiAvatarJobRepository;
import com.aistareco.aep.aiavatar.service.AiAvatarJobProgressTracker;
import com.aistareco.aep.aiavatar.service.AiAvatarJobRunner;
import com.aistareco.aep.aiavatar.service.AiAvatarJobWatchdog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 监控线程恢复逻辑（用户硬要求：异常中断自动续跑）—— §8 单元。
 *
 * 用内存假仓库驱动 sweep()，断言：
 *  1. 心跳过期的 RUNNING 任务（attempts < max）→ 退回 QUEUED 并被重新派发；
 *  2. 超过 maxAttempts 的卡死任务 → 置 FAILED，不再续跑；
 *  3. FAILED 但有剩余额度 → 自动重试派发；
 *  4. 长期 QUEUED 未启动 → 重新派发；
 *  5. 取消标记的任务不被续跑。
 */
class AiAvatarJobWatchdogTest {

    private AiAvatarJobRepository jobRepo;
    private AiAvatarJobRunner runner;
    private AiAvatarJobProgressTracker tracker;
    private AiAvatarProperties props;
    private AiAvatarJobWatchdog watchdog;

    private final List<AiAvatarJob> db = new ArrayList<>();

    @BeforeEach
    void setup() {
        jobRepo = mock(AiAvatarJobRepository.class);
        runner = mock(AiAvatarJobRunner.class);
        tracker = new AiAvatarJobProgressTracker();
        props = new AiAvatarProperties();
        props.setJobStaleMs(600_000L); // 10min

        // 假仓库：按内存 list 回放查询
        OffsetDateTime cutoffApprox = OffsetDateTime.now().minusSeconds(600);
        when(jobRepo.findByStatusAndHeartbeatAtBefore(eq(AiAvatarJobStatus.RUNNING), any())).thenAnswer(inv -> {
            OffsetDateTime cut = inv.getArgument(1);
            return db.stream().filter(j -> j.getStatus() == AiAvatarJobStatus.RUNNING
                    && j.getHeartbeatAt() != null && j.getHeartbeatAt().isBefore(cut)).toList();
        });
        when(jobRepo.findByStatusAndHeartbeatAtIsNullAndCreatedAtBefore(eq(AiAvatarJobStatus.RUNNING), any())).thenAnswer(inv -> {
            OffsetDateTime cut = inv.getArgument(1);
            return db.stream().filter(j -> j.getStatus() == AiAvatarJobStatus.RUNNING
                    && j.getHeartbeatAt() == null && j.getCreatedAt() != null && j.getCreatedAt().isBefore(cut)).toList();
        });
        when(jobRepo.findByStatus(any())).thenAnswer(inv -> {
            AiAvatarJobStatus s = inv.getArgument(0);
            return db.stream().filter(j -> j.getStatus() == s).toList();
        });
        when(jobRepo.save(any(AiAvatarJob.class))).thenAnswer(inv -> inv.getArgument(0));

        watchdog = new AiAvatarJobWatchdog(jobRepo, runner, tracker, props);
    }

    private AiAvatarJob job(String id, AiAvatarJobStatus status, int attempts, int maxAttempts,
                      OffsetDateTime heartbeat, OffsetDateTime created, OffsetDateTime started) {
        AiAvatarJob j = AiAvatarJob.builder()
                .id(id).ownerUserId("u").capability(AiAvatarCapability.TXT2IMG)
                .status(status).attempts(attempts).maxAttempts(maxAttempts)
                .heartbeatAt(heartbeat).createdAt(created).startedAt(started)
                .progress(20).build();
        db.add(j);
        return j;
    }

    @Test
    void staleRunningWithBudget_resumed() {
        AiAvatarJob j = job("j1", AiAvatarJobStatus.RUNNING, 1, 3,
                OffsetDateTime.now().minusMinutes(30), OffsetDateTime.now().minusMinutes(40), OffsetDateTime.now().minusMinutes(35));
        watchdog.sweep();
        assertEquals(AiAvatarJobStatus.QUEUED, j.getStatus(), "心跳过期且有额度应退回 QUEUED");
        verify(runner, times(1)).runAsync("j1");
    }

    @Test
    void staleRunningExhausted_failed() {
        AiAvatarJob j = job("j2", AiAvatarJobStatus.RUNNING, 3, 3,
                OffsetDateTime.now().minusMinutes(30), OffsetDateTime.now().minusMinutes(40), OffsetDateTime.now().minusMinutes(35));
        watchdog.sweep();
        assertEquals(AiAvatarJobStatus.FAILED, j.getStatus(), "达最大重试应置 FAILED");
        verify(runner, never()).runAsync("j2");
    }

    @Test
    void failedWithBudget_retried() {
        AiAvatarJob j = job("j3", AiAvatarJobStatus.FAILED, 1, 3, OffsetDateTime.now(), OffsetDateTime.now(), null);
        watchdog.sweep();
        assertEquals(AiAvatarJobStatus.QUEUED, j.getStatus());
        verify(runner, times(1)).runAsync("j3");
    }

    @Test
    void failedExhausted_notRetried() {
        AiAvatarJob j = job("j4", AiAvatarJobStatus.FAILED, 3, 3, OffsetDateTime.now(), OffsetDateTime.now(), null);
        watchdog.sweep();
        assertEquals(AiAvatarJobStatus.FAILED, j.getStatus());
        verify(runner, never()).runAsync("j4");
    }

    @Test
    void stuckQueued_dispatched() {
        job("j5", AiAvatarJobStatus.QUEUED, 0, 3, null, OffsetDateTime.now().minusMinutes(30), null);
        watchdog.sweep();
        verify(runner, times(1)).runAsync("j5");
    }

    @Test
    void cancelledMarker_notResumed() {
        AiAvatarJob j = job("j6", AiAvatarJobStatus.RUNNING, 1, 3,
                OffsetDateTime.now().minusMinutes(30), OffsetDateTime.now().minusMinutes(40), OffsetDateTime.now().minusMinutes(35));
        tracker.markCancelled("j6");
        watchdog.sweep();
        verify(runner, never()).runAsync("j6");
    }

    @Test
    void freshRunning_untouched() {
        AiAvatarJob j = job("j7", AiAvatarJobStatus.RUNNING, 1, 3,
                OffsetDateTime.now().minusSeconds(5), OffsetDateTime.now().minusSeconds(10), OffsetDateTime.now().minusSeconds(8));
        watchdog.sweep();
        assertEquals(AiAvatarJobStatus.RUNNING, j.getStatus(), "心跳新鲜的任务不应被打扰");
        verify(runner, never()).runAsync("j7");
    }

    @Test
    void sweepNeverThrows() {
        when(jobRepo.findByStatusAndHeartbeatAtBefore(any(), any())).thenThrow(new RuntimeException("db down"));
        assertDoesNotThrow(() -> watchdog.sweep(), "监控线程必须吞掉异常，绝不因单次失败而死");
    }
}
