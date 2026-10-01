package com.aistareco.aep.videostudio.config;

import com.aistareco.aep.config.MdcTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 视频生成区「智能优化」线程池。
 *
 * <p>刻意与出片的 {@code materialVideoExecutor}（3 个线程）分开：厂商的优化接口是同步的，一次最长要等十分钟上下，
 * 共用池会让几个优化把整条出片链堵死（同 ipstudio / clip 配音预览分池的理由）。
 * 排满时派发抛 {@code TaskRejectedException}，由提交方把那条记录判失败并退冻结，不留永远 queued 的行。
 */
@Configuration
public class VideoStudioAsyncConfig {

    /** 同时在等厂商的优化最多几个。 */
    static final int THREADS = 8;
    static final int QUEUE_CAPACITY = 64;

    @Bean(name = "videoStudioOptimizationExecutor")
    public ThreadPoolTaskExecutor videoStudioOptimizationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(THREADS);
        executor.setMaxPoolSize(THREADS);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix("vs-optimize-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }
}
