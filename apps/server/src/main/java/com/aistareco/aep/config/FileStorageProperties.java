package com.aistareco.aep.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * aep.storage.* —— 统一文件存储门面（{@code FileStorageService}）配置。
 *
 * <p>v0.49+：把全系统「上传 / 生成 / 大模型返回」的图片、视频、音频、模型等文件存储收口到
 * 一个服务。底层仍走 {@code CdnUploader}（local / oss driver）+ {@code CdnUrlSigner}（签名防盗刷），
 * 本类只配「本机临时 / 暂存目录」+「无 CDN 时的静态兜底 URL 前缀」+「签名 TTL」。
 */
@Configuration
@ConfigurationProperties(prefix = "aep.storage")
public class FileStorageProperties {

    /**
     * 本机暂存根目录。文件先落这里（ffmpeg / python 子进程可读 + 上传前 staging），再推 CDN。
     * 生产环境下若 {@code keep-local-copy=false}，上传成功后即删本地副本（§4.7「本机仅作短时临时区」）。
     */
    private String localDir = "./file-storage";

    /** 无 CDN（cdnUploader 缺失）时，本机文件对外暴露的静态 URL 前缀（由 FileStorageWebConfig 挂载）。 */
    private String publicUrlBase = "/static/files";

    /** 出 wire 的签名 URL 有效期（秒）。 */
    private long signedUrlTtlSeconds = 3600;

    /**
     * 上传 CDN 成功后是否保留本机副本。
     * - true（默认）：保留 —— 供 ffmpeg 等本地消费方 / file_url 兜底读取（如 mixcut 源素材渲染）。
     * - false：删本机（纯 OSS-read 链路；§4.7 终态）。各业务可按需在调用处覆盖。
     */
    private boolean keepLocalCopy = true;

    public String getLocalDir() { return localDir; }
    public void setLocalDir(String localDir) { this.localDir = localDir; }

    public String getPublicUrlBase() { return publicUrlBase; }
    public void setPublicUrlBase(String publicUrlBase) { this.publicUrlBase = publicUrlBase; }

    public long getSignedUrlTtlSeconds() { return signedUrlTtlSeconds; }
    public void setSignedUrlTtlSeconds(long signedUrlTtlSeconds) { this.signedUrlTtlSeconds = signedUrlTtlSeconds; }

    public boolean isKeepLocalCopy() { return keepLocalCopy; }
    public void setKeepLocalCopy(boolean keepLocalCopy) { this.keepLocalCopy = keepLocalCopy; }
}
