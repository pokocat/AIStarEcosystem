package com.aistareco.aep.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * 音乐生成异步执行器。@EnableAsync 已由 MixcutAsyncConfig 全局开启，这里只加线程池。
 *
 * worker 会在该线程上轮询音乐大模型直到出曲 / 超时，故并发上限 = 线程池大小
 * （aep.music.gen.max-concurrent，默认 2，对齐火山公共资源池的 QPS/并发约束）。
 */
@Configuration
public class MusicGenAsyncConfig {

    private final MusicGenProperties props;

    public MusicGenAsyncConfig(MusicGenProperties props) {
        this.props = props;
    }

    @Bean(name = "musicGenExecutor")
    public Executor musicGenExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        int pool = Math.max(1, props.getMaxConcurrent());
        exec.setCorePoolSize(pool);
        exec.setMaxPoolSize(pool);
        exec.setQueueCapacity(128);
        exec.setThreadNamePrefix("music-gen-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.setTaskDecorator(new MdcTaskDecorator());
        exec.initialize();
        return exec;
    }
}
