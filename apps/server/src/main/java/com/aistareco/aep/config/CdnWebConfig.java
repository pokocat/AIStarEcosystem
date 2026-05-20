package com.aistareco.aep.config;

import com.aistareco.aep.service.cdn.LocalFakeCdnUploader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

/**
 * 当且仅当 LocalFakeCdnUploader 注入时（aep.cdn.driver=local），把它的 root 暴露成静态 HTTP。
 *
 * dev：aep.cdn.public-base-url 默认 "/cdn"（相对路径），nginx / Next rewrite 直接走 same-origin。
 * prod：换 AliyunOssCdnUploader → 此 bean 不注入，资源由 OSS / CDN 直供。
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
        // 仅当 publicBase 是相对路径（"/cdn"）时挂静态。绝对 URL（http://cdn.x.com）由外部 nginx / OSS 直供。
        if (!base.startsWith("/")) {
            log.info("[cdn] publicBase={} is absolute, skip static resource registration", base);
            return;
        }
        File root = uploader.getRoot().toFile();
        if (!root.exists()) root.mkdirs();
        String absPath = root.getAbsolutePath();
        if (!absPath.endsWith(File.separator)) absPath = absPath + File.separator;
        registry.addResourceHandler(base + "/**")
                .addResourceLocations("file:" + absPath);
        log.info("[cdn] static handler registered {}/** → file:{}", base, absPath);
    }
}
