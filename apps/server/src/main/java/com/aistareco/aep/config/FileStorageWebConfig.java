package com.aistareco.aep.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

/**
 * 把 {@link FileStorageProperties#getLocalDir()} 暴露成静态 HTTP（默认 {@code /static/files/**}）。
 *
 * <p>主要给「无 CDN driver」或上传 CDN 失败后回退本机 URL 的场景兜底；配了 oss / local-fake 时
 * 文件经 OSS / {@code /cdn} 提供，这个映射作为 fallback 也无害。
 */
@Configuration
public class FileStorageWebConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(FileStorageWebConfig.class);

    private final FileStorageProperties props;

    public FileStorageWebConfig(FileStorageProperties props) {
        this.props = props;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String base = props.getPublicUrlBase();
        if (base == null || base.isBlank()) return;
        // 仅取 path 部分（与 CdnWebConfig 同款容错；绝对 URL 也注册本地 handler）
        String path = base;
        int schemeIdx = path.indexOf("://");
        if (schemeIdx >= 0) {
            int slash = path.indexOf('/', schemeIdx + 3);
            path = slash >= 0 ? path.substring(slash) : "/";
        }
        if (!path.startsWith("/")) path = "/" + path;
        String pattern = path.endsWith("/") ? path + "**" : path + "/**";
        File root = new File(props.getLocalDir());
        String location = root.toURI().toString();
        if (!location.endsWith("/")) location = location + "/";
        registry.addResourceHandler(pattern).addResourceLocations(location);
        log.info("[file-storage] static mount {} -> {}", pattern, location);
    }
}
