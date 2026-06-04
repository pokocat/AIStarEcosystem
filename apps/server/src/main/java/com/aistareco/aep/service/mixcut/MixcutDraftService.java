package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.MissingAssetItem;
import com.aistareco.aep.dto.MixcutCreateJobRequest;
import com.aistareco.aep.dto.MixcutDraftDto;
import com.aistareco.aep.dto.MixcutDraftUpsertRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.dto.MixcutRerunJobRequest;
import com.aistareco.aep.model.MixcutDraft;
import com.aistareco.aep.repository.MixcutDraftRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 混剪「实例 / 草稿」服务（v0.48+）。
 *
 * <p>CRUD + 「从实例生成任务」。生成时把实例快照原样灌进 {@link MixcutJobService} 的标准
 * 创建链路（扣费 / 派发 / 快照），并在 job 上记 draftId 指回本实例。
 *
 * <p>归属严格按 principal 隔离：他人的 draftId 一律视同不存在（404）。
 */
@Service
public class MixcutDraftService {

    private static final Logger log = LoggerFactory.getLogger(MixcutDraftService.class);

    private final MixcutDraftRepository draftRepo;
    private final MixcutJobService jobService;
    private final ObjectMapper mapper;

    public MixcutDraftService(MixcutDraftRepository draftRepo, MixcutJobService jobService, ObjectMapper mapper) {
        this.draftRepo = draftRepo;
        this.jobService = jobService;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<MixcutDraftDto> listForUser(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return draftRepo.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(d -> MixcutDraftDto.from(d, mapper))
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<MixcutDraftDto> getForUser(String id, String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        return draftRepo.findById(id)
                .filter(d -> userId.equals(d.getUserId()))
                .map(d -> MixcutDraftDto.from(d, mapper));
    }

    /**
     * 新建 / 更新一个实例。
     *  - pathId 非空（PUT）→ 以它为准；否则用 req.id()（POST 预生成）；都没有 → 生成。
     *  - 命中已存在行：owner 不符 → 403；owner 相符 → 更新。
     *  - 未命中：新建（owner = userId）。
     */
    @Transactional
    public MixcutDraftDto upsert(MixcutDraftUpsertRequest req, String pathId, String userId) {
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "请先登录后再保存草稿");
        }
        String id = firstNonBlank(pathId, req.id(), "draft_" + shortUuid());

        MixcutDraft draft = draftRepo.findById(id).orElse(null);
        OffsetDateTime now = OffsetDateTime.now();
        if (draft == null) {
            draft = new MixcutDraft();
            draft.setId(id);
            draft.setUserId(userId);
            draft.setStatus("draft");
            draft.setGeneratedJobCount(0);
            draft.setCreatedAt(now);
        } else if (!userId.equals(draft.getUserId())) {
            // 他人实例：不暴露存在性，直接 404
            throw BusinessException.notFound("MIXCUT_DRAFT_NOT_FOUND", "找不到该草稿");
        }

        draft.setTemplateId(req.templateId());
        draft.setTemplateName(req.templateName());
        draft.setTemplateThumbnail(req.templateThumbnail());
        draft.setName(firstNonBlank(req.name(), draft.getName(), defaultName(req.templateName())));
        draft.setTemplateVersion(blankToNull(req.templateVersion()));
        draft.setSlotBindingsJson(serialize(req.slotBindings(), "{}"));
        draft.setCanvasSnapshotJson(serialize(req.canvasSnapshot(), null));
        draft.setSlotsSnapshotJson(serialize(req.slotsSnapshot(), null));
        draft.setScenesSnapshotJson(serialize(req.scenesSnapshot(), null));
        draft.setPerturbationOverridesJson(serialize(req.perturbationOverrides(), null));
        draft.setStickerPoolJson(serialize(req.stickerPool(), null));
        draft.setPerturbationProfile(firstNonBlank(req.perturbationProfile(), draft.getPerturbationProfile(), "moderate"));
        draft.setOutputVariants(req.outputVariants() != null && req.outputVariants() > 0 ? req.outputVariants() : 5);
        draft.setProductId(blankToNull(req.productId()));
        draft.setUpdatedAt(now);

        draftRepo.save(draft);
        log.info("[mixcut] saved draft {} user={} template={}", draft.getId(), userId, draft.getTemplateId());
        return MixcutDraftDto.from(draft, mapper);
    }

    /** 删除一个实例（仅 owner）。返回 true = 已删；false = 找不到或越权。 */
    @Transactional
    public boolean deleteForUser(String id, String userId) {
        if (id == null || id.isBlank() || userId == null || userId.isBlank()) return false;
        return draftRepo.findById(id)
                .filter(d -> userId.equals(d.getUserId()))
                .map(d -> {
                    draftRepo.delete(d);
                    log.info("[mixcut] deleted draft {} user={}", id, userId);
                    return true;
                })
                .orElse(false);
    }

    /**
     * 从实例生成任务。把实例快照灌进标准创建链路：
     *  - owner 校验（404 不暴露他人实例）
     *  - 缺素材校验（与 rerun 同款；引用的 upload/library 素材已删 → 409 MISSING_ASSETS）
     *  - 构造 create request（draft_id 透传 → job 记血缘 → createInternal 自动累计 generatedJobCount）
     *  - 仅 variants / profile 可被 overrides 覆盖；其它快照原样
     */
    @Transactional
    public MixcutRenderJobDto generate(String draftId, String userId, MixcutRerunJobRequest overrides) {
        if (draftId == null || draftId.isBlank() || userId == null || userId.isBlank()) {
            throw BusinessException.notFound("MIXCUT_DRAFT_NOT_FOUND", "找不到该草稿");
        }
        MixcutDraft draft = draftRepo.findById(draftId)
                .filter(d -> userId.equals(d.getUserId()))
                .orElseThrow(() -> BusinessException.notFound("MIXCUT_DRAFT_NOT_FOUND", "找不到该草稿"));

        JsonNode bindings = parseOrNull(draft.getSlotBindingsJson());

        // 缺素材严格阻拦（与 rerun 行为一致）
        List<MissingAssetItem> missing = jobService.collectMissingAssets(bindings);
        if (!missing.isEmpty()) {
            log.warn("[mixcut] draft generate blocked draft={} user={} missing_assets={}",
                    draftId, userId, missing.size());
            throw new MissingAssetsException(missing);
        }

        int effectiveVariants = (overrides != null && overrides.outputVariants() != null && overrides.outputVariants() > 0)
                ? overrides.outputVariants()
                : (draft.getOutputVariants() > 0 ? draft.getOutputVariants() : 1);
        String effectiveProfile = (overrides != null && overrides.perturbationProfile() != null && !overrides.perturbationProfile().isBlank())
                ? overrides.perturbationProfile()
                : firstNonBlank(draft.getPerturbationProfile(), "moderate");

        MixcutCreateJobRequest req = new MixcutCreateJobRequest(
                null,                              // jobId 自动
                userId,
                draft.getTemplateId(),
                draft.getTemplateName(),
                draft.getTemplateThumbnail(),
                bindings,
                effectiveProfile,
                effectiveVariants,
                "queued",
                0,
                null,
                parseOrNull(draft.getCanvasSnapshotJson()),
                parseOrNull(draft.getSlotsSnapshotJson()),
                parseOrNull(draft.getPerturbationOverridesJson()),
                parseOrNull(draft.getStickerPoolJson()),
                parseOrNull(draft.getScenesSnapshotJson()),
                draft.getProductId(),
                draft.getId()                      // v0.48+: draft_id → 血缘 + generatedJobCount 累计
        );

        log.info("[mixcut] generate from draft={} user={} variants={} profile={}",
                draftId, userId, effectiveVariants, effectiveProfile);
        return jobService.create(req, userId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String serialize(JsonNode node, String fallback) {
        if (node == null || node.isNull()) return fallback;
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("[mixcut] draft serialize snapshot failed: {}", e.getMessage());
            return fallback;
        }
    }

    private JsonNode parseOrNull(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static String defaultName(String templateName) {
        String base = (templateName == null || templateName.isBlank()) ? "未命名模板" : templateName.trim();
        return base + " · 草稿";
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return "";
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String shortUuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
