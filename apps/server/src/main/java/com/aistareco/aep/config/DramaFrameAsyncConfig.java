package com.aistareco.aep.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * 短剧首帧图像生成执行器。视频任务用 materialVideoExecutor，首帧单独限流。
 */
@Configuration
public class DramaFrameAsyncConfig {

    private final DramaFrameProperties props;

    public DramaFrameAsyncConfig(DramaFrameProperties props) {
        this.props = props;
    }

    @Bean(name = "dramaFrameExecutor")
    public Executor dramaFrameExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        int pool = Math.max(1, props.getMaxConcurrent());
        exec.setCorePoolSize(pool);
        exec.setMaxPoolSize(pool);
        exec.setQueueCapacity(128);
        exec.setThreadNamePrefix("drama-frame-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.setTaskDecorator(new MdcTaskDecorator());
        exec.initialize();
        return exec;
    }
}
