package com.aistareco.aep.service;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.PublishJobCallbackDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobEvent;
import com.aistareco.aep.model.PublishJobStatus;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.SocialAccount;
import com.aistareco.aep.model.SocialAccountStatus;
import com.aistareco.aep.model.SocialPlatform;
import com.aistareco.aep.repository.PublishJobEventRepository;
import com.aistareco.aep.repository.PublishJobRepository;
import com.aistareco.aep.repository.SocialAccountRepository;
import com.aistareco.common.BusinessException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 发布任务编排。
 *
 * 关键事务：
 *   - createBatch     : 仅插入 queued 行，**不扣费**
 *   - startJob        : 先校验账号 cookie；通过后 queued → uploading 并扣费；调 sau-service /upload
 *   - applyCallback   : sau-service → server 进度推送；幂等 (按 externalTaskId)
 *   - cancel / retry  : 终态约束 + 不退款
 *   - resumeInflight  : @PostConstruct 启动时扫所有 in-progress 状态，逐条调 sau /tasks/{id}
 *
 * 扣费走 CreditService.debit(userId, cost, "publish_job_upload", jobId, desc)。
 */
@Service
public class PublishJobService {

    private static final Logger log = LoggerFactory.getLogger(PublishJobService.class);

    /**
     * v0.22 起，createBatch 接到 null/blank/旧 "manual" 占位 projectId 时自动兜底。
     * 格式与 MixcutPublishService 对齐：`manual-batch-<userId>-<yyyyMMddHHmmss>`（Asia/Shanghai）。
     * 让分发中心「任务追踪」按 projectId 聚合时，手动分发的每次提交各成一批，
     * 不会全挤进唯一的 "manual" 桶里。
     */
    private static final DateTimeFormatter MANUAL_PROJECT_SUFFIX_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Asia/Shanghai"));

    private final PublishJobRepository jobRepo;
    private final PublishJobEventRepository eventRepo;
    private final SocialAccountRepository accountRepo;
    private final SocialAccountSecretService secret;
    private final SauServiceClient sau;
    private final CreditService creditService;
    private final CelebrityActionPricingService actionPricing;
    private final String internalSecret;
    private final String selfBaseUrl;
    private final long defaultUploadCost;

    public PublishJobService(PublishJobRepository jobRepo,
                              PublishJobEventRepository eventRepo,
                              SocialAccountRepository accountRepo,
                              SocialAccountSecretService secret,
                              SauServiceClient sau,
                              CreditService creditService,
                              CelebrityActionPricingService actionPricing,
                              @Value("${aep.internal.secret:aep-dev-internal-secret-change-in-prod}") String internalSecret,
                              @Value("${sau.callback-base-url:http://localhost:8080/api/internal/sau}") String selfBaseUrl,
                              @Value("${sau.default-upload-cost:20}") long defaultUploadCost) {
        this.jobRepo = jobRepo;
        this.eventRepo = eventRepo;
        this.accountRepo = accountRepo;
        this.secret = secret;
        this.sau = sau;
        this.creditService = creditService;
        this.actionPricing = actionPricing;
        this.internalSecret = internalSecret;
        this.selfBaseUrl = selfBaseUrl;
        this.defaultUploadCost = defaultUploadCost;
    }

    /**
     * 单任务上传扣点。
     * v0.35：优先 CelebrityActionPricingService action="publish.upload"；
     *        缺失则回退到 application.yml {@code sau.default-upload-cost}。
     */
    private long currentUploadCost() {
        Long fromAction = actionPricing.creditPriceOf(
                CelebrityActionPricingService.ACTION_PUBLISH_UPLOAD);
        if (fromAction != null && fromAction > 0) return fromAction;
        return defaultUploadCost;
    }

    // ── list / get ──────────────────────────────────────────────────────

    public List<PublishJobDto> listForUser(String userId, String projectId, String statusWire) {
        List<PublishJob> rows;
        if (projectId != null && !projectId.isBlank()) {
            rows = jobRepo.findByUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId);
        } else if (statusWire != null && !statusWire.isBlank()) {
            PublishJobStatus st = PublishJobStatus.fromWire(statusWire);
            if (st == null) throw BusinessException.badRequest("STATUS_INVALID", "未知 status=" + statusWire);
            rows = jobRepo.findByUserIdAndStatusOrderByCreatedAtDesc(userId, st);
        } else {
            rows = jobRepo.findByUserIdOrderByCreatedAtDesc(userId);
        }
        return rows.stream().map(PublishJobDto::from).toList();
    }

    public PublishJobDto get(String userId, String jobId) {
        return PublishJobDto.from(jobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在")));
    }

    /** Admin 视图：跨用户列出发布任务，可选 status 过滤。 */
    public List<PublishJobDto> listAll(String statusWire) {
        List<PublishJob> rows;
        if (statusWire != null && !statusWire.isBlank()) {
            PublishJobStatus st = PublishJobStatus.fromWire(statusWire);
            if (st == null) throw BusinessException.badRequest("STATUS_INVALID", "未知 status=" + statusWire);
            rows = jobRepo.findAll().stream().filter(j -> j.getStatus() == st).toList();
        } else {
            rows = jobRepo.findAll();
        }
        return rows.stream()
                .sorted((a, b) -> {
                    Instant ca = a.getCreatedAt(), cb = b.getCreatedAt();
                    if (ca == null && cb == null) return 0;
                    if (ca == null) return 1;
                    if (cb == null) return -1;
                    return cb.compareTo(ca);
                })
                .map(PublishJobDto::from)
                .toList();
    }

    /** Admin 视图：取任务事件流（PublishJobEvent 已按 at 升序）。 */
    public List<com.aistareco.aep.dto.PublishJobEventDto> listEvents(String jobId) {
        if (!jobRepo.findById(jobId).isPresent()) {
            throw BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在");
        }
        return eventRepo.findByJobIdOrderByAtAsc(jobId).stream()
                .map(com.aistareco.aep.dto.PublishJobEventDto::from)
                .toList();
    }

    // ── create batch (queued only, no charge) ───────────────────────────

    @Transactional
    public List<PublishJobDto> createBatch(String userId, CreatePublishJobInputDto input) {
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "未登录");
        }
        if (input == null || input.videoUrl() == null
                || input.title() == null || input.targets() == null || input.targets().isEmpty()) {
            throw BusinessException.badRequest("INPUT_INCOMPLETE",
                    "缺少必要字段 (videoUrl / title / targets)");
        }
        // v0.22: projectId 兜底。null / blank / 旧 "manual" 占位 → 自动 stamp 一个唯一 batch id。
        // 这是手动分发场景：ManualDistributeDialog 现在不送 projectId，靠这里生成；
        // 历史代码硬编 "manual" 也走这条路径自动迁移到唯一桶。
        String projectId = input.projectId();
        if (projectId == null || projectId.isBlank() || "manual".equals(projectId)) {
            projectId = "manual-batch-" + userId + "-"
                    + MANUAL_PROJECT_SUFFIX_FORMAT.format(Instant.now());
        }
        List<PublishJob> created = new ArrayList<>();
        for (CreatePublishJobInputDto.Target t : input.targets()) {
            SocialPlatform platform = SocialPlatform.fromWire(t.platform());
            if (platform == null) {
                throw BusinessException.badRequest("PLATFORM_INVALID", "未知 platform=" + t.platform());
            }
            if (!platform.enabledInV1()) {
                throw new BusinessException(HttpStatus.NOT_IMPLEMENTED, "PLATFORM_NOT_IMPLEMENTED",
                        "v1 暂未实现 platform=" + platform.wire());
            }
            SocialAccount account = accountRepo.findByIdAndUserId(t.socialAccountId(), userId)
                    .orElseThrow(() -> BusinessException.notFound("SOCIAL_ACCOUNT_NOT_FOUND",
                            "社交账号不存在或不属当前用户: " + t.socialAccountId()));
            if (account.getPlatform() != platform) {
                throw BusinessException.badRequest("ACCOUNT_PLATFORM_MISMATCH",
                        "账号 " + account.getAccountName() + " 平台为 " + account.getPlatform().wire()
                                + "，与 targets[].platform=" + platform.wire() + " 不一致");
            }

            // scheduledAt 语义：null = 立即派单。但 PublishJobScheduler 用 SQL
            //   findByStatusAndScheduledAtLessThanEqual(QUEUED, now)
            // 来挑可启动的任务，`NULL <= now` 在 SQL 里返回 unknown 不匹配 — 历史 bug：
            // "立即派单"创建的任务因为 scheduledAt=null 永远不会被自动启动，用户必须手动点开始。
            // 修复：null 入库前替换为 Instant.now()，让 scheduler 下一轮 tick 立刻拿到。
            Instant effectiveScheduledAt = t.scheduledAt() != null ? t.scheduledAt() : Instant.now();
            PublishJob job = PublishJob.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(userId)
                    .projectId(projectId)
                    .socialAccountId(account.getId())
                    .platform(platform)
                    .platformId(platform.wire())
                    .platformName(platform.wire())
                    .status(PublishJobStatus.QUEUED)
                    .progress(0)
                    .videoUrl(input.videoUrl())
                    .title(input.title())
                    .description(input.description())
                    .tags(input.tags() != null ? input.tags() : List.of())
                    .coverUrl(input.coverUrl())
                    .productLink(input.productLink())
                    .productTitle(input.productTitle())
                    .scheduledAt(effectiveScheduledAt)
                    .build();
            jobRepo.save(job);
            writeEvent(job.getId(), "transition", null, PublishJobStatus.QUEUED, 0, "queued");
            created.add(job);
        }
        log.info("[publish] batch queued user={} projectId={} jobs={} targets={} titleLength={} hasProduct={}",
                userId, projectId, created.size(), input.targets().size(),
                input.title() == null ? 0 : input.title().length(),
                input.productLink() != null && !input.productLink().isBlank());
        return created.stream().map(PublishJobDto::from).toList();
    }

    // ── start (charge + dispatch) ───────────────────────────────────────

    @Transactional
    public PublishJobDto startJob(String userId, String jobId) {
        PublishJob job = jobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
        log.info("[publish] start requested user={} jobId={} status={} platform={} accountId={}",
                userId, jobId, job.getStatus().wire(), platformWire(job), job.getSocialAccountId());
        if (job.getStatus() != PublishJobStatus.QUEUED) {
            throw new BusinessException(HttpStatus.CONFLICT, "JOB_NOT_QUEUED",
                    "仅 queued 任务可启动，当前 status=" + job.getStatus().wire());
        }
        SocialAccount account = accountRepo.findByIdAndUserId(job.getSocialAccountId(), userId).orElse(null);
        if (account == null) {
            failBeforeDispatch(job, null, "SOCIAL_ACCOUNT_NOT_FOUND", "社交账号不存在 (可能已解绑)");
            return PublishJobDto.from(job);
        }
        if (account.getStatus() != SocialAccountStatus.ACTIVE
                || account.getStorageStateEncrypted() == null) {
            failBeforeDispatch(job, account, "ACCOUNT_NOT_ACTIVE",
                    "社交账号不可用 (status=" + account.getStatus().wire() + ")");
            return PublishJobDto.from(job);
        }

        Map<String, Object> storageState;
        try {
            // 解密 storage_state — 仅本方法局部变量持有明文
            storageState = secret.decryptStorageState(account.getStorageStateEncrypted());
        } catch (Exception e) {
            failBeforeDispatch(job, account, "ACCOUNT_STATE_DECRYPT_FAILED",
                    "账号凭据解密失败，请重新绑定账号");
            return PublishJobDto.from(job);
        }

        if (!verifyAccountBeforeCharge(job, account, storageState)) {
            return PublishJobDto.from(job);
        }

        long cost = currentUploadCost();
        // v0.33+: hold 替代 debit。任务终态 LIVE → commit；FAILED / CANCELLED → release。
        // v0.35+: cost 来源走 CelebrityActionPricingService（action="publish.upload"），fallback 旧 default。
        // 402 PAYMENT_REQUIRED 时事务回滚，任务保持 queued。
        creditService.hold(userId, cost, "publish_job_upload", job.getId(),
                "发布任务上传 - " + account.getPlatform().wire() + " - " + job.getTitle());
        job.setCreditsSpent(cost);

        // 翻 UPLOADING 先落库 (拿 externalTaskId 后再保存一次)
        PublishJobStatus from = job.getStatus();
        job.setStatus(PublishJobStatus.UPLOADING);
        job.setProgress(0);
        jobRepo.save(job);
        writeEvent(job.getId(), "transition", from, PublishJobStatus.UPLOADING, 0, "credit:-" + cost);

        // 把 videoUrl 标准化为绝对 URL —— sau-service 是独立进程，httpx 拒绝相对路径。
        // 历史脏数据（v0.15-v0.17 间用 publicBase=/cdn 落的 publish_job.video_url）也能跑通。
        // 优先级：已是绝对（http/https）→ 直接用；以 / 开头 → 拼当前 server origin。
        String absoluteVideoUrl = toAbsoluteUrl(job.getVideoUrl());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("platform", account.getPlatform().wire());
        body.put("accountName", account.getAccountName());
        body.put("videoUrl", absoluteVideoUrl);
        body.put("title", job.getTitle());
        body.put("description", job.getDescription());
        body.put("tags", job.getTags() != null ? job.getTags() : List.of());
        if (job.getCoverUrl() != null) body.put("coverUrl", job.getCoverUrl());
        // 抖音商品挂载 — 仅 douyin 平台消费这俩字段；其它平台 sau-service 忽略。
        if (job.getProductLink() != null) body.put("productLink", job.getProductLink());
        if (job.getProductTitle() != null) body.put("productTitle", job.getProductTitle());
        body.put("storageState", storageState);
        body.put("callbackUrl", selfBaseUrl + "/job-callback");
        body.put("callbackSecret", internalSecret);
        body.put("jobId", job.getId());

        try {
            Map<String, Object> sauResp = sau.upload(body);
            String taskId = stringOrNull(sauResp.get("taskId"));
            if (taskId != null) {
                job.setExternalTaskId(taskId);
                jobRepo.save(job);
                log.info("[publish] dispatched jobId={} externalTaskId={} platform={} accountId={} cost={}",
                        job.getId(), taskId, platformWire(job), account.getId(), cost);
            } else {
                log.warn("[publish] dispatched without externalTaskId jobId={} platform={} accountId={}",
                        job.getId(), platformWire(job), account.getId());
            }
        } catch (BusinessException e) {
            // v0.33+: sau-service 调用失败 → 任务标 FAILED + 退回 hold（之前是不退款）
            log.warn("sau upload failed jobId={} err={}", job.getId(), e.getMessage());
            job.setStatus(PublishJobStatus.FAILED);
            job.setErrorCode(e.getCode());
            job.setErrorMessage(e.getMessage());
            jobRepo.save(job);
            writeEvent(job.getId(), "error", PublishJobStatus.UPLOADING, PublishJobStatus.FAILED,
                    job.getProgress(), e.getCode() + ": " + e.getMessage());
            releaseHoldOnFailure(job, "派单失败 · " + safeShort(e.getMessage()));
            // 不重抛 — 让调用方拿到 PublishJobDto 看到 FAILED 状态
        }
        return PublishJobDto.from(job);
    }

    private boolean verifyAccountBeforeCharge(PublishJob job,
                                              SocialAccount account,
                                              Map<String, Object> storageState) {
        String platformWire = account.getPlatform().wire();
        try {
            Map<String, Object> lite = sau.verifyAccountLite(platformWire, storageState);
            String liteStatus = stringOrNull(lite.get("status"));
            if ("valid".equals(liteStatus)) {
                account.setStatus(SocialAccountStatus.ACTIVE);
                account.setLastVerifiedAt(Instant.now());
                accountRepo.save(account);
                log.info("publish preflight lite valid jobId={} accountId={} platform={}",
                        job.getId(), account.getId(), platformWire);
                return true;
            }
            if ("invalid".equals(liteStatus)) {
                expireAccountAndFail(job, account, "ACCOUNT_EXPIRED",
                        firstNonBlank(stringOrNull(lite.get("message")), "账号登录已失效，请重新绑定后重试"));
                log.info("publish preflight lite invalid jobId={} accountId={} platform={} code={}",
                        job.getId(), account.getId(), platformWire, stringOrNull(lite.get("errorCode")));
                return false;
            }
            log.info("publish preflight lite unknown jobId={} accountId={} platform={} code={} diagnosticId={}",
                    job.getId(), account.getId(), platformWire,
                    stringOrNull(lite.get("errorCode")), stringOrNull(lite.get("diagnosticId")));
        } catch (BusinessException e) {
            log.warn("publish preflight lite failed jobId={} accountId={} platform={} err={}",
                    job.getId(), account.getId(), platformWire, e.getMessage());
        }

        try {
            Map<String, Object> heavy = sau.verifyAccount(platformWire, storageState);
            boolean valid = Boolean.TRUE.equals(heavy.get("valid"));
            if (!valid) {
                expireAccountAndFail(job, account, "ACCOUNT_EXPIRED",
                        "账号登录已失效，请重新绑定后重试");
                log.info("publish preflight patchright invalid jobId={} accountId={} platform={}",
                        job.getId(), account.getId(), platformWire);
                return false;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> refreshed = (Map<String, Object>) heavy.get("refreshedStorageState");
            if (refreshed != null && !refreshed.isEmpty()) {
                account.setStorageStateEncrypted(secret.encryptStorageState(refreshed));
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> profile = (Map<String, Object>) heavy.get("profile");
            applyAccountProfile(account, profile, false);
            account.setStatus(SocialAccountStatus.ACTIVE);
            account.setLastVerifiedAt(Instant.now());
            accountRepo.save(account);
            log.info("publish preflight patchright valid jobId={} accountId={} platform={}",
                    job.getId(), account.getId(), platformWire);
            return true;
        } catch (BusinessException e) {
            failBeforeDispatch(job, account, "ACCOUNT_VERIFY_FAILED",
                    "账号状态校验失败，暂未派单扣费：" + e.getMessage());
            log.warn("publish preflight patchright failed jobId={} accountId={} platform={} err={}",
                    job.getId(), account.getId(), platformWire, e.getMessage());
            return false;
        }
    }

    private void expireAccountAndFail(PublishJob job, SocialAccount account, String code, String message) {
        account.setStatus(SocialAccountStatus.EXPIRED);
        accountRepo.save(account);
        failBeforeDispatch(job, account, code, message);
    }

    private void failBeforeDispatch(PublishJob job, SocialAccount account, String code, String message) {
        PublishJobStatus from = job.getStatus();
        job.setStatus(PublishJobStatus.FAILED);
        job.setProgress(0);
        job.setErrorCode(code);
        job.setErrorMessage(message);
        job.setExternalTaskId(null);
        jobRepo.save(job);
        writeEvent(job.getId(), "error", from, PublishJobStatus.FAILED, 0, code + ": " + message);
        log.info("publish preflight blocked jobId={} accountId={} code={}",
                job.getId(), account != null ? account.getId() : null, code);
    }

    private static void applyAccountProfile(SocialAccount account, Map<String, Object> profile, boolean clearMissing) {
        if (profile == null || profile.isEmpty()) return;
        applyAccountProfileField(profile, "displayName", clearMissing, account::setDisplayName);
        applyAccountProfileField(profile, "platformAccountId", clearMissing, account::setPlatformAccountId);
        applyAccountProfileField(profile, "avatarUrl", clearMissing, account::setAvatarUrl);
    }

    private static void applyAccountProfileField(Map<String, Object> profile,
                                                 String key,
                                                 boolean clearMissing,
                                                 java.util.function.Consumer<String> setter) {
        String value = stringOrNull(profile.get(key));
        if (value != null || clearMissing) setter.accept(value);
    }

    private static String firstNonBlank(String first, String fallback) {
        return first != null && !first.isBlank() ? first : fallback;
    }

    // ── callback (idempotent by externalTaskId) ─────────────────────────

    @Transactional
    public void applyCallback(PublishJobCallbackDto cb) {
        if (cb == null || cb.externalTaskId() == null || cb.externalTaskId().isBlank()) {
            throw BusinessException.badRequest("CALLBACK_MISSING_TASK_ID", "缺少 externalTaskId");
        }
        PublishJob job = jobRepo.findByExternalTaskId(cb.externalTaskId()).orElse(null);
        if (job == null) {
            log.warn("callback for unknown externalTaskId={} — ignored", cb.externalTaskId());
            return;
        }
        PublishJobStatus from = job.getStatus();
        PublishJobStatus to = PublishJobStatus.fromWire(cb.status());
        if (to == null) {
            throw BusinessException.badRequest("STATUS_INVALID", "未知 status=" + cb.status());
        }
        if (from == to) {
            // 同状态可能只是进度 / interactionRequired 内容更新（例如重发 SMS 后
            // can_resend_at 变化）。
            boolean changed = false;
            if (cb.progress() != null && cb.progress() > job.getProgress()) {
                job.setProgress(cb.progress());
                changed = true;
            }
            if (from == PublishJobStatus.AWAITING_USER && cb.interactionRequired() != null) {
                job.setInteractionRequiredJson(serializeInteraction(cb.interactionRequired()));
                changed = true;
            }
            if (changed) {
                jobRepo.save(job);
                writeEvent(job.getId(), "progress", from, to, job.getProgress(), null);
            }
            return;
        }
        if (!from.canTransitionTo(to)) {
            log.warn("callback rejects status transition {} -> {} (job {})",
                    from.wire(), to.wire(), job.getId());
            return;
        }

        job.setStatus(to);
        if (cb.progress() != null) job.setProgress(cb.progress());
        if (to == PublishJobStatus.LIVE) {
            if (cb.externalUrl() != null) job.setExternalUrl(cb.externalUrl());
            job.setProgress(100);
            job.setInteractionRequiredJson(null);
            // v0.33+: 真正发布上线 → commit hold（hold 总额 = creditsSpent）。
            Long spent = job.getCreditsSpent();
            if (spent != null && spent > 0) {
                try {
                    creditService.commitHold("publish_job_upload", job.getId(), spent,
                            "发布上线 · " + job.getPlatform().wire() + " · " + safeTitle(job.getTitle()));
                } catch (Exception e) {
                    log.warn("publish commit hold failed jobId={} err={}", job.getId(), e.getMessage());
                }
            }
        }
        if (to == PublishJobStatus.FAILED) {
            if (isCookieInvalidUploadError(cb)) {
                expireAccountAfterUploadCookieFailure(job);
                job.setErrorCode("ACCOUNT_EXPIRED");
                job.setErrorMessage("账号登录已失效，请重新绑定后重试");
            } else {
                if (cb.errorCode() != null) job.setErrorCode(cb.errorCode());
                if (cb.errorMessage() != null) job.setErrorMessage(cb.errorMessage());
                // v0.33+: 普通失败 → release hold（cookie-invalid 已在 expireAccount... 内退）。
                releaseHoldOnFailure(job, "发布失败 · " + safeShort(cb.errorMessage()));
            }
            job.setInteractionRequiredJson(null);
        }
        if (to == PublishJobStatus.AWAITING_USER) {
            // 进入 awaiting_user：sau-service 必须随 callback 透传 interactionRequired
            // payload。空 payload 视为契约破坏，但不阻塞回调流（仍接受状态切换，
            // 前端会看到 awaiting_user 但无 prompt，做兜底提示）。
            if (cb.interactionRequired() != null) {
                job.setInteractionRequiredJson(serializeInteraction(cb.interactionRequired()));
            } else {
                log.warn("callback to AWAITING_USER without interactionRequired payload (job {})",
                        job.getId());
            }
        } else if (from == PublishJobStatus.AWAITING_USER) {
            // 离开 awaiting_user：清空 interaction，进度由 sau-service 推
            job.setInteractionRequiredJson(null);
        }
        jobRepo.save(job);
        writeEvent(job.getId(), "callback", from, to, job.getProgress(),
                cb.errorMessage() != null ? cb.errorMessage() : cb.externalUrl());
        log.info("[publish] callback applied jobId={} externalTaskId={} from={} to={} progress={} errorCode={} externalUrlPresent={}",
                job.getId(), cb.externalTaskId(), from.wire(), to.wire(), job.getProgress(),
                cb.errorCode(), cb.externalUrl() != null && !cb.externalUrl().isBlank());
    }

    private boolean isCookieInvalidUploadError(PublishJobCallbackDto cb) {
        String code = cb.errorCode() == null ? "" : cb.errorCode();
        String message = cb.errorMessage() == null ? "" : cb.errorMessage();
        return ("UPLOADER_RAISED".equals(code) || "UPLOAD_FAILED".equals(code))
                && (message.contains("cookie文件已失效")
                || message.contains("cookie invalid")
                || message.contains("Cookie invalid")
                || message.contains("请先完成抖音登录")
                || message.contains("请先完成登录"));
    }

    private void expireAccountAfterUploadCookieFailure(PublishJob job) {
        accountRepo.findById(job.getSocialAccountId()).ifPresent(account -> {
            account.setStatus(SocialAccountStatus.EXPIRED);
            account.setUpdatedAt(Instant.now());
            accountRepo.save(account);
        });
        Long spent = job.getCreditsSpent();
        if (spent != null && spent > 0) {
            try {
                // v0.33+: 走 releaseHold（pending → 原桶），不再用 creditAccount(REFUND) 凭空入账。
                creditService.releaseHold("publish_job_upload", job.getId(),
                        "发布前账号校验漏判，上传阶段发现账号登录失效，自动退回积分");
                job.setCreditsSpent(null);
                writeEvent(job.getId(), "refund", job.getStatus(), job.getStatus(), job.getProgress(),
                        "credit:+" + spent + " account_expired_after_upload_check");
            } catch (Exception e) {
                log.warn("release hold failed for cookie-invalid publish job {}: {}", job.getId(), e.getMessage());
            }
        }
    }

    /**
     * v0.33+: 任务真正失败（非 cookie-invalid 那条路径）时退回 hold。
     * 幂等：releaseHold 内部检查 hold 状态；重复调用安全 return null。
     */
    private void releaseHoldOnFailure(PublishJob job, String reason) {
        Long spent = job.getCreditsSpent();
        if (spent == null || spent <= 0) return;
        try {
            creditService.releaseHold("publish_job_upload", job.getId(), reason);
            writeEvent(job.getId(), "refund", job.getStatus(), job.getStatus(), job.getProgress(),
                    "credit:+" + spent + " " + reason);
            job.setCreditsSpent(null);
        } catch (Exception e) {
            log.warn("release hold failed jobId={} err={}", job.getId(), e.getMessage());
        }
    }

    private static String safeShort(String s) {
        if (s == null) return "";
        return s.length() > 80 ? s.substring(0, 80) + "..." : s;
    }

    private static String safeTitle(String s) {
        if (s == null) return "";
        return s.length() > 40 ? s.substring(0, 40) + "..." : s;
    }

    private static String platformWire(PublishJob job) {
        return job == null || job.getPlatform() == null ? null : job.getPlatform().wire();
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper INTERACTION_OM =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private static String serializeInteraction(java.util.Map<String, Object> payload) {
        try {
            return INTERACTION_OM.writeValueAsString(payload);
        } catch (Exception e) {
            // Falling through to null-store is better than throwing — the
            // user will see awaiting_user with no prompt rather than an
            // exploded callback.
            log.warn("serializeInteraction failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 用户在前端提交人机交互响应（短信验证码等）。
     * 转发到 sau-service POST /tasks/{externalTaskId}/interaction。
     *
     * 校验：
     *   - job 必须 status=AWAITING_USER（不然 sau-service 那边也会 409 拒绝）
     *   - job 必须有 externalTaskId（否则任务还没派到 sau）
     *   - 当前用户必须是 job 所有人
     *
     * 不会同步更新 status — sau-service 处理完会通过 callback 翻回原 status。
     * 前端轮询会看到状态变化。
     */
    @Transactional
    public PublishJobDto submitInteraction(String userId, String jobId, String code) {
        PublishJob job = jobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
        if (job.getStatus() != PublishJobStatus.AWAITING_USER) {
            throw new BusinessException(HttpStatus.CONFLICT, "INTERACTION_NOT_PENDING",
                    "任务当前未在等待用户输入 (status=" + job.getStatus().wire() + ")");
        }
        if (job.getExternalTaskId() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "JOB_NOT_DISPATCHED",
                    "任务尚未派单到 sau-service，无法提交交互响应");
        }
        if (code == null || code.isBlank()) {
            throw BusinessException.badRequest("INTERACTION_CODE_BLANK", "验证码不能为空");
        }
        sau.submitInteraction(job.getExternalTaskId(), code.trim());
        log.info("[publish] interaction submitted user={} jobId={} externalTaskId={}",
                userId, jobId, job.getExternalTaskId());
        // sau-service 接受后会异步：fill page → callback 回 PUBLISHING/UPLOADING
        // 这里返回当前 DTO（仍是 AWAITING_USER），前端会轮询拿到更新。
        return PublishJobDto.from(job);
    }

    // ── cancel / retry ──────────────────────────────────────────────────

    @Transactional
    public PublishJobDto cancel(String userId, String jobId) {
        PublishJob job = jobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
        if (job.getStatus().isTerminal()) {
            throw new BusinessException(HttpStatus.CONFLICT, "JOB_TERMINAL",
                    "任务已是终态 (" + job.getStatus().wire() + ")，无法取消");
        }
        PublishJobStatus from = job.getStatus();
        job.setStatus(PublishJobStatus.CANCELLED);
        jobRepo.save(job);
        writeEvent(job.getId(), "transition", from, PublishJobStatus.CANCELLED, job.getProgress(), "user cancel");
        // v0.33+: 用户取消 → 退回 hold（已扣过的部分 commit 不动；未消费部分退回原桶）
        releaseHoldOnFailure(job, "用户取消分发任务");
        log.info("[publish] canceled user={} jobId={} from={} externalTaskId={}",
                userId, jobId, from.wire(), job.getExternalTaskId());

        // best-effort 通知 sau-service；不阻塞用户
        if (job.getExternalTaskId() != null) {
            try {
                sau.cancelTask(job.getExternalTaskId());
            } catch (Exception e) {
                log.warn("sau cancelTask failed externalTaskId={} err={}", job.getExternalTaskId(), e.getMessage());
            }
        }
        return PublishJobDto.from(job);
    }

    /** 重试：复用同一行，重置 progress / errorMessage，重新走 startJob (扣费一次)。 */
    @Transactional
    public PublishJobDto retry(String userId, String jobId) {
        PublishJob job = jobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
        if (job.getStatus() != PublishJobStatus.FAILED && job.getStatus() != PublishJobStatus.CANCELLED) {
            throw new BusinessException(HttpStatus.CONFLICT, "JOB_NOT_RETRYABLE",
                    "仅 failed / cancelled 任务可重试，当前 status=" + job.getStatus().wire());
        }
        PublishJobStatus from = job.getStatus();
        job.setStatus(PublishJobStatus.QUEUED);
        job.setProgress(0);
        job.setErrorCode(null);
        job.setErrorMessage(null);
        job.setExternalTaskId(null);
        jobRepo.save(job);
        writeEvent(job.getId(), "transition", from, PublishJobStatus.QUEUED, 0, "retry");
        log.info("[publish] retry user={} jobId={} from={}", userId, jobId, from.wire());
        return startJob(userId, jobId);
    }

    // ── resume sweep ─────────────────────────────────────────────────────

    /**
     * server 启动时扫所有 in-progress 任务，调 sau-service /tasks/{id} 同步当前状态。
     * 如果 sau-service 不认识 (重启后 in-memory task 丢失) → 标 FAILED，不退款。
     */
    @PostConstruct
    void resumeInflight() {
        List<PublishJobStatus> inflight = List.of(
                PublishJobStatus.UPLOADING,
                PublishJobStatus.TRANSCODING,
                PublishJobStatus.PUBLISHING
        );
        List<PublishJob> rows = jobRepo.findByStatusIn(inflight);
        if (rows.isEmpty()) return;
        log.info("resumeInflight: {} job(s) in-progress at boot", rows.size());
        for (PublishJob job : rows) {
            if (job.getExternalTaskId() == null) {
                // 调用 sau /upload 之前进程崩了；标 FAILED
                resumeFail(job, "RESUME_NO_EXTERNAL_TASK", "重启时任务尚未获得 sau taskId");
                continue;
            }
            try {
                Map<String, Object> resp = sau.getTask(job.getExternalTaskId());
                String status = stringOrNull(resp.get("status"));
                PublishJobStatus to = PublishJobStatus.fromWire(status);
                if (to == null) {
                    resumeFail(job, "RESUME_UNKNOWN_STATUS", "sau 返回未知 status=" + status);
                    continue;
                }
                Object interactionRaw = resp.get("interactionRequired");
                @SuppressWarnings("unchecked")
                Map<String, Object> interaction = interactionRaw instanceof Map
                        ? (Map<String, Object>) interactionRaw : null;
                PublishJobCallbackDto cb = new PublishJobCallbackDto(
                        job.getExternalTaskId(),
                        status,
                        intOrNull(resp.get("progress")),
                        stringOrNull(resp.get("externalUrl")),
                        stringOrNull(resp.get("errorCode")),
                        stringOrNull(resp.get("errorMessage")),
                        interaction
                );
                applyCallback(cb);
            } catch (Exception e) {
                resumeFail(job, "RESUME_SAU_UNREACHABLE", "查询 sau 失败: " + e.getMessage());
            }
        }
    }

    @Transactional
    void resumeFail(PublishJob job, String code, String msg) {
        log.warn("resumeFail jobId={} code={} msg={}", job.getId(), code, msg);
        PublishJobStatus from = job.getStatus();
        job.setStatus(PublishJobStatus.FAILED);
        job.setErrorCode(code);
        job.setErrorMessage(msg);
        jobRepo.save(job);
        writeEvent(job.getId(), "system", from, PublishJobStatus.FAILED, job.getProgress(), code + ": " + msg);
        // v0.33+: 启动 sweep 标 FAILED 也走 release
        releaseHoldOnFailure(job, "启动时同步状态失败 · " + code);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private void writeEvent(String jobId, String kind,
                             PublishJobStatus from, PublishJobStatus to,
                             int progress, String note) {
        eventRepo.save(PublishJobEvent.builder()
                .id(UUID.randomUUID().toString())
                .jobId(jobId)
                .kind(kind)
                .fromStatus(from)
                .toStatus(to)
                .progress(progress)
                .note(note)
                .at(Instant.now())
                .build());
    }

    private static String stringOrNull(Object o) {
        if (o == null) return null;
        String s = o.toString();
        return s.isBlank() ? null : s;
    }

    /**
     * 把可能为相对路径的 cdn url 标准化为绝对 URL。
     *
     * sau-service 是独立进程，只接受 absolute URL（http:// 或 https://）。Server 端有些
     * 历史 PublishJob.videoUrl 落库时 AEP_CDN_PUBLIC_BASE_URL 还是默认相对路径 `/cdn`，
     * 这里在派单给 sau 前实时补全成 `<selfHost>/cdn/...`，避免历史脏数据走不通。
     *
     * 推导规则：
     *   "http://..." / "https://..."  → 原样返回
     *   "/<anything>"                  → selfHost (从 selfBaseUrl 取 origin) + url
     *   其它                            → 抛 IllegalArgumentException（不可恢复）
     */
    private String toAbsoluteUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("videoUrl is null/blank");
        }
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        if (!url.startsWith("/")) {
            throw new IllegalArgumentException("videoUrl is neither absolute nor leading-slash: " + url);
        }
        // selfBaseUrl 形如 "http://localhost:8080/api/internal/sau"；取 origin
        String origin = selfBaseUrl;
        try {
            java.net.URI u = java.net.URI.create(selfBaseUrl);
            origin = u.getScheme() + "://" + u.getAuthority();
        } catch (Exception ignored) {
            // 退化到 selfBaseUrl 不 parse 也比拼坏字符串好
        }
        return origin + url;
    }

    private static Integer intOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }
}
