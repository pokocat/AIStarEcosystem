package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.postgres.PostgresTestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@DataJpaTest(showSql = false)
@ActiveProfiles("postgresit")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StudioDepthQueuePostgresIT {
    @Autowired private DataSource dataSource;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private IpRunRepository runs;
    @Autowired private PlatformTransactionManager transactions;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        PostgresTestDatabase.configure(registry, "test_studio_depth");
    }

    @Test
    void admissionIsLockedAcrossConnectionsUntilTheTaskTransactionEnds() throws Exception {
        var queue = new StudioDepthQueue(jdbc, runs, mock(StudioWorkflowWorker.class));
        try (var competingNode = dataSource.getConnection();
             var statement = competingNode.prepareStatement("SELECT pg_try_advisory_xact_lock(?, ?)")) {
            statement.setInt(1, StudioDepthQueue.LOCK_NAMESPACE);
            statement.setInt(2, StudioDepthQueue.LOCK_DEPTH_ADMISSION);
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                queue.lockAdmission();
                try (var result = statement.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getBoolean(1)).isFalse();
                } catch (java.sql.SQLException error) {
                    throw new AssertionError(error);
                }
            });
            try (var result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getBoolean(1)).isTrue();
            }
        }
    }

    @Test
    void aFreshWorkerDispatchesOnlyUnstartedControlsInPersistedOrder() {
        Instant now = Instant.now();
        runs.saveAndFlush(run("control-first", "studio-video-control", IpRun.STATUS_RUNNING, now.minusSeconds(2), null));
        runs.saveAndFlush(run("control-second", "studio-video-control", IpRun.STATUS_RUNNING, now, null));
        runs.saveAndFlush(run("already-started", "studio-video-control", IpRun.STATUS_RUNNING, now, now));
        runs.saveAndFlush(run("other-work", "studio-video", IpRun.STATUS_RUNNING, now, null));
        runs.saveAndFlush(run("finished", "studio-video-control", IpRun.STATUS_DONE, now, null));

        var worker = mock(StudioWorkflowWorker.class);
        new StudioDepthQueue(jdbc, runs, worker).dispatch();
        var ordered = inOrder(worker);
        ordered.verify(worker).runBlocking("control-first");
        ordered.verify(worker).runBlocking("control-second");
        verifyNoMoreInteractions(worker);
    }

    private IpRun run(String id, String kind, String status, Instant created, Instant started) {
        return IpRun.builder().id(id).kind(kind).status(status).projectId("test-project")
                .nodeId(id).ownerUserId("test-user").createdAt(created).startedAt(started)
                .heartbeatAt(created).build();
    }
}
