package com.aistareco.aep.ipstudio.config;

import com.aistareco.aep.config.MdcTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * IP 工作台运行线程池。
 *
 * <p>刻意与 {@code dapJobExecutor} 分开：一次 master 生成会串行出 4 张图、单张可达十几秒，
 * 共用池会把数字人线的形象生成堵在队尾（同 v0.150 clip 配音预览与出片分池的理由）。
 */
@Configuration
public class IpStudioAsyncConfig {

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
     */
    @Bean(name = "studioControlExecutor")
    public ThreadPoolTaskExecutor studioControlExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(6);
        executor.setMaxPoolSize(6);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix(CONTROL_THREAD_PREFIX);
        executor.setWaitForTasksToCompleteOnShutdown(false);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    public static final String CONTROL_THREAD_PREFIX = "studio-control-";
}
