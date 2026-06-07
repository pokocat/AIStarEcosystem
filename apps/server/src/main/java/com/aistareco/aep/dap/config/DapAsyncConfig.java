package com.aistareco.aep.dap.config;

import com.aistareco.aep.config.MdcTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 数字人资产平台异步任务线程池（形象生成 / 迭代 / 衍生 / 运镜视频）。
 * 视频任务在线程上同步轮询直到出片，单任务可达数分钟；并发上限 = aep.dap.max-concurrent。
 */
@Configuration
public class DapAsyncConfig {

    @Bean(name = "dapJobExecutor")
    public ThreadPoolTaskExecutor dapJobExecutor(DapProperties props) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int n = Math.max(1, props.getMaxConcurrent());
        executor.setCorePoolSize(n);
        executor.setMaxPoolSize(n);
        executor.setQueueCapacity(128);
        executor.setThreadNamePrefix("dap-job-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }
}
