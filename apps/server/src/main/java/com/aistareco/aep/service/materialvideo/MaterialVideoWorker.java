package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.cdn.CdnUploader;
import org.springframework.beans.factory.ObjectProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Locale;

/**
 * 带货视频生成 worker —— 提交视频大模型任务后服务端轮询直到出片 / 超时。
 *
 * 与 MixcutRenderingService 同惯例：独立 bean（避免 @Async 自调用失效），@Async 入口仅捕获异常 +
 * mark failed；进度更新走 load-mutate-save（仓库默认事务即提交，前端独立轮询可见）。
 *
 * 积分：成功 commit（已 hold 的 creditsHeld）/ 失败 release（不可变账本约束，CLAUDE.md §4.2）。
 */
@Service
public class MaterialVideoWorker {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoWorker.class);

    private final MaterialVideoJobRepository jobRepo;
    private final MaterialVideoModelClient modelClient;
    private final MaterialVideoProperties props;
    private final CreditService creditService;
    private final CdnUploader cdnUploader;
    private final HttpClient downloadHttp;

    public MaterialVideoWorker(MaterialVideoJobRepository jobRepo,
                               MaterialVideoModelClient modelClient,
                               MaterialVideoProperties props,
                               CreditService creditService,
                               ObjectProvider<CdnUploader> cdnUploaderProvider) {
        this.jobRepo = jobRepo;
        this.modelClient = modelClient;
        this.props = props;
        this.creditService = creditService;
        this.cdnUploader = cdnUploaderProvider.getIfAvailable();
        this.downloadHttp = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(Math.max(5, props.getHttpTimeoutSeconds())))
                .build();
        if (cdnUploader != null) {
            log.info("[material-video] CDN uploader injected: {}", cdnUploader.driverName());
        } else {
            log.warn("[material-video] no CdnUploader bean -> provider video URLs will be stored directly");
        }
    }

    @Async("materialVideoExecutor")
    public void generateAsync(String jobId) {
        log.info("[material-video] worker picked up job={} thread={}", jobId, Thread.currentThread().getName());
        MaterialVideoJob job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[material-video] job {} not found, skip", jobId);
            return;
        }
        if (isTerminal(job.getStatus())) {
            log.info("[material-video] job {} already terminal ({}), skip", jobId, job.getStatus());
            return;
        }
        try {
            runGeneration(job);
        } catch (Throwable t) {
            log.error("[material-video] job {} failed", jobId, t);
            String msg = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
            markFailed(jobId, msg);
            // 提交阶段（submit）抛错时积分已 hold 但 runGeneration 内部没机会 release；
            // 这里兜底退款。releaseHold 幂等：若内部失败路径已退过，这次是 no-op。
            releaseCredits(job, msg);
        }
    }

    private void runGeneration(MaterialVideoJob job) throws InterruptedException {
        String jobId = job.getId();
        updateStatus(jobId, "submitting", 5, null);

        MaterialVideoModelClient.SubmitResult submit =
                modelClient.submit(job.getPrompt(), job.getDurationSec(), job.getAspectRatio());
        markGenerating(jobId, submit.taskId(), submit.providerUsed(), submit.modelUsed());

        long start = System.currentTimeMillis();
        long maxWaitMs = props.getMaxWaitSeconds() * 1000L;
        long intervalMs = Math.max(2, props.getPollIntervalSeconds()) * 1000L;

        while (true) {
            Thread.sleep(intervalMs);
            long elapsed = System.currentTimeMillis() - start;

            MaterialVideoModelClient.PollResult poll = modelClient.poll(submit);
            if (poll.succeeded()) {
                if (poll.videoUrl() == null || poll.videoUrl().isBlank()) {
                    markFailed(jobId, "视频大模型返回成功但未给出成片 URL（taskId=" + submit.taskId() + "）");
                    releaseCredits(job, "视频生成无成片 URL");
                    return;
                }
                String videoUrl = poll.videoUrl();
                String thumbnailUrl = poll.thumbnailUrl();
                if (props.isUploadToCdn() && cdnUploader != null) {
                    try {
                        CdnMirrorResult mirror = mirrorToCdn(jobId, videoUrl, thumbnailUrl);
                        videoUrl = mirror.videoUrl();
                        thumbnailUrl = mirror.thumbnailUrl();
                    } catch (IOException | RuntimeException e) {
                        log.warn("[material-video] job {} CDN mirror failed (keeping provider URL): {}",
                                jobId, e.getMessage());
                    }
                }
                markSucceeded(jobId, videoUrl, thumbnailUrl);
                commitCredits(job);
                log.info("[material-video] job {} succeeded · url={}", jobId, videoUrl);
                return;
            }
            if (poll.failed()) {
                markFailed(jobId, "视频大模型返回失败（status=" + poll.rawStatus() + "，taskId=" + submit.taskId() + "）");
                releaseCredits(job, "视频生成失败");
                return;
            }
            // 仍在生成：按 elapsed/maxWait 估算进度（封顶 95%，留给出片那一刻置 100）。
            int pct = (int) Math.min(95, 10 + (elapsed * 85.0 / Math.max(1, maxWaitMs)));
            updateStatus(jobId, "generating", pct, null);

            if (elapsed >= maxWaitMs) {
                markFailed(jobId, "视频生成超时（已等待 " + props.getMaxWaitSeconds() + "s，taskId=" + submit.taskId() + "）");
                releaseCredits(job, "视频生成超时");
                return;
            }
        }
    }

    // ── 成片持久化 ──────────────────────────────────────────────────────────

    private CdnMirrorResult mirrorToCdn(String jobId, String videoUrl, String thumbnailUrl)
            throws IOException, InterruptedException {
        DownloadedMedia video = null;
        DownloadedMedia thumbnail = null;
        try {
            video = downloadMedia(videoUrl, "material-video-" + jobId, ".mp4", "video/mp4");
            String videoKey = "material-videos/" + jobId + "/video" + video.extension();
            var uploadedVideo = cdnUploader.upload(video.path(), videoKey, video.contentType());

            String finalThumbnailUrl = thumbnailUrl;
            if (thumbnailUrl != null && !thumbnailUrl.isBlank()) {
                try {
                    thumbnail = downloadMedia(thumbnailUrl, "material-video-thumb-" + jobId, ".jpg", "image/jpeg");
                    String thumbKey = "material-videos/" + jobId + "/thumbnail" + thumbnail.extension();
                    var uploadedThumb = cdnUploader.upload(thumbnail.path(), thumbKey, thumbnail.contentType());
                    finalThumbnailUrl = uploadedThumb.cdnUrl();
                } catch (IOException | RuntimeException e) {
                    log.warn("[material-video] job {} CDN thumbnail mirror failed (keeping provider thumbnail): {}",
                            jobId, e.getMessage());
                }
            }

            log.info("[material-video] job {} mirrored to CDN driver={} key={}",
                    jobId, cdnUploader.driverName(), uploadedVideo.key());
            return new CdnMirrorResult(uploadedVideo.cdnUrl(), finalThumbnailUrl);
        } finally {
            deleteTemp(video);
            deleteTemp(thumbnail);
        }
    }

    private DownloadedMedia downloadMedia(String url, String tmpPrefix, String defaultExtension, String defaultContentType)
            throws IOException, InterruptedException {
        URI uri = URI.create(url);
        Path tmp = Files.createTempFile(tmpPrefix + "-", defaultExtension);
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(Math.max(5, props.getDownloadTimeoutSeconds())))
                    .GET()
                    .build();
            HttpResponse<Path> resp = downloadHttp.send(req, HttpResponse.BodyHandlers.ofFile(tmp));
            int code = resp.statusCode();
            if (code < 200 || code >= 300) {
                throw new IOException("download HTTP " + code + " for " + url);
            }
            long size = Files.size(tmp);
            long max = props.getMaxDownloadBytes();
            if (max > 0 && size > max) {
                throw new IOException("downloaded file too large: " + size + " bytes > " + max);
            }
            String contentType = resp.headers().firstValue("content-type")
                    .map(MaterialVideoWorker::normalizeContentType)
                    .filter(s -> !s.isBlank())
                    .orElse(defaultContentType);
            String extension = extensionFor(uri, contentType, defaultExtension);
            return new DownloadedMedia(tmp, contentType, extension);
        } catch (IOException | InterruptedException | RuntimeException e) {
            try { Files.deleteIfExists(tmp); } catch (IOException ignore) { /* best-effort cleanup */ }
            throw e;
        }
    }

    private void deleteTemp(DownloadedMedia media) {
        if (media == null) return;
        try {
            Files.deleteIfExists(media.path());
        } catch (IOException e) {
            log.warn("[material-video] temp cleanup failed path={} err={}", media.path(), e.getMessage());
        }
    }

    // ── 状态更新（load-mutate-save；仓库默认事务即提交） ─────────────────────────

    private void updateStatus(String jobId, String status, int progress, String error) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus(status);
            j.setProgress(Math.max(0, Math.min(100, progress)));
            if (error != null) j.setErrorMessage(truncate(error, 1000));
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markGenerating(String jobId, String taskId, String provider, String model) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("generating");
            j.setProgress(Math.max(j.getProgress(), 10));
            j.setExternalTaskId(taskId);
            j.setProviderUsed(provider);
            j.setModelUsed(model);
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markSucceeded(String jobId, String videoUrl, String thumb) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("succeeded");
            j.setProgress(100);
            j.setVideoUrl(videoUrl);
            if (thumb != null) j.setThumbnailUrl(thumb);
            j.setErrorMessage(null);
            j.setCompletedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markFailed(String jobId, String message) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("failed");
            j.setErrorMessage(truncate(message, 1000));
            j.setCompletedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    // ── 积分 ────────────────────────────────────────────────────────────────

    private void commitCredits(MaterialVideoJob job) {
        if (job.getCreditsHeld() <= 0) return;
        try {
            creditService.commitHold(MaterialVideoJobService.CREDIT_REF_TYPE, job.getId(),
                    job.getCreditsHeld(), "带货视频生成 · " + safe(job.getName()));
        } catch (Exception e) {
            log.warn("[material-video] commit credits failed job={} err={}", job.getId(), e.getMessage());
        }
    }

    private void releaseCredits(MaterialVideoJob job, String reason) {
        if (job.getCreditsHeld() <= 0) return;
        try {
            creditService.releaseHold(MaterialVideoJobService.CREDIT_REF_TYPE, job.getId(),
                    "带货视频生成失败 · 退回积分 · " + truncate(reason, 200));
        } catch (Exception e) {
            log.warn("[material-video] release credits failed job={} err={}", job.getId(), e.getMessage());
        }
    }

    private static boolean isTerminal(String status) {
        return "succeeded".equals(status) || "failed".equals(status);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String safe(String s) {
        return (s == null || s.isBlank()) ? "视频" : s;
    }

    private static String normalizeContentType(String raw) {
        if (raw == null) return "";
        int semi = raw.indexOf(';');
        return (semi >= 0 ? raw.substring(0, semi) : raw).trim().toLowerCase(Locale.ROOT);
    }

    private static String extensionFor(URI uri, String contentType, String fallback) {
        String path = uri.getPath();
        if (path != null) {
            int slash = path.lastIndexOf('/');
            int dot = path.lastIndexOf('.');
            if (dot > slash && dot < path.length() - 1) {
                String ext = path.substring(dot).toLowerCase(Locale.ROOT);
                if (ext.matches("\\.[a-z0-9]{2,8}")) return ext;
            }
        }
        return switch (contentType == null ? "" : contentType) {
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            case "video/quicktime" -> ".mov";
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> fallback;
        };
    }

    private record DownloadedMedia(Path path, String contentType, String extension) {}

    private record CdnMirrorResult(String videoUrl, String thumbnailUrl) {}
}
