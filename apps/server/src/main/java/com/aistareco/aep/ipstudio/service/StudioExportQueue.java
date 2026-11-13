package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.ops.DeploymentRuntime;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.time.Duration;

/** The export process polls persisted runs in order. A database lock protects the single slot during handovers. */
@Configuration(proxyBeanMethods = false)
@Profile("postgres")
@ConditionalOnProperty(name = "aep.ipstudio.export-worker", havingValue = "true")
public class StudioExportQueue {
    public static final String KIND = "studio-assemble";
    public static final String WAITING = "studio.export.queued";
    public static final String RENDERING = "studio.export.rendering";
    static final int LOCK_NAMESPACE = 0x41535452;
    static final int LOCK_EXPORT = 0x45585054;

    @Bean
    ThreadPoolTaskScheduler studioExportScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("studio-export-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(240);
        scheduler.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
        return scheduler;
    }

    @Bean
    Dispatcher studioExportDispatcher(DataSource dataSource, IpRunRepository runs, StudioWorkflowWorker worker,
            DeploymentRuntime deployment, ThreadPoolTaskScheduler studioExportScheduler) {
        return new Dispatcher(dataSource, runs, worker, deployment, studioExportScheduler);
    }

    record Dispatcher(DataSource dataSource, IpRunRepository runs, StudioWorkflowWorker worker,
                      DeploymentRuntime deployment, ThreadPoolTaskScheduler scheduler) {
        @EventListener(ApplicationReadyEvent.class)
        public void start() {
            scheduler.scheduleWithFixedDelay(() -> {
                if (!deployment.isQuiescing()) dispatch(dataSource, runs, worker);
            }, Duration.ofSeconds(2));
        }
    }

    static void dispatch(DataSource dataSource, IpRunRepository runs, StudioWorkflowWorker worker) {
        // Keep a session lock across rendering. The database transaction stays idle only for the short lock query.
        try (var connection = dataSource.getConnection()) {
            try (var lock = connection.prepareStatement("SELECT pg_try_advisory_lock(?, ?)")) {
                lock.setInt(1, LOCK_NAMESPACE);
                lock.setInt(2, LOCK_EXPORT);
                try (var result = lock.executeQuery()) {
                    if (!result.next() || !result.getBoolean(1)) return;
                }
            }
            try {
                runs.exportDispatchIds(KIND, WAITING, RENDERING, PageRequest.of(0, 1)).stream()
                        .findFirst().ifPresent(worker::runDedicatedExport);
            } finally {
                try (var unlock = connection.prepareStatement("SELECT pg_advisory_unlock(?, ?)")) {
                    unlock.setInt(1, LOCK_NAMESPACE);
                    unlock.setInt(2, LOCK_EXPORT);
                    unlock.execute();
                } catch (SQLException error) {
                    // A connection with an unknown lock state must never go back to the pool.
                    connection.abort(Runnable::run);
                    throw error;
                }
            }
        } catch (SQLException error) {
            throw new IllegalStateException("Could not acquire the Studio export slot", error);
        }
    }
}
