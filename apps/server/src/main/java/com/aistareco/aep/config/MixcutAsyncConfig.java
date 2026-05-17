package com.aistareco.aep.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.util.concurrent.Executor;

/**
 * Mixcut 渲染异步执行器 + 静态文件 serving。
 * /static/mixcut/** → 外部 output 目录（运行时生成的视频）。
 */
@Configuration
@EnableAsync
public class MixcutAsyncConfig implements WebMvcConfigurer {

    private final MixcutProperties props;

    public MixcutAsyncConfig(MixcutProperties props) {
        this.props = props;
    }

    @Bean(name = "mixcutExecutor")
    public Executor mixcutExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(Math.max(1, props.getMaxConcurrent()));
        exec.setMaxPoolSize(Math.max(1, props.getMaxConcurrent()));
        exec.setQueueCapacity(64);
        exec.setThreadNamePrefix("mixcut-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.initialize();
        return exec;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        File outDir = new File(props.getOutputDir());
        String absolute = outDir.getAbsolutePath();
        if (!absolute.endsWith(File.separator)) absolute = absolute + File.separator;
        // file:///.../mixcut-output/ → /static/mixcut/**
        registry.addResourceHandler(props.getPublicUrlBase() + "/**")
                .addResourceLocations("file:" + absolute);
    }
}
