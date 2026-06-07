package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.JobDto;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 异步作业编排：建单（含积分 hold）→ 派发 runner → 重试 / 取消。
 * 扣费三段式：referenceType=dap-job，referenceId=jobId:rN（重试各自独立冻结）。
 */
@Service
public class DapJobService {

    private static final Logger log = LoggerFactory.getLogger(DapJobService.class);
    public static final String REF_TYPE = "dap-job";

    private final DapJobRepository jobRepo;
    private final CreditService creditService;
    private final DapAccountService accountService;
    private final DapSupport support;
    private final DapProperties props;
    private final DapJobRunner runner;
    private final AgnesClient agnes;

    public DapJobService(DapJobRepository jobRepo,
                         CreditService creditService,
                         DapAccountService accountService,
                         DapSupport support,
                         DapProperties props,
                         @Lazy DapJobRunner runner,
                         AgnesClient agnes) {
        this.jobRepo = jobRepo;
        this.creditService = creditService;
        this.accountService = accountService;
        this.support = support;
        this.props = props;
        this.runner = runner;
        this.agnes = agnes;
    }

    // ── 建单 + 派发 ────────────────────────────────────────────

    public DapJob submit(String userId, DapAvatar avatar, String type, String kind, String engine,
                         long cost, String eta, Map<String, Object> payload) {
        requireEngineOrPlaceholderAllowed();
        accountService.ensureMonthlyGrant(userId);

        String id = uniqueId();
        if (cost > 0) {
            // 余额不足在此抛 402，作业不落库
            creditService.hold(userId, cost, REF_TYPE, id + ":r0", kind + "（" + (avatar != null ? avatar.getId() : "-") + "）");
        }
        DapJob job = DapJob.builder()
                .id(id)
                .ownerUserId(userId)
                .avatarId(avatar != null ? avatar.getId() : null)
                .charName(avatar != null ? avatar.getName() : null)
                .kind(kind)
                .type(type)
                .engine(engine)
                .mode(agnes.isConfigured() ? "backend" : "mock")
                .status("running")
                .stage("queued")
                .pct(2)
                .eta(eta)
                .cost(cost)
                .payload(payload == null ? new LinkedHashMap<>() : payload)
                .createdAt(Instant.now())
                .heartbeatAt(Instant.now())
                .stageUpdatedAt(Instant.now())
                .build();
        jobRepo.save(job);
        runner.run(id);
        log.info("[dap-job] submitted id={} type={} avatar={} mode={} engine={} cost={} stage=queued",
                id, type, job.getAvatarId(), job.getMode(), job.getEngine(), cost);
        return job;
    }

    /**
     * 生产严格模式：未配置生成引擎（AGNES_API_KEY / admin「AI 应用绑定」端点）且未显式允许
     * 占位降级（aep.dap.allow-placeholder，mysql/生产 profile 默认 false）时，
     * 提交/重试直接 503 —— 不建任务、不扣费、不产出占位图。
     */
    private void requireEngineOrPlaceholderAllowed() {
        if (agnes.isConfigured() || props.isAllowPlaceholder()) return;
        log.warn("[dap-job] blocked reason=engine-not-configured allowPlaceholder=false");
        throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                "DAP_ENGINE_NOT_CONFIGURED",
                "生成引擎未配置：请在管理后台「AI 模型与 Key + AI 应用绑定」为数字人用途绑定端点，或设置 AGNES_API_KEY");
    }

    // ── 查询 ──────────────────────────────────────────────────

    public List<JobDto> list(String userId, String status, String avatarId) {
        List<DapJob> rows = (avatarId != null && !avatarId.isBlank())
                ? jobRepo.findByOwnerUserIdAndAvatarIdOrderByCreatedAtDesc(userId, avatarId)
                : jobRepo.findTop50ByOwnerUserIdOrderByCreatedAtDesc(userId);
        return rows.stream()
                .filter(j -> status == null || status.isBlank() || status.equals(j.getStatus()))
                .map(j -> JobDto.from(j, support::hm))
                .toList();
    }

    public JobDto get(String userId, String jobId) {
        return JobDto.from(requiredJob(userId, jobId), support::hm);
    }

    public DapJob requiredJob(String userId, String jobId) {
        return jobRepo.findByIdAndOwnerUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_JOB_NOT_FOUND", "任务不存在或无权访问"));
    }

    // ── 重试 / 取消 ────────────────────────────────────────────

    public JobDto retry(String userId, String jobId) {
        requireEngineOrPlaceholderAllowed();
        DapJob job = requiredJob(userId, jobId);
        if (!"failed".equals(job.getStatus())) {
            throw BusinessException.badRequest("DAP_JOB_NOT_FAILED", "只有失败任务可以重试");
        }
        int r = job.getRetryCount() + 1;
        if (job.getCost() > 0) {
            creditService.hold(userId, job.getCost(), REF_TYPE, job.getId() + ":r" + r,
                    job.getKind() + " 重试（" + job.getAvatarId() + "）");
        }
        job.setRetryCount(r);
        job.setStatus("running");
        job.setStage("queued");
        job.setPct(2);
        job.setEta("重新排队中");
        job.setErrorMessage(null);
        job.setCancelRequested(false);
        job.setHeartbeatAt(Instant.now());
        job.setStageUpdatedAt(Instant.now());
        jobRepo.save(job);
        runner.run(job.getId());
        return JobDto.from(job, support::hm);
    }

    public void cancel(String userId, String jobId) {
        DapJob job = requiredJob(userId, jobId);
        if (!"running".equals(job.getStatus())) {
            throw BusinessException.badRequest("DAP_JOB_NOT_RUNNING", "任务已结束，无法取消");
        }
        job.setCancelRequested(true);
        jobRepo.save(job);
        // runner 在下一个检查点感知并落终态 + 释放冻结；这里不直接改状态避免与 runner 竞写
    }

    private String uniqueId() {
        for (int i = 0; i < 20; i++) {
            String id = support.newId("JOB");
            if (!jobRepo.existsById(id)) return id;
        }
        return "JOB-" + UUID.randomUUID().toString().substring(0, 8);
    }

    // ── 价格表 ────────────────────────────────────────────────

    public long priceOf(String type, String derivKey) {
        DapProperties.Pricing p = props.getPricing();
        return switch (type) {
            case DapJob.T_GENERATE -> p.getGenerate();
            case DapJob.T_GENERATE_UPLOAD -> p.getGenerateUpload();
            case DapJob.T_ITERATE -> p.getIterate();
            case DapJob.T_WARP -> p.getWarp();
            case DapJob.T_LOOK -> p.getLook();
            case DapJob.T_DERIVE -> switch (derivKey == null ? "" : derivKey) {
                case "atlas" -> p.getDeriveAtlas();
                case "expr" -> p.getDeriveExpr();
                case "scene" -> p.getDeriveScene();
                case "ward" -> p.getDeriveWard();
                case "d3" -> p.getDeriveD3();
                case "video" -> p.getDeriveVideo();
                default -> 0;
            };
            default -> 0;
        };
    }
}
