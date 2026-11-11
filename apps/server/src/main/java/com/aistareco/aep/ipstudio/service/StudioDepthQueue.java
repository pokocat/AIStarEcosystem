package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** API nodes persist controls. The scheduler on the active worker dispatches them. */
@Component
@Profile("postgres")
public class StudioDepthQueue {
    static final int LOCK_NAMESPACE = 0x41535452; // ASTR
    static final int LOCK_DEPTH_ADMISSION = 0x44455054; // DEPT
    private final JdbcTemplate jdbc;
    private final IpRunRepository runs;
    private final StudioWorkflowWorker worker;

    public StudioDepthQueue(JdbcTemplate jdbc, IpRunRepository runs, StudioWorkflowWorker worker) {
        this.jdbc = jdbc;
        this.runs = runs;
        this.worker = worker;
    }

    public void lockAdmission() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Depth admission requires the task creation transaction");
        }
        jdbc.query("SELECT pg_advisory_xact_lock(?, ?)", (ResultSetExtractor<Void>) rows -> null,
                LOCK_NAMESPACE, LOCK_DEPTH_ADMISSION);
    }

    @Scheduled(initialDelay = 2_000, fixedDelay = 2_000)
    public void dispatch() {
        for (String runId : runs.unstartedRunIds("studio-video-control", IpRun.STATUS_RUNNING, PageRequest.of(0, 48))) {
            worker.runBlocking(runId);
        }
    }
}
