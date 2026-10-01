package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimization;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 视频生成区的智能优化（docs/video-studio-plan.md §9）：发起 / 查询。真正调厂商在
 * {@link VideoStudioOptimizationWorker}（后台线程，厂商同步接口最长要等十分钟上下）。
 *
 * <ul>
 *   <li>校验与提交生成**同一个校验器、同一套错误码**（{@link VideoStudioService#validate}，种子不看）；</li>
 *   <li>同一用户同一 clientRequestId 只有一条记录、只冻结一次，重复提交原样返回。<b>先插行（立刻 flush）再冻结</b>：
 *       并发的同一串卡在自己的插入上，等先到的提交后撞唯一键、读回那一条 —— 余额只够一次时也是两边拿到同一条，不会一边 402；</li>
 *   <li>价格 = 计价配置的 {@code promptOptimizationPerCall}（0 = 不收费），&gt; 0 才冻结；余额不足 402，
 *       刚插的行随同一事务回滚，什么都不落；</li>
 *   <li>派发挂在 {@code afterCommit}（事务里直接派发，worker 会查不到这一行 —— ipstudio 真联调踩过）；
 *       线程池排满时经 {@link VideoStudioOptimizationSettlement#fail}（自己开新事务）当场判失败并退冻结，
 *       不留永远 queued 的记录，返回给前端的也是这个结果。</li>
 * </ul>
 */
@Service
public class VideoStudioOptimizationService {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioOptimizationService.class);

    static final String CREDIT_REF_TYPE = "video_studio_prompt_optimization";
    static final String CREDIT_LABEL = "智能优化";

    /** spec_json 里除了生成规格（{@link VideoGenSpec#writeTo} 那一套键）之外的几项。 */
    static final String SPEC_ASPECT_RATIO = "aspect_ratio";
    static final String SPEC_SECONDS = "seconds";
    static final String SPEC_TEMPLATE_ID = "template_id";
    static final String SPEC_LABELS = "labels";

    static final String QUEUE_FULL_MESSAGE = "现在排队优化的人太多，请稍后再试";

    private final VideoStudioService studio;
    private final StudioPromptOptimizationRepository repo;
    private final CreditService credits;
    private final VideoStudioOptimizationWorker worker;
    private final VideoStudioOptimizationSettlement settlement;
    private final TransactionTemplate tx;
    private final ObjectMapper om;

    public VideoStudioOptimizationService(VideoStudioService studio,
                                          StudioPromptOptimizationRepository repo,
                                          CreditService credits,
                                          VideoStudioOptimizationWorker worker,
                                          VideoStudioOptimizationSettlement settlement,
                                          PlatformTransactionManager txManager,
                                          ObjectMapper om) {
        this.studio = studio;
        this.repo = repo;
        this.credits = credits;
        this.worker = worker;
        this.settlement = settlement;
        this.tx = new TransactionTemplate(txManager);
        this.om = om;
    }

    /** 发起一次智能优化。同一个 clientRequestId 重复提交 → 返回同一条，不重复冻结。 */
    public VideoStudioOptimization create(String userId, VideoStudioOptimizationRequest req) {
        String clientRequestId = requireClientRequestId(req == null ? null : req.clientRequestId());
        StudioPromptOptimization existing =
                repo.findByOwnerUserIdAndClientRequestId(userId, clientRequestId).orElse(null);
        if (existing != null) return toDto(existing);
        String id;
        try {
            id = tx.execute(status -> createInTx(userId, clientRequestId, req));
        } catch (DataIntegrityViolationException race) {
            // 同一串的另一次请求先插进了这一行。数据库让这边的插入一直等到它提交才判唯一键冲突（InnoDB 与 H2 都是），
            // 所以走到这里时它已经提交、读得到；这边的事务已整个回滚，而且插入在冻结之前，什么都没冻。读回它。
            StudioPromptOptimization winner =
                    repo.findByOwnerUserIdAndClientRequestId(userId, clientRequestId).orElse(null);
            if (winner == null) throw race;
            log.info("[video-studio] 同一 clientRequestId 并发提交，返回先到的那条 id={} user={}", winner.getId(), userId);
            return toDto(winner);
        }
        // 提交之后再读一遍：线程池拒绝派发时，afterCommit 已经把它判失败并退了冻结，前端要拿到的是这个结果。
        return repo.findById(id).map(this::toDto)
                .orElseThrow(() -> new IllegalStateException("智能优化记录提交后读不到 id=" + id));
    }

    private String createInTx(String userId, String clientRequestId, VideoStudioOptimizationRequest req) {
        VideoStudioService.Validated v = studio.validate(userId, VideoStudioService.Draft.of(req));
        long price = Math.max(0L, v.model().pricing().promptOptimizationPerCall());
        String id = "vso_" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        Instant now = Instant.now();
        StudioPromptOptimization row = StudioPromptOptimization.builder()
                .id(id)
                .ownerUserId(userId)
                .clientRequestId(clientRequestId)
                .endpointId(v.model().selectableById() ? v.model().endpointId() : null)
                .status(StudioPromptOptimization.STATUS_QUEUED)
                .specJson(specJson(v))
                .originalPrompt(v.prompt())
                .creditsHeld(price)
                .createdAt(now)
                .updatedAt(now)
                .build();
        // 先插入并立刻 flush：唯一键 (owner_user_id, client_request_id) 在这一刻就被这一条占住，同一串的并发请求
        // 会卡在自己的插入上，等这边提交后撞唯一键、读回这一条。反过来先冻结的话，余额只够一次时输的那边会 402。
        repo.saveAndFlush(row);
        if (price > 0) {
            // 余额不足在这里抛 402：同一事务回滚，刚插的行和冻结都不留，唯一键也随之放开（同一个串充值后还能再用）。
            credits.hold(userId, price, CREDIT_REF_TYPE, id, CREDIT_LABEL + " · " + VideoStudioService.modeName(v.mode()));
        }
        dispatchAfterCommit(row);
        log.info("[video-studio] 智能优化受理 id={} user={} mode={} tier={} refs={} credits={} template={}",
                id, userId, v.mode(), v.tier(), v.inputs().references().size(), price,
                v.template() == null ? null : v.template().getId());
        return id;
    }

    /** 校验通过的请求快照：worker 只认这一份（生成规格 + 比例 + 秒数 + 模板 id + 素材编号）。 */
    private String specJson(VideoStudioService.Validated v) {
        ObjectNode spec = om.createObjectNode();
        v.spec().writeTo(spec);
        spec.put(SPEC_ASPECT_RATIO, v.aspectRatio());
        spec.put(SPEC_SECONDS, v.seconds());
        if (v.template() != null) spec.put(SPEC_TEMPLATE_ID, v.template().getId());
        List<String> labels = VideoGenSpec.referenceLabels(v.inputs().references());
        if (!labels.isEmpty()) labels.forEach(spec.putArray(SPEC_LABELS)::add);
        return spec.toString();
    }

    private void dispatchAfterCommit(StudioPromptOptimization row) {
        Runnable dispatch = () -> {
            try {
                worker.runAsync(row.getId());
            } catch (TaskRejectedException e) {
                log.warn("[video-studio] 智能优化线程池已满，判失败 id={} err={}", row.getId(), e.getMessage());
                try {
                    // 这里多半在 afterCommit 里：settlement 是 REQUIRES_NEW，自己开事务把「判失败 + 退冻结」一起提交。
                    settlement.fail(row, QUEUE_FULL_MESSAGE);
                } catch (RuntimeException settleError) {
                    log.warn("[video-studio] 线程池已满判失败时结算回滚，记录保持 queued，等兜底回收判失败并退冻结 id={} err={}",
                            row.getId(), settleError.toString());
                }
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch.run();
                }
            });
        } else {
            dispatch.run();
        }
    }

    /** 本人的才看得到，否则 404。 */
    @Transactional(readOnly = true)
    public VideoStudioOptimization get(String userId, String id) {
        return (id == null ? java.util.Optional.<StudioPromptOptimization>empty() : repo.findById(id))
                .filter(o -> userId != null && userId.equals(o.getOwnerUserId()))
                .map(this::toDto)
                .orElseThrow(() -> BusinessException.notFound("VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND",
                        "没有找到这次智能优化"));
    }

    VideoStudioOptimization toDto(StudioPromptOptimization o) {
        boolean failed = StudioPromptOptimization.STATUS_FAILED.equals(o.getStatus());
        return new VideoStudioOptimization(
                o.getId(),
                o.getStatus(),
                o.getOriginalPrompt(),
                StudioPromptOptimization.STATUS_SUCCEEDED.equals(o.getStatus()) ? o.getOptimizedPrompt() : null,
                failed ? o.getErrorMessage() : null,
                Math.max(0L, o.getCreditsHeld()),
                o.getCreatedAt() == null ? null : o.getCreatedAt().toString(),
                o.getCompletedAt() == null ? null : o.getCompletedAt().toString());
    }

    /** clientRequestId 必须是 8–128 个可见 ASCII（厂商对 Idempotency-Key 的要求，也是我们去重的键）。 */
    static String requireClientRequestId(String raw) {
        if (raw != null && raw.length() >= 8 && raw.length() <= 128
                && raw.chars().allMatch(c -> c >= 0x21 && c <= 0x7E)) {
            return raw;
        }
        throw BusinessException.badRequest("VIDEO_STUDIO_REQUEST_ID_INVALID",
                "这次优化请求的编号不对，请刷新页面后重试");
    }
}
