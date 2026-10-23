package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * docs/ip-studio-dialogue-no-continue.md §6: a dialogue task waits for a child run at most {@link ChildRuns#MAX_FOLLOW}
 * (no task deadline bounds it any more; image queues took up to 38 minutes on 2026-10-23), then reports it still running.
 */
class ChildRunsFollowTest {
    @Test void theWaitForAChildIsBoundedAndReturnsTheRunStillRunning() throws Exception {
        var runs = mock(IpRunRepository.class);
        AtomicInteger reads = new AtomicInteger();
        when(runs.findById("child")).thenAnswer(i -> { reads.incrementAndGet();
            return Optional.of(IpRun.builder().id("child").status("running").stage("endpoint.queued").build()); });
        var children = new ChildRuns(mock(StudioWorkflowService.class), runs, Optional.empty());
        var ctx = new ToolContext("u", "p", "t", "turn", "run", "a", "m", null, null, false, null, null, null, null, null, () -> false, null);
        long started = System.nanoTime();
        IpRun last = children.follow(ctx, "child", Duration.ofMillis(20), Duration.ofMillis(200), r -> { });
        long waited = Duration.ofNanos(System.nanoTime() - started).toMillis();
        assertEquals("running", last.getStatus());
        assertTrue(waited < 2000, "bounded by the follow window, not by the task: " + waited + "ms");
        assertTrue(reads.get() > 1, "it did poll");
        assertEquals(Duration.ofMinutes(10), ChildRuns.MAX_FOLLOW);
        assertEquals("排队中", ChildRuns.stageLabel(last));
    }

    @Test void aStopEndsTheWaitAtOnce() throws Exception {
        var runs = mock(IpRunRepository.class);
        when(runs.findById("child")).thenReturn(Optional.of(IpRun.builder().id("child").status("running").build()));
        var children = new ChildRuns(mock(StudioWorkflowService.class), runs, Optional.empty());
        var ctx = new ToolContext("u", "p", "t", "turn", "run", "a", "m", null, null, false, null, null, null, null, null, () -> true, null);
        long started = System.nanoTime();
        children.follow(ctx, "child", Duration.ofSeconds(5), Duration.ofMinutes(10), r -> { });
        assertTrue(Duration.ofNanos(System.nanoTime() - started).toMillis() < 1000);
    }
}
