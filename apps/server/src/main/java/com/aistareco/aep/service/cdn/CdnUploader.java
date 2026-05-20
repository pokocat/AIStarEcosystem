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

    /** 驱动名标识（"local" / "oss" / ...），用于日志。 */
    String driverName();

    record CdnUploadResult(String cdnUrl, String key, long uploadedBytes, Instant uploadedAt) {}
}
