package com.aistareco.aep.service;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.PublishJobCallbackDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobEvent;
import com.aistareco.aep.model.PublishJobStatus;
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
 *   - startJob        : queued → uploading；**此时扣费 (失败不退)**；调 sau-service /upload
 *   - applyCallback   : sau-service → server 进度推送；幂等 (按 externalTaskId)
 *   - cancel / retry  : 终态约束 + 不退款
 *   - resumeInflight  : @PostConstruct 启动时扫所有 in-progress 状态，逐条调 sau /tasks/{id}
 *
 * 扣费走 CreditService.debit(userId, cost, "publish_job_upload", jobId, desc)。
 */
@Service
public class PublishJobService {

    private static final Logger log = LoggerFactory.getLogger(PublishJobService.class);

    private final PublishJobRepository jobRepo;
    private final PublishJobEventRepository eventRepo;
    private final SocialAccountRepository accountRepo;
    private final SocialAccountSecretService secret;
    private final SauServiceClient sau;
    private final CreditService creditService;
    private final String internalSecret;
    private final String selfBaseUrl;
    private final long defaultUploadCost;

    public PublishJobService(PublishJobRepository jobRepo,
                              PublishJobEventRepository eventRepo,
                              SocialAccountRepository accountRepo,
                              SocialAccountSecretService secret,
                              SauServiceClient sau,
                              CreditService creditService,
                              @Value("${aep.internal.secret:aep-dev-internal-secret-change-in-prod}") String internalSecret,
                              @Value("${sau.callback-base-url:http://localhost:8080/api/internal/sau}") String selfBaseUrl,
                              @Value("${sau.default-upload-cost:20}") long defaultUploadCost) {
        this.jobRepo = jobRepo;
        this.eventRepo = eventRepo;
        this.accountRepo = accountRepo;
        this.secret = secret;
        this.sau = sau;
        this.creditService = creditService;
        this.internalSecret = internalSecret;
        this.selfBaseUrl = selfBaseUrl;
        this.defaultUploadCost = defaultUploadCost;
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

    // ── create batch (queued only, no charge) ───────────────────────────

    @Transactional
    public List<PublishJobDto> createBatch(String userId, CreatePublishJobInputDto input) {
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "未登录");
        }
        if (input == null || input.projectId() == null || input.videoUrl() == null
                || input.title() == null || input.targets() == null || input.targets().isEmpty()) {
            throw BusinessException.badRequest("INPUT_INCOMPLETE",
                    "缺少必要字段 (projectId / videoUrl / title / targets)");
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

            PublishJob job = PublishJob.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(userId)
                    .projectId(input.projectId())
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
                    .scheduledAt(t.scheduledAt())
                    .build();
            jobRepo.save(job);
            writeEvent(job.getId(), "transition", null, PublishJobStatus.QUEUED, 0, "queued");
            created.add(job);
        }
        return created.stream().map(PublishJobDto::from).toList();
    }

    // ── start (charge + dispatch) ───────────────────────────────────────

    @Transactional
    public PublishJobDto startJob(String userId, String jobId) {
        PublishJob job = jobRepo.findByIdAndUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
        if (job.getStatus() != PublishJobStatus.QUEUED) {
            throw new BusinessException(HttpStatus.CONFLICT, "JOB_NOT_QUEUED",
                    "仅 queued 任务可启动，当前 status=" + job.getStatus().wire());
        }
        SocialAccount account = accountRepo.findByIdAndUserId(job.getSocialAccountId(), userId)
                .orElseThrow(() -> BusinessException.notFound("SOCIAL_ACCOUNT_NOT_FOUND",
                        "社交账号不存在 (可能已解绑)"));
        if (account.getStatus() != SocialAccountStatus.ACTIVE
                || account.getStorageStateEncrypted() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_NOT_ACTIVE",
                    "社交账号不可用 (status=" + account.getStatus().wire() + ")");
        }

        long cost = defaultUploadCost; // 后续可按 platform 读 PlatformConfig
        // debit 抛 PAYMENT_REQUIRED 时事务回滚，任务保持 queued
        creditService.debit(userId, cost, "publish_job_upload", job.getId(),
                "发布任务上传 - " + account.getPlatform().wire() + " - " + job.getTitle());
        job.setCreditsSpent(cost);

        // 解密 storage_state — 仅本方法局部变量持有明文
        Map<String, Object> storageState = secret.decryptStorageState(account.getStorageStateEncrypted());

        // 翻 UPLOADING 先落库 (拿 externalTaskId 后再保存一次)
        PublishJobStatus from = job.getStatus();
        job.setStatus(PublishJobStatus.UPLOADING);
        job.setProgress(0);
        jobRepo.save(job);
        writeEvent(job.getId(), "transition", from, PublishJobStatus.UPLOADING, 0, "credit:-" + cost);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("platform", account.getPlatform().wire());
        body.put("accountName", account.getAccountName());
        body.put("videoUrl", job.getVideoUrl());
        body.put("title", job.getTitle());
        body.put("description", job.getDescription());
        body.put("tags", job.getTags() != null ? job.getTags() : List.of());
        if (job.getCoverUrl() != null) body.put("coverUrl", job.getCoverUrl());
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
            }
        } catch (BusinessException e) {
            // sau-service 调用失败 → 任务标 FAILED，不退款
            log.warn("sau upload failed jobId={} err={}", job.getId(), e.getMessage());
            job.setStatus(PublishJobStatus.FAILED);
            job.setErrorCode(e.getCode());
            job.setErrorMessage(e.getMessage());
            jobRepo.save(job);
            writeEvent(job.getId(), "error", PublishJobStatus.UPLOADING, PublishJobStatus.FAILED,
                    job.getProgress(), e.getCode() + ": " + e.getMessage());
            // 不重抛 — 让调用方拿到 PublishJobDto 看到 FAILED 状态
        }
        return PublishJobDto.from(job);
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
            // 同状态可能只是进度更新
            if (cb.progress() != null && cb.progress() > job.getProgress()) {
                job.setProgress(cb.progress());
                jobRepo.save(job);
                writeEvent(job.getId(), "progress", from, to, cb.progress(), null);
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
        }
        if (to == PublishJobStatus.FAILED) {
            if (cb.errorCode() != null) job.setErrorCode(cb.errorCode());
            if (cb.errorMessage() != null) job.setErrorMessage(cb.errorMessage());
        }
        jobRepo.save(job);
        writeEvent(job.getId(), "callback", from, to, job.getProgress(),
                cb.errorMessage() != null ? cb.errorMessage() : cb.externalUrl());
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
                PublishJobCallbackDto cb = new PublishJobCallbackDto(
                        job.getExternalTaskId(),
                        status,
                        intOrNull(resp.get("progress")),
                        stringOrNull(resp.get("externalUrl")),
                        stringOrNull(resp.get("errorCode")),
                        stringOrNull(resp.get("errorMessage"))
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

    private static Integer intOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }
}
