package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.aep.aiavatar.model.*;
import com.aistareco.aep.aiavatar.provider.CapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.AiAvatarProviderRegistry;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.provider.AssetSpec;
import com.aistareco.aep.aiavatar.repository.*;
import com.aistareco.aep.service.CreditService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * AiAvatar异步任务执行器（任务书 §5 Provider 运行 + §7 异步任务中心）。
 *
 * 职责：
 *  - {@code @Async} 在 aiAvatarJobExecutor 线程池执行任务；
 *  - 选 Provider → 构造 ctx（进度回调实时回写 DB heartbeat + tracker SSE）→ run；
 *  - 成功：落 AiAvatarAsset / 建 AiAvatarVersion / 推进 AiAvatar 状态机 / commit 积分；
 *  - 失败：记错误 + attempts++ / release 积分（保留行供监控线程 / 用户 retry）；
 *  - 可被 {@link AiAvatarJobWatchdog} 复用做「异常中断续跑」。
 *
 * 不在 Provider 长调用期间持有 DB 事务（每步独立 save），避免连接耗尽。
 */
@Component
public class AiAvatarJobRunner {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarJobRunner.class);

    private final AiAvatarJobRepository jobRepo;
    private final AiAvatarRepository avatarRepo;
    private final AiAvatarVersionRepository versionRepo;
    private final AiAvatarAssetRepository assetRepo;
    private final AiAvatarProviderRegistry registry;
    private final AiAvatarStorage storage;
    private final AiAvatarJobProgressTracker tracker;
    private final CreditService creditService;
    private final ObjectMapper mapper;
    private final AiAvatarProperties props;

    public AiAvatarJobRunner(AiAvatarJobRepository jobRepo, AiAvatarRepository avatarRepo,
                       AiAvatarVersionRepository versionRepo, AiAvatarAssetRepository assetRepo,
                       AiAvatarProviderRegistry registry, AiAvatarStorage storage,
                       AiAvatarJobProgressTracker tracker, CreditService creditService,
                       ObjectMapper mapper, AiAvatarProperties props) {
        this.jobRepo = jobRepo;
        this.avatarRepo = avatarRepo;
        this.versionRepo = versionRepo;
        this.assetRepo = assetRepo;
        this.registry = registry;
        this.storage = storage;
        this.tracker = tracker;
        this.creditService = creditService;
        this.mapper = mapper;
        this.props = props;
    }

    /** 异步入口：派发到线程池执行。 */
    @Async("aiAvatarJobExecutor")
    public void runAsync(String jobId) {
        try {
            execute(jobId);
        } catch (Exception e) {
            log.error("[aiavatar-job] uncaught error job={}: {}", jobId, e.getMessage(), e);
        }
    }

    /** 同步执行一个任务（监控线程续跑亦走此入口）。 */
    public void execute(String jobId) {
        AiAvatarJob job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[aiavatar-job] execute miss job={}", jobId);
            return;
        }
        if (job.getStatus() == AiAvatarJobStatus.SUCCEEDED || job.getStatus() == AiAvatarJobStatus.CANCELLED) {
            return; // 终态不重跑
        }

        job.setStatus(AiAvatarJobStatus.RUNNING);
        job.setAttempts(job.getAttempts() + 1);
        job.setStartedAt(job.getStartedAt() == null ? OffsetDateTime.now() : job.getStartedAt());
        job.setHeartbeatAt(OffsetDateTime.now());
        job.setProgress(Math.max(1, job.getProgress()));
        jobRepo.save(job);
        tracker.publish(jobId, job.getProgress(), "开始执行", "running");

        try {
            CapabilityProvider provider = registry.get(job.getCapability());
            job.setProviderMode(provider.mode());
            job.setEngine(provider.engine());
            jobRepo.save(job);

            JsonNode input = parseInput(job.getInputJson());

            AiAvatarJobContext ctx = new AiAvatarJobContext(
                    jobId, job.getOwnerUserId(), job.getAvatarId(),
                    job.getCapability(), provider.mode(), storage, mapper,
                    (pct, msg) -> onProgress(jobId, pct, msg),
                    () -> tracker.isCancelled(jobId)
            );

            ProviderResult result = provider.run(input, ctx);

            if (tracker.isCancelled(jobId)) {
                finishCancelled(job);
                return;
            }

            persistSuccess(job, provider, result);
        } catch (Exception e) {
            finishFailed(job, e);
        }
    }

    private void onProgress(String jobId, int pct, String msg) {
        // 心跳 + 进度回写（监控线程据 heartbeatAt 判活）
        AiAvatarJob j = jobRepo.findById(jobId).orElse(null);
        if (j != null && j.getStatus() == AiAvatarJobStatus.RUNNING) {
            j.setProgress(Math.max(1, Math.min(99, pct)));
            j.setHeartbeatAt(OffsetDateTime.now());
            jobRepo.save(j);
        }
        tracker.publish(jobId, pct, msg, "running");
    }

    private void persistSuccess(AiAvatarJob job, CapabilityProvider provider, ProviderResult result) {
        String avatarId = job.getAvatarId();
        List<String> assetIds = new ArrayList<>();
        String previewAssetId = null;

        // 1) 落资产
        if (result.assets() != null) {
            for (AssetSpec spec : result.assets()) {
                AiAvatarAsset a = AiAvatarAsset.builder()
                        .id(UUID.randomUUID().toString())
                        .avatarId(avatarId)
                        .ownerUserId(job.getOwnerUserId())
                        .kind(spec.kind())
                        .standardShot(spec.standardShot())
                        .fileUrl(spec.fileUrl())
                        .thumbnailUrl(spec.thumbnailUrl())
                        .mimeType(spec.mimeType())
                        .width(spec.width())
                        .height(spec.height())
                        .fileSize(spec.fileSize())
                        .durationSec(spec.durationSec())
                        .format3d(spec.format3d())
                        .engine(spec.engine() != null ? spec.engine() : provider.engine())
                        .providerMode(provider.mode())
                        .watermarkToken("aiavatar-" + job.getId().substring(0, Math.min(8, job.getId().length())))
                        .encrypted(false)
                        .metaJson(spec.metaJson())
                        .createdAt(OffsetDateTime.now())
                        .build();
                assetRepo.save(a);
                assetIds.add(a.getId());
                if (previewAssetId == null && isImage(spec.kind())) {
                    previewAssetId = a.getId();
                }
            }
        }
        if (previewAssetId == null && !assetIds.isEmpty()) {
            previewAssetId = assetIds.get(0);
        }

        // 2) 建版本快照（只对真实产出资产的 AI 动作生成 AvatarVersion）。
        // NLU / faceDetect 这类元数据任务不应覆盖 currentVersionId。
        String versionId = null;
        if (avatarId != null) {
            AiAvatar avatar = avatarRepo.findById(avatarId).orElse(null);
            if (avatar != null) {
                if (!assetIds.isEmpty()) {
                    int nextNo = versionRepo.findTopByAvatarIdOrderByVersionNoDesc(avatarId)
                            .map(v -> v.getVersionNo() + 1).orElse(1);
                    AiAvatarVersion ver = AiAvatarVersion.builder()
                            .id(UUID.randomUUID().toString())
                            .avatarId(avatarId)
                            .ownerUserId(job.getOwnerUserId())
                            .versionNo(nextNo)
                            .label(job.getTitle())
                            .note(job.getCapability().label())
                            .author(job.getOwnerUserId())
                            .sourceStatus(avatar.getStatus())
                            .paramsJson(job.getInputJson())
                            .previewAssetId(previewAssetId)
                            .assetIds(assetIds)
                            .jobId(job.getId())
                            .preferred(false)
                            .discarded(false)
                            .createdAt(OffsetDateTime.now())
                            .build();
                    versionRepo.save(ver);
                    versionId = ver.getId();

                    // 资产回填 versionId
                    for (String aid : assetIds) {
                        assetRepo.findById(aid).ifPresent(a -> { a.setVersionId(ver.getId()); assetRepo.save(a); });
                    }

                    // 3) 更新 avatar 当前版本 / 封面
                    avatar.setCurrentVersionId(ver.getId());
                    if (avatar.getCoverAssetId() == null && previewAssetId != null) {
                        avatar.setCoverAssetId(previewAssetId);
                    }
                }
                applyCapabilityFlags(avatar, job, result);
                applyStatusAdvance(avatar, job);
                avatar.setUpdatedAt(OffsetDateTime.now());
                avatarRepo.save(avatar);
            }
        }

        // 4) commit 积分
        if (job.getCreditsHeld() > 0) {
            try {
                creditService.commitHold("aiavatar_job", job.getId(), job.getCreditsHeld(),
                        "AiAvatar生成：" + job.getCapability().label());
            } catch (Exception e) {
                log.warn("[aiavatar-job] commit credit failed job={}: {}", job.getId(), e.getMessage());
            }
        }

        job.setStatus(AiAvatarJobStatus.SUCCEEDED);
        job.setProgress(100);
        job.setVersionId(versionId);
        job.setResultJson(buildResultJson(result, assetIds, versionId));
        job.setHeartbeatAt(OffsetDateTime.now());
        job.setCompletedAt(OffsetDateTime.now());
        job.setErrorMessage(null);
        jobRepo.save(job);
        tracker.publish(job.getId(), 100, "完成", "succeeded");
        tracker.complete(job.getId(), "succeeded");
        tracker.clearCancel(job.getId());
        log.info("[aiavatar-job] success job={} cap={} assets={}", job.getId(), job.getCapability().wire(), assetIds.size());
    }

    /** nlu 结果回写结构化人设；3D / 视频标记。 */
    private void applyCapabilityFlags(AiAvatar avatar, AiAvatarJob job, ProviderResult result) {
        switch (job.getCapability()) {
            case NLU -> {
                if (result.metaJson() != null) avatar.setPersonaStructuredJson(result.metaJson());
            }
            case IMG23D -> avatar.setHas3d(true);
            case IMG2VIDEO -> avatar.setHasVideo(true);
            default -> { /* no-op */ }
        }
    }

    /** 读取 input._advanceStatusTo，合法则推进 avatar 状态机（任务书 §3 显式状态机）。 */
    private void applyStatusAdvance(AiAvatar avatar, AiAvatarJob job) {
        JsonNode input = parseInput(job.getInputJson());
        if (input == null || !input.hasNonNull("_advanceStatusTo")) return;
        AiAvatarStatus target = AiAvatarStatus.fromWire(input.get("_advanceStatusTo").asText());
        if (avatar.getStatus().canTransitionTo(target)) {
            avatar.setStatus(target);
        } else {
            log.debug("[aiavatar-job] illegal status advance {} -> {} (avatar={}), skip",
                    avatar.getStatus(), target, avatar.getId());
        }
    }

    private void finishFailed(AiAvatarJob job, Exception e) {
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        job.setStatus(AiAvatarJobStatus.FAILED);
        job.setErrorMessage(clip(msg, 1000));
        job.setHeartbeatAt(OffsetDateTime.now());
        jobRepo.save(job);
        // 失败释放积分（下次 retry 重新 hold 由 watchdog/service 负责；这里简单释放本次 hold）
        if (job.getCreditsHeld() > 0) {
            try {
                creditService.releaseHold("aiavatar_job", job.getId(), "AiAvatar生成失败回滚");
                job.setCreditsHeld(0);
                jobRepo.save(job);
            } catch (Exception ignored) {}
        }
        tracker.publish(job.getId(), job.getProgress(), "失败：" + msg, "failed");
        tracker.complete(job.getId(), "failed");
        log.warn("[aiavatar-job] FAILED job={} cap={} attempts={} msg={}",
                job.getId(), job.getCapability().wire(), job.getAttempts(), msg);
    }

    private void finishCancelled(AiAvatarJob job) {
        job.setStatus(AiAvatarJobStatus.CANCELLED);
        job.setHeartbeatAt(OffsetDateTime.now());
        job.setCompletedAt(OffsetDateTime.now());
        jobRepo.save(job);
        if (job.getCreditsHeld() > 0) {
            try {
                creditService.releaseHold("aiavatar_job", job.getId(), "AiAvatar生成取消回滚");
                job.setCreditsHeld(0);
                jobRepo.save(job);
            } catch (Exception ignored) {}
        }
        tracker.complete(job.getId(), "cancelled");
        tracker.clearCancel(job.getId());
        log.info("[aiavatar-job] cancelled job={}", job.getId());
    }

    private JsonNode parseInput(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private String buildResultJson(ProviderResult result, List<String> assetIds, String versionId) {
        ObjectNode out = mapper.createObjectNode();
        JsonNode meta = result == null ? null : parseInput(result.metaJson());
        if (meta != null && meta.isObject()) {
            out.setAll((ObjectNode) meta);
        } else if (meta != null) {
            out.set("meta", meta);
        } else if (result != null && result.metaJson() != null && !result.metaJson().isBlank()) {
            out.put("meta", result.metaJson());
        }
        var arr = out.putArray("assetIds");
        for (String id : assetIds) arr.add(id);
        if (versionId != null) out.put("versionId", versionId);
        return out.toString();
    }

    private boolean isImage(AiAvatarAssetKind kind) {
        return kind == AiAvatarAssetKind.IMAGE_2D || kind == AiAvatarAssetKind.DRAFT_IMAGE
                || kind == AiAvatarAssetKind.EXPRESSION_IMAGE || kind == AiAvatarAssetKind.REFERENCE_IMAGE;
    }

    private static String clip(String s, int n) {
        if (s == null) return null;
        return s.length() <= n ? s : s.substring(0, n);
    }
}
