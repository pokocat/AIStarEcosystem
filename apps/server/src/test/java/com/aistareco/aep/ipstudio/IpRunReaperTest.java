package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpRunReaper;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.service.CreditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 僵死运行（进程重启 / 线程被杀）不能永远 running，冻结额也不能挂着等 sweeper。 */
class IpRunReaperTest {

    private IpStudioFixtures.Runs runs;
    private CreditService credits;
    private IpRunReaper reaper;

    @BeforeEach
    void setUp() {
        runs = new IpStudioFixtures.Runs();
        credits = mock(CreditService.class);
        reaper = new IpRunReaper(runs.repo, credits, IpStudioFixtures.props());
    }

    private void seed(String id, String status, Instant heartbeat) {
        runs.repo.save(IpRun.builder()
                .id(id).projectId("IPP-55555555").ownerUserId(USER).nodeId("n-" + id)
                .kind(IpRun.KIND_GENERATE).status(status).stage("image.generate.1").pct(30)
                .cost(32L)
                .createdAt(Instant.now().minus(30, ChronoUnit.MINUTES))
                .heartbeatAt(heartbeat)
                .build());
    }

    @Test
    void staleRunningIsFailedAndRefunded() {
        seed("IPR-stale001", IpRun.STATUS_RUNNING, Instant.now().minus(40, ChronoUnit.MINUTES));

        assertEquals(1, reaper.sweep());

        IpRun r = runs.rows.get("IPR-stale001");
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_RUN_TIMEOUT", r.getErrorCode());
        assertEquals(0L, r.getCost());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-stale001"), anyString());
    }

    @Test
    void freshRunningAndTerminalRunsAreLeftAlone() {
        seed("IPR-fresh001", IpRun.STATUS_RUNNING, Instant.now());
        seed("IPR-done0001", IpRun.STATUS_DONE, Instant.now().minus(90, ChronoUnit.MINUTES));

        assertEquals(0, reaper.sweep());

        assertEquals(IpRun.STATUS_RUNNING, runs.rows.get("IPR-fresh001").getStatus());
        assertEquals(IpRun.STATUS_DONE, runs.rows.get("IPR-done0001").getStatus());
        verify(credits, never()).releaseHold(anyString(), anyString(), anyString());
    }
}
