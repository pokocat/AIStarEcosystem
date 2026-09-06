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
}
