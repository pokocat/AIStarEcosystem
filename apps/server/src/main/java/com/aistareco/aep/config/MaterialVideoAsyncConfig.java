package com.aistareco.aep.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * 带货视频生成异步执行器。@EnableAsync 已由 MixcutAsyncConfig 全局开启，这里只加线程池。
 *
 * worker 提交后会在该线程上轮询视频大模型直到出片 / 超时（视频生成慢，单任务可达数分钟），
 * 故并发上限 = 线程池大小（aep.material.video.max-concurrent，默认 3）。超出的任务在队列等待。
 */
@Configuration
public class MaterialVideoAsyncConfig {

    private final MaterialVideoProperties props;

    public MaterialVideoAsyncConfig(MaterialVideoProperties props) {
        this.props = props;
    }

    @Bean(name = "materialVideoExecutor")
    public Executor materialVideoExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        int pool = Math.max(1, props.getMaxConcurrent());
        exec.setCorePoolSize(pool);
        exec.setMaxPoolSize(pool);
        exec.setQueueCapacity(128);
        exec.setThreadNamePrefix("material-video-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.setTaskDecorator(new MdcTaskDecorator());
        exec.initialize();
        return exec;
    }
}
