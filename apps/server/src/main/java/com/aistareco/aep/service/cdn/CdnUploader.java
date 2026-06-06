package com.aistareco.aep.service.cdn;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;

/**
 * 抽象 CDN 上传器。
 *
 *  - dev：注入 {@link LocalFakeCdnUploader}（默认；aep.cdn.driver=local）
 *  - prod：注入 AliyunOssCdnUploader 等（aep.cdn.driver=oss）
 *
 * 渲染器渲染完每个变体调一次 upload(localMp4, key)，写回 MixcutRenderOutput.cdnUrl。
 * 后续 publish-batch 直接拿 cdnUrl 喂给 PublishJob.videoUrl。
 */
public interface CdnUploader {

    /**
     * 上传 local 文件到 CDN，返回公开 URL。
     *
     * @param localFile   本地源文件（worker 渲染产出）
     * @param key         CDN object key，形如 "mixcut/<jobId>/v<N>.mp4"
     * @param contentType MIME（可 null，由实现决定是否需要）
     * @return            上传结果（含公开 URL + 字节数 + 时间）
     */
    CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException;

    /** 删除指定 key 的对象（best-effort，不抛出 NoSuchFile）。 */
    void delete(String key) throws IOException;

    /** 仅做 URL 拼接，不传文件（用于 thumbnail 等已知 key 的二次 URL 构造）。 */
    String publicUrlFor(String key);

    /**
     * v0.47+：生成限时签名 URL（防 OSS 流量盗刷）。
     *
     * <p>调用方传 key（与 {@link #publicUrlFor} 同语义），返回带时效的可访问 URL。
     * 默认实现回退到 {@link #publicUrlFor}（向后兼容；dev 本地驱动直接走 same-origin
     * 静态资源不需要签名）。生产驱动按 {@code aep.cdn.signed-url.strategy} 配置：
     * <ul>
     *   <li>{@code none}：返回明文 URL（不推荐生产用）</li>
     *   <li>{@code oss}：OSS SDK 生成 pre-signed URL（短时签名，绕 CDN 走 OSS endpoint）</li>
     *   <li>{@code cdn}：CDN URL 鉴权 Type A（走 CDN 节省带宽费；需先在阿里云 CDN 控制台配 PrivateKey）</li>
     * </ul>
     *
     * @param key         OSS object key（与 {@link #publicUrlFor} 同）
     * @param ttlSeconds  URL 有效秒数；&lt;=0 表示由实现使用默认 TTL（{@code aep.cdn.signed-url.ttl-seconds}）
     */
    default String signedUrlFor(String key, long ttlSeconds) {
        return publicUrlFor(key);
    }

    /**
     * 生成下载专用 URL。默认实现沿用播放 URL；支持响应头覆盖的实现应返回
     * {@code Content-Disposition: attachment} 的短时 URL。
     */
    default String downloadUrlFor(String key, String filename, long ttlSeconds) {
        return signedUrlFor(key, ttlSeconds);
    }

    /** 驱动名标识（"local" / "oss" / ...），用于日志。 */
    String driverName();

    record CdnUploadResult(String cdnUrl, String key, long uploadedBytes, Instant uploadedAt) {}
}
