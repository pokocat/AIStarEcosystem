package com.aistareco.aep.config;

import com.aistareco.aep.service.cdn.LocalFakeCdnUploader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.net.URI;

/**
 * 当且仅当 LocalFakeCdnUploader 注入时（aep.cdn.driver=local），把它的 root 暴露成静态 HTTP。
 *
 * publicBase 支持三种形态：
 *   "/cdn"                              → 注册 /cdn/** 静态 handler（same-origin，Next rewrite 走）
 *   "http://localhost:8080/cdn"         → 提取 path=/cdn，仍然注册 /cdn/** 静态 handler
 *                                         （sau-service 独立进程，需要绝对 URL 才能 fetch；server 自己 serve）
 *   "https://cdn.aliyun.com/files"      → 也提取 path 注册 handler，但浏览器/sau 实际去 cdn.aliyun.com
 *                                         （多注册无害，prod 一般配 driver=oss 不会走到这里）
 *
 * 历史 bug：v0.14 实现假设 "绝对 URL 必由外部 nginx 直供"，跳过注册。但 sau-service 是
 * 独立进程必须绝对 URL，把 publicBase 设 http://localhost:8080/cdn 后 server 自己反而不 serve
 * 了，造成 sau 拉视频 404。
 */
@Configuration
@ConditionalOnBean(LocalFakeCdnUploader.class)
public class CdnWebConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CdnWebConfig.class);

    private final LocalFakeCdnUploader uploader;

    public CdnWebConfig(LocalFakeCdnUploader uploader) {
        this.uploader = uploader;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String base = uploader.getPublicBase();
        String pathPrefix = extractPathPrefix(base);
        if (pathPrefix == null || pathPrefix.isBlank()) {
            log.warn("[cdn] publicBase={} has no path component, skip static resource registration", base);
            return;
        }
        File root = uploader.getRoot().toFile();
        if (!root.exists()) root.mkdirs();
        String absPath = root.getAbsolutePath();
        if (!absPath.endsWith(File.separator)) absPath = absPath + File.separator;
        registry.addResourceHandler(pathPrefix + "/**")
                .addResourceLocations("file:" + absPath);
        log.info("[cdn] static handler registered {}/** → file:{} (publicBase={})", pathPrefix, absPath, base);
    }

    /** 从 "http://host:port/cdn" / "/cdn" / "https://x.com/files" 等提取 path 部分。 */
    private static String extractPathPrefix(String base) {
        if (base == null || base.isBlank()) return null;
        if (base.startsWith("/")) return stripTrail(base);
        try {
            URI uri = URI.create(base);
            String path = uri.getPath();
            if (path == null || path.isBlank() || "/".equals(path)) return null;
            return stripTrail(path);
        } catch (Exception e) {
            log.warn("[cdn] cannot parse publicBase={} as URI: {}", base, e.getMessage());
            return null;
        }
    }

    private static String stripTrail(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
