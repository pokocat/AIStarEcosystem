package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.MixcutCreateJobRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.model.MixcutRenderOutput;
import com.aistareco.aep.repository.MixcutRenderJobRepository;
import com.aistareco.aep.repository.MixcutRenderOutputRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class MixcutJobService {

    private static final Logger log = LoggerFactory.getLogger(MixcutJobService.class);

    private final MixcutRenderJobRepository jobRepo;
    private final MixcutRenderOutputRepository outputRepo;
    private final ObjectMapper mapper;
    private final MixcutRenderingService rendering;

    public MixcutJobService(
            MixcutRenderJobRepository jobRepo,
            MixcutRenderOutputRepository outputRepo,
            ObjectMapper mapper,
            MixcutRenderingService rendering
    ) {
        this.jobRepo = jobRepo;
        this.outputRepo = outputRepo;
        this.mapper = mapper;
        this.rendering = rendering;
    }

    /**
     * v0.21+: 软删指定 output。Principal 校验通过 + output 属于该用户任务。
     * 不删本地文件 / CDN —— 30 天后由 MixcutOutputCleanupScheduler 物理清理，期间可联系客服恢复。
     * 返回 true = 已置 deletedAt，false = 找不到或越权。
     */
    @Transactional
    public boolean softDeleteOutput(String outputId, String userId) {
        if (outputId == null || outputId.isBlank() || userId == null || userId.isBlank()) {
            return false;
        }
        return outputRepo.findById(outputId)
                .filter(o -> o.getJob() != null && userId.equals(o.getJob().getUserId()))
                .filter(o -> o.getDeletedAt() == null)
                .map(o -> {
                    o.setDeletedAt(OffsetDateTime.now());
                    outputRepo.save(o);
                    log.info("[mixcut] soft-deleted output {} (user={}, job={})",
                            outputId, userId, o.getJob().getId());
                    return true;
                })
                .orElse(false);
    }

    /** v0.13.0+: 取当前用户名下的任务列表（admin 跨用户列表见 AdminMixcutController）。 */
    @Transactional(readOnly = true)
    public List<MixcutRenderJobDto> listForUser(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return jobRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(j -> MixcutRenderJobDto.from(j, mapper))
                .toList();
    }

    /** v0.13.0+: 取当前用户自有任务；他人 jobId 直接返回 empty（视同不存在）。 */
    @Transactional(readOnly = true)
    public Optional<MixcutRenderJobDto> getForUser(String id, String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return jobRepo.findById(id)
                .filter(j -> userId.equals(j.getUserId()))
                .map(j -> MixcutRenderJobDto.from(j, mapper));
    }

    /**
     * 创建任务并 dispatch 异步 worker。返回的 DTO 状态固定为 "queued"。
     * v0.13.0+: principalUserId 优先于 req.userId（避免越权创建别人名下 job）。
     */
    @Transactional
    public MixcutRenderJobDto create(MixcutCreateJobRequest req, String principalUserId) {
        MixcutRenderJob job = new MixcutRenderJob();
        job.setId(req.id() != null && !req.id().isBlank() ? req.id() : ("job_" + shortUuid()));

        // userId 真值：principal > req.userId > "anonymous"（兼容老 dev 环境）
        String effectiveUserId = (principalUserId != null && !principalUserId.isBlank())
                ? principalUserId
                : (req.userId() != null && !req.userId().isBlank() ? req.userId() : "anonymous");
        job.setUserId(effectiveUserId);

        job.setTemplateId(req.templateId());
        job.setTemplateName(req.templateName());
        job.setTemplateThumbnail(req.templateThumbnail());

        String bindingsJson;
        try {
            bindingsJson = req.slotBindings() == null || req.slotBindings().isNull()
                    ? "{}"
                    : mapper.writeValueAsString(req.slotBindings());
        } catch (Exception e) {
            bindingsJson = "{}";
        }
        job.setSlotBindingsJson(bindingsJson);

        job.setCanvasSnapshotJson(serializeJson(req.canvasSnapshot()));
        job.setSlotsSnapshotJson(serializeJson(req.slotsSnapshot()));
        job.setPerturbationOverridesJson(serializeJson(req.perturbationOverrides()));
        job.setStickerPoolJson(serializeJson(req.stickerPool()));
        job.setScenesSnapshotJson(serializeJson(req.scenesSnapshot()));
        // v0.26+: 关联商品 id（可空）
        if (req.productId() != null && !req.productId().isBlank()) {
            job.setProductId(req.productId().trim());
        }

        job.setPerturbationProfile(safe(req.perturbationProfile(), "moderate"));
        job.setOutputVariants(req.outputVariants() != null && req.outputVariants() > 0 ? req.outputVariants() : 1);
        job.setStatus("queued");
        job.setProgress(0);
        job.setCreatedAt(OffsetDateTime.now());

        jobRepo.save(job);
        log.info("[mixcut] queued job {} user={} template={} variants={} profile={}",
                job.getId(), job.getUserId(), job.getTemplateId(), job.getOutputVariants(), job.getPerturbationProfile());

        // 异步 dispatch 必须在事务 commit 之后；否则 worker 新事务里 SELECT 看不到这条 job。
        final String jobId = job.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    // log 让用户能确认 tx 真的 commit 了 + worker 已 enqueue 到 mixcutExecutor。
                    // 后续如果看不到 "[mixcut] worker picked up job=..."，说明池满 / 注解未生效。
                    log.info("[mixcut] dispatching renderAsync for {} (tx committed)", jobId);
                    rendering.renderAsync(jobId);
                }
            });
        } else {
            // dev/test 路径：没事务时直接派单（H2 lite scenarios）。
            log.info("[mixcut] dispatching renderAsync for {} (no active tx)", jobId);
            rendering.renderAsync(jobId);
        }

        return MixcutRenderJobDto.from(job, mapper);
    }

    /**
     * v0.13.0+: 仅当任务属于 principalUserId 时允许更新进度。
     * （worker 内部从 RenderingService 直接走 repo 不走本方法，所以不会被这层挡住。）
     */
    @Transactional
    public Optional<MixcutRenderJobDto> updateProgressForUser(String id, Integer progress, String status, String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return jobRepo.findById(id)
                .filter(j -> userId.equals(j.getUserId()))
                .map(job -> {
                    if (progress != null) job.setProgress(Math.max(0, Math.min(100, progress)));
                    if (status != null && !status.isBlank()) job.setStatus(status);
                    jobRepo.save(job);
                    return MixcutRenderJobDto.from(job, mapper);
                });
    }

    private static String shortUuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String safe(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String serializeJson(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || node.isNull()) return null;
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("[mixcut] serialize snapshot failed: {}", e.getMessage());
            return null;
        }
    }
}
