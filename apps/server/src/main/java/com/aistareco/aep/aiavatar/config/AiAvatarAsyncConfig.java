package com.aistareco.aep.aiavatar.config;

import com.aistareco.aep.aiavatar.service.AiAvatarJobWatchdog;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executor;

/**
 * AiAvatar异步执行器 + 静态资源 serving + 监控线程定时调度。
 *
 * /static/aiavatar-assets/** → 外部 aiavatar-assets 目录（运行时产出的图 / 视频 / 3D；加密照片落 secure/ 子目录，不映射）。
 *
 * 全局 @EnableScheduling 已在 AiStarEcoApplication 启用；监控线程用编程式调度（间隔取
 * {@code aep.aiavatar.watchdog-interval-ms}，默认 1h，满足任务书「每一小时判断任务是否完成」要求）。
 */
@Configuration
@EnableAsync
public class AiAvatarAsyncConfig implements WebMvcConfigurer {

    private final AiAvatarProperties props;

    public AiAvatarAsyncConfig(AiAvatarProperties props) {
        this.props = props;
    }

    /** AiAvatar 生成任务线程池。 */
    @Bean(name = "aiAvatarJobExecutor")
    public Executor aiAvatarJobExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        int n = Math.max(1, props.getMaxConcurrent());
        exec.setCorePoolSize(n);
        exec.setMaxPoolSize(n);
        exec.setQueueCapacity(128);
        exec.setThreadNamePrefix("aiavatar-job-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(20);
        exec.initialize();
        return exec;
    }

    /** 监控线程专用单线程调度器（与生成线程池隔离，避免相互阻塞）。 */
    @Bean(name = "aiAvatarWatchdogScheduler")
    public ThreadPoolTaskScheduler aiAvatarWatchdogScheduler() {
        ThreadPoolTaskScheduler s = new ThreadPoolTaskScheduler();
        s.setPoolSize(1);
        s.setThreadNamePrefix("aiavatar-watchdog-");
        s.initialize();
        return s;
    }

    /**
     * 监控线程定时触发（任务书硬要求：每小时判断任务是否完成，异常中断则续跑）。
     * intervalMs <= 0 视为禁用。
     */
    @Bean
    public AiAvatarWatchdogTrigger aiAvatarWatchdogTrigger(AiAvatarJobWatchdog watchdog,
                                               ThreadPoolTaskScheduler aiAvatarWatchdogScheduler) {
        long interval = props.getWatchdogIntervalMs();
        if (interval > 0) {
            Instant first = Instant.now().plusMillis(Math.min(60_000L, interval));
            aiAvatarWatchdogScheduler.scheduleWithFixedDelay(
                    watchdog::sweep, first, Duration.ofMillis(Math.max(10_000L, interval)));
        }
        return new AiAvatarWatchdogTrigger();
    }

    /** 占位 bean，仅承载调度注册副作用。 */
    public static final class AiAvatarWatchdogTrigger {}

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        File dir = new File(props.getAssetDir());
        String abs = dir.getAbsolutePath();
        if (!abs.endsWith(File.separator)) abs = abs + File.separator;
        registry.addResourceHandler(props.getAssetPublicUrlBase() + "/**")
                .addResourceLocations("file:" + abs);
    }
}
