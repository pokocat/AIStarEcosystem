package com.aistareco.aep.service.cdn;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;

/**
 * 阿里云 OSS 实现 stub。
 *
 * 启用：aep.cdn.driver=oss + aep.cdn.oss.{endpoint,bucket,access-key-id,access-key-secret,base-url}
 * 当前未实现，仅作 v0.16 候选占位 —— 调用时直接抛 UnsupportedOperationException。
 *
 * 集成步骤（v0.16）：
 *   1. pom.xml 加 aliyun-oss-sdk
 *   2. 注入 OSS client (com.aliyun.oss.OSSClientBuilder)
 *   3. upload → ossClient.putObject(bucket, key, file)
 *   4. delete → ossClient.deleteObject(bucket, key)
 *   5. publicUrlFor → baseUrl + "/" + key （bucket 配 public-read，CDN 域名走加速）
 */
@Component
@ConditionalOnProperty(name = "aep.cdn.driver", havingValue = "oss")
public class AliyunOssCdnUploader implements CdnUploader {

    private final String endpoint;
    private final String bucket;
    private final String baseUrl;

    public AliyunOssCdnUploader(
            @Value("${aep.cdn.oss.endpoint:}") String endpoint,
            @Value("${aep.cdn.oss.bucket:}") String bucket,
            @Value("${aep.cdn.oss.base-url:}") String baseUrl
    ) {
        this.endpoint = endpoint;
        this.bucket = bucket;
        this.baseUrl = baseUrl;
    }

    @Override
    public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
        throw new UnsupportedOperationException(
                "AliyunOssCdnUploader 未实现 (endpoint=" + endpoint + " bucket=" + bucket
                        + "). v0.16 候选；当前请用 aep.cdn.driver=local。");
    }

    @Override
    public void delete(String key) throws IOException {
        throw new UnsupportedOperationException("AliyunOssCdnUploader 未实现");
    }

    @Override
    public String publicUrlFor(String key) {
        if (baseUrl == null || baseUrl.isBlank()) return "/oss/" + key;
        return baseUrl.endsWith("/") ? baseUrl + key : baseUrl + "/" + key;
    }

    @Override
    public String driverName() {
        return "oss";
    }
}
