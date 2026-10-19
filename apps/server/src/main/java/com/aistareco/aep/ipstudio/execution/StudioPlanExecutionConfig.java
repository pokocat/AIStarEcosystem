package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.config.MdcTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/** Own pool for plan advancement: orchestration waits on native submits and must not queue behind generation workers. */
@Configuration
public class StudioPlanExecutionConfig {
    @Bean(name="studioPlanExecutionPool")
    public ThreadPoolTaskExecutor studioPlanExecutionPool() {
        ThreadPoolTaskExecutor executor=new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(256);
        executor.setThreadNamePrefix("studio-plan-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }
}
