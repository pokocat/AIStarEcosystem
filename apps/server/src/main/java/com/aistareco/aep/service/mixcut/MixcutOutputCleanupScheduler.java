package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * v0.21+: 混剪渲染产出物理清理调度器。
 *
 * 用户在前端「视频库」点删除会把 MixcutRenderOutput.deletedAt 置非空。本调度器每天 03:30
 * 扫一次，找出 deletedAt 超过 30 天的行，依次：
 *   1) 删本地 mp4 + 缩略图（{props.outputDir}/{jobId}/v{N}.mp4 等）
 *   2) 调 CdnUploader.delete(cdnKey) 删 CDN 对象（best-effort）
 *   3) 删 DB 行
 *
 * 失败只 log，不阻断后续条目；某条 IO 失败后 DB 行保留，下次重试。
 *
 * 单实例约束：@Scheduled 默认串行同 bean。多实例需 ShedLock。
 */
@Component
public class MixcutOutputCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(MixcutOutputCleanupScheduler.class);

    /** 软删保留期：30 天。 */
    private static final int RETENTION_DAYS = 30;

    private final MixcutRenderOutputRepository outputRepo;
    private final MixcutProperties props;
    private final CdnUploader cdnUploader; // optional：本地 dev 可能没有

    public MixcutOutputCleanupScheduler(
            MixcutRenderOutputRepository outputRepo,
            MixcutProperties props,
            @Autowired(required = false) CdnUploader cdnUploader
    ) {
        this.outputRepo = outputRepo;
        this.props = props;
        this.cdnUploader = cdnUploader;
    }

    // 每天 03:30 跑一次（生产低谷期）。
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpired() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(RETENTION_DAYS);
        List<MixcutRenderOutput> expired = outputRepo.findByDeletedAtIsNotNullAndDeletedAtBefore(cutoff);
        if (expired.isEmpty()) {
            log.info("[mixcut-cleanup] no expired outputs (cutoff={})", cutoff);
            return;
        }
        log.info("[mixcut-cleanup] purging {} expired outputs (cutoff={})", expired.size(), cutoff);

        int purgedFiles = 0;
        int purgedCdn = 0;
        int purgedRows = 0;
        for (MixcutRenderOutput o : expired) {
            String jobId = o.getJob() == null ? null : o.getJob().getId();
            // 1) 本地文件
            try {
                if (jobId != null && o.getFileUrl() != null) {
                    Path localMp4 = resolveLocalPath(jobId, o.getFileUrl());
                    if (localMp4 != null && Files.deleteIfExists(localMp4)) {
                        purgedFiles++;
                    }
                }
                if (jobId != null && o.getThumbnailUrl() != null) {
                    Path localThumb = resolveLocalPath(jobId, o.getThumbnailUrl());
                    if (localThumb != null) Files.deleteIfExists(localThumb);
                }
            } catch (Exception e) {
                log.warn("[mixcut-cleanup] local file delete failed for output {}: {}", o.getId(), e.getMessage());
            }
            // 2) CDN
            if (cdnUploader != null && o.getCdnKey() != null && !o.getCdnKey().isBlank()) {
                try {
                    cdnUploader.delete(o.getCdnKey());
                    purgedCdn++;
                } catch (Exception e) {
                    log.warn("[mixcut-cleanup] CDN delete failed for key={}: {}", o.getCdnKey(), e.getMessage());
                }
            }
            // 3) DB
            try {
                outputRepo.delete(o);
                purgedRows++;
            } catch (Exception e) {
                log.warn("[mixcut-cleanup] DB row delete failed for output {}: {}", o.getId(), e.getMessage());
            }
        }
        log.info("[mixcut-cleanup] done: files={} cdn={} rows={}", purgedFiles, purgedCdn, purgedRows);
    }

    /**
     * 从 fileUrl 还原本地文件路径。fileUrl 形如 "/static/mixcut/<jobId>/v0.mp4" 或
     * full URL。我们仅根据末段文件名 + jobId 拼到 {outputDir}/{jobId}/{filename}。
     */
    private Path resolveLocalPath(String jobId, String fileUrl) {
        try {
            String filename;
            if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
                filename = Paths.get(URI.create(fileUrl).getPath()).getFileName().toString();
            } else {
                filename = Paths.get(fileUrl).getFileName().toString();
            }
            if (filename == null || filename.isBlank()) return null;
            return new File(new File(props.getOutputDir(), jobId), filename).toPath();
        } catch (Exception e) {
            return null;
        }
    }
}
