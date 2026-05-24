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
    private final PicgenProperties picgen;

    public MixcutAsyncConfig(MixcutProperties props, PicgenProperties picgen) {
        this.props = props;
        this.picgen = picgen;
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
        // 透传父线程 MDC（含 traceId）到渲染 worker，使 mixcut-* 线程 log 行可与入站请求 grep 串联
        exec.setTaskDecorator(new MdcTaskDecorator());
        exec.initialize();
        return exec;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 渲染产出：file:///.../mixcut-output/ → /static/mixcut/**
        File outDir = new File(props.getOutputDir());
        String outAbs = outDir.getAbsolutePath();
        if (!outAbs.endsWith(File.separator)) outAbs = outAbs + File.separator;
        registry.addResourceHandler(props.getPublicUrlBase() + "/**")
                .addResourceLocations("file:" + outAbs);

        // 用户上传素材：file:///.../mixcut-assets/ → /static/mixcut-assets/**
        File assetDir = new File(props.getAssetDir());
        String assetAbs = assetDir.getAbsolutePath();
        if (!assetAbs.endsWith(File.separator)) assetAbs = assetAbs + File.separator;
        registry.addResourceHandler(props.getAssetPublicUrlBase() + "/**")
                .addResourceLocations("file:" + assetAbs);

        // v0.16+: pic-gen 预览图 → /static/picgen-preview/**
        File previewDir = new File(picgen.getPreviewDir());
        String previewAbs = previewDir.getAbsolutePath();
        if (!previewAbs.endsWith(File.separator)) previewAbs = previewAbs + File.separator;
        registry.addResourceHandler(picgen.getPreviewPublicUrlBase() + "/**")
                .addResourceLocations("file:" + previewAbs);
    }
}
