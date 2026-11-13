package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.postgres.PostgresTestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

@DataJpaTest(showSql = false)
@ActiveProfiles("postgresit")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StudioExportQueuePostgresIT {
    @Autowired private DataSource dataSource;
    @Autowired private IpRunRepository runs;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        PostgresTestDatabase.configure(registry, "test_studio_export");
    }

    @Test
    void simultaneousSubmissionsSurviveAnInterruptedWorkerAndDrainInOrder() throws Exception {
        var pool = Executors.newFixedThreadPool(4);
        var submitted = new CountDownLatch(1);
        var rendering = new CountDownLatch(1);
        var interrupted = new CountDownLatch(1);
        var order = new ArrayList<String>();
        var worker = mock(StudioWorkflowWorker.class);
        var competing = mock(StudioWorkflowWorker.class);
        Instant now = Instant.now();
        try {
            var submissions = List.of(
                    pool.submit(() -> submit(submitted, "export-1", now, StudioExportQueue.WAITING)),
                    pool.submit(() -> submit(submitted, "export-2", now.plusSeconds(1), StudioExportQueue.WAITING)),
                    pool.submit(() -> submit(submitted, "export-3", now.plusSeconds(2), StudioExportQueue.WAITING)));
            submitted.countDown();
            for (var submission : submissions) submission.get(10, TimeUnit.SECONDS);
            submit(submitted, "export-interrupted", now.plusSeconds(3), StudioExportQueue.RENDERING);
            submit(submitted, "old-inline", now.minusSeconds(1), "queued");
            doAnswer(call -> {
                String id = call.getArgument(0);
                order.add(id);
                if (order.size() == 1) {
                    rendering.countDown();
                    assertThat(interrupted.await(10, TimeUnit.SECONDS)).isTrue();
                    throw new IllegalStateException("simulated worker loss");
                }
                var run = runs.findById(id).orElseThrow();
                run.setStatus(IpRun.STATUS_DONE);
                runs.saveAndFlush(run);
                return null;
            }).when(worker).runDedicatedExport(anyString());
            var first = pool.submit(() -> {
                try {
                    StudioExportQueue.dispatch(dataSource, runs, worker);
                } catch (IllegalStateException error) {
                    assertThat(error).hasMessage("simulated worker loss");
                }
            });
            assertThat(rendering.await(10, TimeUnit.SECONDS)).isTrue();
            StudioExportQueue.dispatch(dataSource, runs, competing);
            verifyNoInteractions(competing);
            assertThat(runs.findById("export-2").orElseThrow().getStage()).isEqualTo(StudioExportQueue.WAITING);
            interrupted.countDown();
            first.get(10, TimeUnit.SECONDS);
            for (int i = 0; i < 5; i++) StudioExportQueue.dispatch(dataSource, runs, worker);
            assertThat(order).containsExactly("export-interrupted","export-interrupted","export-1","export-2","export-3");
        } finally {
            interrupted.countDown();
            pool.shutdownNow();
        }
    }

    private void submit(CountDownLatch ready,String id,Instant created,String stage) {
        try {
            if (!ready.await(10, TimeUnit.SECONDS)) throw new AssertionError("Submission barrier timed out");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AssertionError(error);
        }
        runs.saveAndFlush(IpRun.builder().id(id).projectId("test-project").nodeId(id).ownerUserId("test-owner")
                .kind(StudioExportQueue.KIND).status(IpRun.STATUS_RUNNING).stage(stage)
                .createdAt(created).heartbeatAt(created).build());
    }
}
