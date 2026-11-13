package com.aistareco.aep.ipstudio.config;

import com.aistareco.aep.config.MdcTaskDecorator;
import com.aistareco.aep.ipstudio.service.StudioMediaJobs;
import com.aistareco.ops.DeploymentRuntime;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * IP 工作台运行线程池。
 *
 * <p>刻意与 {@code dapJobExecutor} 分开：一次 master 生成会串行出 4 张图、单张可达十几秒，
 * 共用池会把数字人线的形象生成堵在队尾（同 v0.150 clip 配音预览与出片分池的理由）。
 */
@Configuration
public class IpStudioAsyncConfig {
    // API standby and schema-inspection processes disable scheduling via BackgroundSchedulingConfiguration.
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true", matchIfMissing = true)
    static class StudioMediaWorkerConfig {
        @Bean
        ThreadPoolTaskScheduler studioMediaScheduler() {
            var scheduler = new ThreadPoolTaskScheduler();
            scheduler.setPoolSize(1);
            scheduler.setThreadNamePrefix("studio-media-");
            scheduler.setWaitForTasksToCompleteOnShutdown(true);
            scheduler.setAwaitTerminationSeconds(240);
            return scheduler;
        }

        @Bean
        StudioMediaWorker studioMediaWorker(StudioMediaJobs jobs, DeploymentRuntime deployment) {
            return new StudioMediaWorker(jobs, deployment);
        }
    }

    record StudioMediaWorker(StudioMediaJobs jobs, DeploymentRuntime deployment) {
        @Scheduled(scheduler = "studioMediaScheduler", initialDelay = 2_000, fixedDelay = 2_000)
        public void dispatch() {
            if (!deployment.isQuiescing()) jobs.dispatch();
        }

        @Scheduled(scheduler = "studioMediaScheduler", initialDelay = 60_000, fixedDelay = 3_600_000)
        public void expire() {
            if (!deployment.isQuiescing()) jobs.expire();
        }
    }

    @Bean(name = "ipRunExecutor")
    public ThreadPoolTaskExecutor ipRunExecutor(IpStudioProperties props) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int n = Math.max(1, props.getMaxConcurrent());
        executor.setCorePoolSize(n);
        executor.setMaxPoolSize(n);
        executor.setQueueCapacity(128);
        executor.setThreadNamePrefix("ip-run-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    /**
     * 深度复刻的动作提取（ReShot，CPU 推理，一次几十秒到几分钟）单独一个池：放在 ipRunExecutor 里，几段同时提取就把出图、出视频的线程占住。
     * 同一时间只做一次推理（StudioDepthVideoService 的信号量），这里的线程只是排队等；等的时候照常更新心跳（StudioWorkflowWorker）。
     * 线程数要大于受理上限能排出来的段数（StudioVideoTaskService#admitDepth）：排在线程池队列里的段不更新心跳，
     * 等满 stale-minutes 会被 IpRunReaper 当成卡死判超时（2026-11-11 查出：原来 6 个线程，两条 60 秒的深度复刻就会碰到）。
     */
    @Bean(name = "studioControlExecutor")
    public ThreadPoolTaskExecutor studioControlExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(48);
        executor.setMaxPoolSize(48);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix(CONTROL_THREAD_PREFIX);
        executor.setWaitForTasksToCompleteOnShutdown(false);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    public static final String CONTROL_THREAD_PREFIX = "studio-control-";
}
