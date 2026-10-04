package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.http.HttpStatus;
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
    private static final ObjectMapper OM = new ObjectMapper();
    static final String RECOVERY_CREDIT_REF_TYPE = "material_video_job_recovery";
    /**
     * v0.198：任务要求「成片必须镜像到我方存储」（variant_config.require_mirror=true，画布视频提交时写）而镜像失败时，
     * errorMessage 以它开头。任务表没有错误码列，调用方据此前缀认出失败原因。
     */
    public static final String MIRROR_FAILED_CODE = "VIDEO_MIRROR_FAILED";

    private final MaterialVideoJobRepository jobRepo;
    private final MaterialVideoModelClient modelClient;
    private final MaterialVideoProperties props;
    private final CreditService creditService;
    private final CdnUploader cdnUploader;
    private final StorageQuotaService storage;
    private final MaterialVideoCover cover;
    private final HttpClient downloadHttp;

    public MaterialVideoWorker(MaterialVideoJobRepository jobRepo,
                               MaterialVideoModelClient modelClient,
                               MaterialVideoProperties props,
                               CreditService creditService,
                               StorageQuotaService storage,
                               ObjectProvider<CdnUploader> cdnUploaderProvider,
                               MaterialVideoCover cover) {
        this.jobRepo = jobRepo;
        this.modelClient = modelClient;
        this.props = props;
        this.creditService = creditService;
        this.storage = storage;
        this.cover = cover;
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

    /**
     * 对账恢复“上游已受理/成功、但本地轮询误判失败”的任务。只查询既有 externalTaskId，绝不重提。
     * 产物先镜像 OSS，再通过独立幂等 hold 真扣，最后把本地任务改为 succeeded。
     */
    public MaterialVideoJob reconcileSucceeded(String jobId) {
        MaterialVideoJob job = jobRepo.findById(jobId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "VIDEO_JOB_NOT_FOUND", "视频任务不存在"));
        if ("succeeded".equals(job.getStatus())) return job;
        if (job.getExternalTaskId() == null || job.getExternalTaskId().isBlank()) {
            throw new BusinessException(HttpStatus.CONFLICT, "VIDEO_JOB_NOT_SUBMITTED",
                    "该任务没有上游 Job ID，无法对账恢复");
        }

        String endpointId = extractEndpointId(job.getVariantConfigJson());
        MaterialVideoModelClient.SubmitResult submit = modelClient.resumeExistingTask(
                job.getExternalTaskId(), endpointId, job.getProviderUsed(), job.getModelUsed());
        MaterialVideoModelClient.PollResult poll = modelClient.poll(submit);
        if (!poll.succeeded()) {
            throw new BusinessException(HttpStatus.CONFLICT, "VIDEO_JOB_NOT_SUCCEEDED_UPSTREAM",
                    "上游任务当前不是成功状态（" + safe(poll.rawStatus()) + "），暂不能恢复");
        }
        boolean hasVideoUrl = poll.videoUrl() != null && !poll.videoUrl().isBlank();
        boolean hasProtectedAsset = poll.outputAssetId() != null && !poll.outputAssetId().isBlank();
        if (!hasVideoUrl && !hasProtectedAsset) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_OUTPUT_MISSING",
                    "上游任务已成功，但没有返回可读取的产物");
        }
        if (hasProtectedAsset && (!props.isUploadToCdn() || cdnUploader == null)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_CDN_NOT_CONFIGURED",
                    "上游产物需要鉴权读取，但当前未配置 OSS 镜像");
        }

        // 调用方自己定的价（视频生成区按清晰度 / 参考图张数、短剧按自己的单价）按冻结价结算 ——
        // 拿端点单价 × 秒数重算会把 544p 收成 768p 的价、把多参考图的加价丢掉。
        // 其余任务沿用 v0.131：按端点当前每秒价重算，那一版是为了补收计费规则上线前按每条 30 冻结的老任务。
        Long override = callerPriced(job) ? null : modelClient.resolveCreditCostOverride(endpointId, job.getDurationSec());
        long expectedCredits = override != null ? override : Math.max(0L, job.getCreditsHeld());
        CreditHold recoveryHold = null;
        if (billable(job.getOwnerUserId()) && expectedCredits > 0) {
            recoveryHold = creditService.findHold(RECOVERY_CREDIT_REF_TYPE, jobId);
            if (recoveryHold == null) {
                recoveryHold = creditService.hold(job.getOwnerUserId(), expectedCredits,
                        RECOVERY_CREDIT_REF_TYPE, jobId, "视频任务成功对账 · " + safe(job.getName()));
            }
            if (recoveryHold.getStatus() == CreditHold.Status.RELEASED) {
                throw new BusinessException(HttpStatus.CONFLICT, "VIDEO_RECOVERY_HOLD_RELEASED",
                        "该任务的恢复积分已释放，请人工复核后再处理");
            }
        }

        try {
            CdnMirrorResult mirror = mirrorToCdn(jobId, poll.videoUrl(), poll.thumbnailUrl(), poll.lastFrameUrl(),
                    submit, poll.outputAssetId());
            storage.record(appCodeOf(job), job.getOwnerUserId(), storageCategoryOf(job), job.getScriptId(),
                    mirror.videoKey(), mirror.videoBytes());
            if (recoveryHold != null && recoveryHold.getStatus() == CreditHold.Status.ACTIVE) {
                creditService.commitHold(RECOVERY_CREDIT_REF_TYPE, jobId, expectedCredits,
                        "视频生成成功对账 · " + safe(job.getName()));
            }
            job.setCreditsHeld(expectedCredits);
            jobRepo.save(job);
            markSucceeded(jobId, mirror.videoUrl(), mirror.thumbnailUrl(), poll.lastFrameUrl(), mirror.lastFrameKey());
            log.info("[material-video] reconciled succeeded job={} upstreamTask={} credits={}",
                    jobId, job.getExternalTaskId(), expectedCredits);
            return jobRepo.findById(jobId).orElse(job);
        } catch (IOException | InterruptedException | RuntimeException e) {
            if (recoveryHold != null && recoveryHold.getStatus() == CreditHold.Status.ACTIVE) {
                creditService.releaseHold(RECOVERY_CREDIT_REF_TYPE, jobId,
                        "视频任务恢复失败 · " + truncate(e.getMessage(), 160));
            }
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_RECOVERY_FAILED",
                    "视频产物恢复失败，请稍后重试");
        }
    }

    private void runGeneration(MaterialVideoJob job) throws InterruptedException {
        String jobId = job.getId();
        // v0.198 条件认领（queued → submitting，影响 1 行才继续）：与 MaterialVideoJobService.cancelQueued /
        // expireQueued 的条件更新互斥。以前是读出来再整行写回，排队中取消与 worker 接手撞在一起时，
        // 取消写的 failed 会被这里的 submitting 盖掉，任务照样交给厂商。
        if (jobRepo.claimQueued(jobId, OffsetDateTime.now()) != 1) {
            log.info("[material-video] job {} 已不在排队（取消 / 超时 / 已被接手），不提交", jobId);
            return;
        }

        // 用量归属：短剧分镜（kind=drama-*）记到 drama，其余（素材运营 / 视频生成区 / 画布）记到 celebrity。
        String appCode = appCodeOf(job);
        // D-11：短剧线可在 variant_config 指定候选出片端点；带货素材线不写此键 → null → 默认端点（默认路径不变）。
        String endpointId = extractEndpointId(job.getVariantConfigJson());
        // 输入规格只在这里解析一次（§8.0.1 ④）：画布出视频带首帧 key，视频生成区带完整的 H3 原生规格，
        // 带货 / 短剧线什么都不写 → EMPTY → 纯文生视频，行为不变。
        // v0.183 之前首帧根本没往下传，聚算那条链一律发 generationMode=t2v —— 用户接了参考图，
        // 出来的片跟参考图毫无关系。
        VideoGenSpec spec = VideoGenSpec.fromVariantConfigJson(job.getVariantConfigJson());
        MaterialVideoModelClient.SubmitResult submit =
                modelClient.submit(job.getPrompt(), job.getDurationSec(), job.getAspectRatio(),
                        job.getOwnerUserId(), appCode, endpointId, spec);
        markGenerating(jobId, submit.taskId(), submit.providerUsed(), submit.modelUsed());

        long start = System.currentTimeMillis();
        long maxWaitMs = props.getMaxWaitSeconds() * 1000L;
        long intervalMs = Math.max(2, props.getPollIntervalSeconds()) * 1000L;

        while (true) {
            Thread.sleep(intervalMs);
            long elapsed = System.currentTimeMillis() - start;

            MaterialVideoModelClient.PollResult poll = modelClient.poll(submit);
            if (poll.succeeded()) {
                boolean hasVideoUrl = poll.videoUrl() != null && !poll.videoUrl().isBlank();
                boolean hasProtectedAsset = poll.outputAssetId() != null && !poll.outputAssetId().isBlank();
                if (!hasVideoUrl && !hasProtectedAsset) {
                    // 任务号、上游状态只进日志；失败原因是给用户看的，不放内部字段（AGENTS.md §8 界面文案）
                    log.warn("[material-video] job {} upstream succeeded without output taskId={}", jobId, submit.taskId());
                    markFailed(jobId, "视频模型报告已完成，但没有交回成片");
                    releaseCredits(job, "视频生成无成片产物");
                    return;
                }
                String videoUrl = poll.videoUrl();
                String thumbnailUrl = poll.thumbnailUrl();
                String lastFrameUrl = poll.lastFrameUrl();
                String lastFrameCdnKey = null;
                if (hasProtectedAsset && (!props.isUploadToCdn() || cdnUploader == null)) {
                    log.error("[material-video] job {} protected output but OSS mirror disabled (uploadToCdn={} uploader={}) taskId={}",
                            jobId, props.isUploadToCdn(), cdnUploader != null, submit.taskId());
                    markFailed(jobId, "成片已经生成，但平台存储还没配置好，暂时取不回来，请联系运营");
                    releaseCredits(job, "视频产物镜像未配置");
                    return;
                }
                // v0.198：要求必须存进我方存储的任务（画布只存 key，厂商外链交付不了）—— 镜像不了就不交付、不扣费（§8.0）。
                // 不带这个标记的老任务行为不变（镜像失败保留厂商地址、照常结算）。
                boolean requireMirror = extractRequireMirror(job.getVariantConfigJson());
                if (requireMirror && (!props.isUploadToCdn() || cdnUploader == null)) {
                    log.warn("[material-video] job {} require_mirror 但没配置我方存储镜像，判失败并退回冻结", jobId);
                    markFailed(jobId, MIRROR_FAILED_CODE + "：视频生成好了，但当前没配置我方存储，没能存下来");
                    releaseCredits(job, "视频没存进我方存储");
                    return;
                }
                if (props.isUploadToCdn() && cdnUploader != null) {
                    try {
                        CdnMirrorResult mirror = mirrorToCdn(jobId, videoUrl, thumbnailUrl, lastFrameUrl,
                                submit, poll.outputAssetId());
                        videoUrl = mirror.videoUrl();
                        thumbnailUrl = mirror.thumbnailUrl();
                        lastFrameCdnKey = mirror.lastFrameKey();
                        // 成片落 CDN → 记入存储用量（按 job 归属子应用记账；best-effort 不阻断）。
                        // refId=scriptId：drama 即项目 id，项目彻底删除时由 StorageQuotaService.releaseByRef 释放。
                        storage.record(appCode, job.getOwnerUserId(), storageCategoryOf(job), job.getScriptId(),
                                mirror.videoKey(), mirror.videoBytes());
                    } catch (IOException | RuntimeException e) {
                        if (requireMirror) {
                            log.warn("[material-video] job {} require_mirror 镜像失败，判失败并退回冻结 taskId={} err={}",
                                    jobId, submit.taskId(), e.toString());
                            markFailed(jobId, MIRROR_FAILED_CODE + "：视频生成好了，但没能存进我方存储（"
                                    + truncate(e.getMessage(), 200) + "）");
                            releaseCredits(job, "视频没存进我方存储");
                            return;
                        }
                        log.warn("[material-video] job {} CDN mirror failed (keeping provider URL): {}",
                                jobId, e.getMessage());
                    }
                }
                markSucceeded(jobId, videoUrl, thumbnailUrl, lastFrameUrl, lastFrameCdnKey);
                commitCredits(job);
                log.info("[material-video] job {} succeeded · url={}", jobId, videoUrl);
                return;
            }
            if (poll.failed()) {
                String reason = poll.failReason() != null && !poll.failReason().isBlank()
                        ? "：" + poll.failReason() : "";
                log.warn("[material-video] job {} failed upstream status={} taskId={} reason={}",
                        jobId, poll.rawStatus(), submit.taskId(), poll.failReason());
                markFailed(jobId, reason.isEmpty() ? "视频生成失败，模型没有给出原因" : "视频生成失败" + reason);
                releaseCredits(job, "视频生成失败");
                return;
            }
            // 仍在生成：优先采用服务商返回的真实进度；没有则按 elapsed/maxWait 估算。
            // 封顶 95%，留给出片那一刻置 100。
            int estimatedPct = (int) Math.min(95, 10 + (elapsed * 85.0 / Math.max(1, maxWaitMs)));
            int pct = poll.progressPct() != null
                    ? Math.min(95, Math.max(10, poll.progressPct()))
                    : estimatedPct;
            updateStatus(jobId, "generating", pct, null);

            if (elapsed >= maxWaitMs) {
                log.warn("[material-video] job {} timed out after {}s taskId={}", jobId, props.getMaxWaitSeconds(), submit.taskId());
                markFailed(jobId, "视频生成超时，等了 " + Math.max(1, (props.getMaxWaitSeconds() + 59) / 60) + " 分钟还没有出结果");
                releaseCredits(job, "视频生成超时");
                return;
            }
        }
    }

    // ── 成片持久化 ──────────────────────────────────────────────────────────

    private CdnMirrorResult mirrorToCdn(String jobId, String videoUrl, String thumbnailUrl, String lastFrameUrl,
                                        MaterialVideoModelClient.SubmitResult submit, String outputAssetId)
            throws IOException, InterruptedException {
        DownloadedMedia video = null;
        DownloadedMedia thumbnail = null;
        DownloadedMedia lastFrame = null;
        try {
            video = outputAssetId != null && !outputAssetId.isBlank()
                    ? downloadProtectedOutput(submit, outputAssetId, "material-video-" + jobId)
                    : downloadMedia(videoUrl, "material-video-" + jobId, ".mp4", "video/mp4");
            String videoKey = "material-videos/" + jobId + "/video" + video.extension();
            var uploadedVideo = cdnUploader.upload(video.path(), videoKey, video.contentType());

            String finalThumbnailUrl = thumbnailUrl;
            boolean coverStored = false;
            if (thumbnailUrl != null && !thumbnailUrl.isBlank()) {
                try {
                    thumbnail = downloadMedia(thumbnailUrl, "material-video-thumb-" + jobId, ".jpg", "image/jpeg");
                    String thumbKey = "material-videos/" + jobId + "/thumbnail" + thumbnail.extension();
                    var uploadedThumb = cdnUploader.upload(thumbnail.path(), thumbKey, thumbnail.contentType());
                    finalThumbnailUrl = uploadedThumb.cdnUrl();
                    coverStored = true;
                } catch (IOException | RuntimeException e) {
                    log.warn("[material-video] job {} CDN thumbnail mirror failed (keeping provider thumbnail): {}",
                            jobId, e.getMessage());
                }
            }
            // v0.199.1：厂商没给封面（聚算 H3 一律不给）或封面没存下来 → 从刚下到本机的成片里截一帧。
            // best-effort，截不出来就照旧（没有封面 / 保留厂商地址），不影响出片与结算。
            if (!coverStored && cover != null) {
                String taken = cover.extractAndUpload(jobId, video.path());
                if (taken != null) finalThumbnailUrl = taken;
            }

            // C-1（一致性引擎）：把成片真实末帧镜像到 CDN（不过期），落 lastFrameCdnKey 作真值供跨镜链式承接。
            // best-effort（观测/承接类旁路，§8.0 例外）：镜像失败仅 WARN、返回 null key，绝不 markFailed —— 视频已成功出片，
            // 缺末帧只是退化为「无末帧承接」，下游读上游临时 lastFrameUrl 兜底。
            String lastFrameKey = null;
            if (lastFrameUrl != null && !lastFrameUrl.isBlank()) {
                try {
                    lastFrame = downloadMedia(lastFrameUrl, "material-video-lastframe-" + jobId, ".png", "image/png");
                    String lastFrameKeyPath = "material-videos/" + jobId + "/last-frame" + lastFrame.extension();
                    var uploadedLastFrame = cdnUploader.upload(lastFrame.path(), lastFrameKeyPath, lastFrame.contentType());
                    lastFrameKey = uploadedLastFrame.key();
                } catch (IOException | RuntimeException e) {
                    log.warn("[material-video] job {} last-frame CDN mirror failed (keeping provider URL): {}",
                            jobId, e.getMessage());
                }
            }

            log.info("[material-video] job {} mirrored to CDN driver={} key={}",
                    jobId, cdnUploader.driverName(), uploadedVideo.key());
            return new CdnMirrorResult(uploadedVideo.cdnUrl(), finalThumbnailUrl,
                    uploadedVideo.key(), uploadedVideo.uploadedBytes(), lastFrameKey);
        } finally {
            deleteTemp(video);
            deleteTemp(thumbnail);
            deleteTemp(lastFrame);
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

    private DownloadedMedia downloadProtectedOutput(MaterialVideoModelClient.SubmitResult submit, String assetId,
                                                      String tmpPrefix)
            throws IOException, InterruptedException {
        Path tmp = Files.createTempFile(tmpPrefix + "-", ".mp4");
        try {
            HttpResponse<Path> resp = modelClient.downloadOutputAsset(submit, assetId, tmp);
            int code = resp.statusCode();
            if (code < 200 || code >= 300) {
                throw new IOException("protected asset download HTTP " + code);
            }
            long size = Files.size(tmp);
            long max = props.getMaxDownloadBytes();
            if (max > 0 && size > max) {
                throw new IOException("downloaded file too large: " + size + " bytes > " + max);
            }
            String contentType = resp.headers().firstValue("content-type")
                    .map(MaterialVideoWorker::normalizeContentType)
                    .filter(s -> !s.isBlank())
                    .orElse("video/mp4");
            return new DownloadedMedia(tmp, contentType, extensionFor(URI.create("https://asset.invalid/output"),
                    contentType, ".mp4"));
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

    private void markSucceeded(String jobId, String videoUrl, String thumb, String lastFrameUrl, String lastFrameCdnKey) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("succeeded");
            j.setProgress(100);
            j.setVideoUrl(videoUrl);
            if (thumb != null) j.setThumbnailUrl(thumb);
            // v0.97 P2：成片真实末帧（seedance return_last_frame）→ 下一镜首帧参考，链式承接。
            if (lastFrameUrl != null && !lastFrameUrl.isBlank()) j.setLastFrameUrl(lastFrameUrl);
            // C-1：末帧 CDN 镜像真值（key，不过期）；镜像失败为 null → 出 wire fallback lastFrameUrl。
            if (lastFrameCdnKey != null && !lastFrameCdnKey.isBlank()) j.setLastFrameCdnKey(lastFrameCdnKey);
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
                    job.getCreditsHeld(), creditLabelOf(job) + " · " + safe(job.getName()));
        } catch (Exception e) {
            log.warn("[material-video] commit credits failed job={} err={}", job.getId(), e.getMessage());
        }
    }

    private void releaseCredits(MaterialVideoJob job, String reason) {
        if (job.getCreditsHeld() <= 0) return;
        try {
            creditService.releaseHold(MaterialVideoJobService.CREDIT_REF_TYPE, job.getId(),
                    creditLabelOf(job) + "失败 · 退回积分 · " + truncate(reason, 200));
        } catch (Exception e) {
            log.warn("[material-video] release credits failed job={} err={}", job.getId(), e.getMessage());
        }
    }

    /**
     * 账本文案用提交时的 {@code credit_label}（冻结那一笔也是用它写的，扣 / 退要对得上）。
     * 此前这里写死「带货视频生成」，短剧分镜和视频生成区的账单都显示成了带货。
     */
    static String creditLabelOf(MaterialVideoJob job) {
        String payload = job.getPayloadJson();
        if (payload != null && !payload.isBlank()) {
            try {
                String label = OM.readTree(payload).path(MaterialVideoJobService.PAYLOAD_CREDIT_LABEL).asText("");
                if (!label.isBlank()) return label;
            } catch (Exception ignore) {
                // payload 读不出来：退回默认文案，不影响扣 / 退本身
            }
        }
        return MaterialVideoJobService.DEFAULT_CREDIT_LABEL;
    }

    /** 用量归属子应用：短剧（kind=drama-*）记 drama，其余记 celebrity。 */
    static String appCodeOf(MaterialVideoJob job) {
        return job.getKind() != null && job.getKind().startsWith("drama") ? "drama" : "celebrity";
    }

    /** 存储用量里的分类名：短剧「分镜视频」、视频生成区（kind=studio-*）「视频生成」、其余「素材视频」。 */
    static String storageCategoryOf(MaterialVideoJob job) {
        String kind = job.getKind() == null ? "" : job.getKind();
        if (kind.startsWith("drama")) return "分镜视频";
        if (kind.startsWith("studio-")) return "视频生成";
        return "素材视频";
    }

    private static boolean isTerminal(String status) {
        return "succeeded".equals(status) || "failed".equals(status);
    }

    /** 提交时单价是否由调用方算好（见 {@link MaterialVideoJobService#PAYLOAD_CALLER_PRICED}）；读不出 = 否（老任务照旧）。 */
    static boolean callerPriced(MaterialVideoJob job) {
        String payload = job.getPayloadJson();
        if (payload == null || payload.isBlank()) return false;
        try {
            return OM.readTree(payload).path(MaterialVideoJobService.PAYLOAD_CALLER_PRICED).asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }

    /** v0.198：variant_config.require_mirror=true → 成片必须镜像到我方存储，否则判失败退款；缺省 / 解析失败 → false。 */
    static boolean extractRequireMirror(String variantConfigJson) {
        if (variantConfigJson == null || variantConfigJson.isBlank()) return false;
        try {
            return OM.readTree(variantConfigJson).path("require_mirror").asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }

    /** D-11：从 variant_config JSON 抽 endpoint_id（短剧线指定出片端点）；缺省/解析失败 → null（默认端点）。 */
    private static String extractEndpointId(String variantConfigJson) {
        if (variantConfigJson == null || variantConfigJson.isBlank()) return null;
        try {
            JsonNode vc = OM.readTree(variantConfigJson);
            JsonNode ep = vc.get("endpoint_id");
            return ep == null || ep.isNull() || ep.asText().isBlank() ? null : ep.asText();
        } catch (Exception e) {
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String safe(String s) {
        return (s == null || s.isBlank()) ? "视频" : s;
    }

    private static boolean billable(String userId) {
        return userId != null && !userId.isBlank() && !"anonymous".equals(userId);
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

    private record CdnMirrorResult(String videoUrl, String thumbnailUrl, String videoKey, long videoBytes,
                                   String lastFrameKey) {}
}
