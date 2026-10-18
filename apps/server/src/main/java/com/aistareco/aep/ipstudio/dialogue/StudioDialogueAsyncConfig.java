package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.config.MdcTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Dialogue turn pool, separate from {@code ipRunExecutor}: a turn can wait minutes on a child analysis run, and must
 * never queue behind (or block) image and workflow runs.
 */
@Configuration
public class StudioDialogueAsyncConfig {
    @Bean(name = "studioDialogueExecutor")
    public ThreadPoolTaskExecutor studioDialogueExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(64);
        executor.setThreadNamePrefix("studio-dialogue-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }
}
