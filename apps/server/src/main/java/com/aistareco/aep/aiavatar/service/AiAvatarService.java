package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.dto.*;
import com.aistareco.aep.aiavatar.model.*;
import com.aistareco.aep.aiavatar.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * AiAvatar 资产核心服务（任务书 §3 状态机 + §7 7 步链路）。
 *
 * 7 步：打样 → 草稿迭代 → 精调 → 模板美化出图 → 定稿 → 衍生 → 入库。
 * 每个生成动作转交 {@link AiAvatarJobService} 异步执行，并通过 input._advanceStatusTo 让 runner 推进状态机。
 */
@Service
public class AiAvatarService {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarService.class);

    private final AiAvatarRepository avatarRepo;
    private final AiAvatarVersionRepository versionRepo;
    private final AiAvatarAssetRepository assetRepo;
    private final AiAvatarSourceMaterialRepository sourceRepo;
    private final AiAvatarRefineEditRepository refineRepo;
    private final AiAvatarJobRepository jobRepo;
    private final AiAvatarJobService jobService;
    private final AiAvatarAssetService assetService;
    private final AiAvatarLicenseService licenseService;
    private final AiAvatarTemplateService templateService;
    private final ObjectMapper mapper;

    public AiAvatarService(AiAvatarRepository avatarRepo, AiAvatarVersionRepository versionRepo,
                           AiAvatarAssetRepository assetRepo, AiAvatarSourceMaterialRepository sourceRepo,
                           AiAvatarRefineEditRepository refineRepo, AiAvatarJobRepository jobRepo,
                           AiAvatarJobService jobService, AiAvatarAssetService assetService,
                           AiAvatarLicenseService licenseService, AiAvatarTemplateService templateService,
                           ObjectMapper mapper) {
        this.avatarRepo = avatarRepo;
        this.versionRepo = versionRepo;
        this.assetRepo = assetRepo;
        this.sourceRepo = sourceRepo;
        this.refineRepo = refineRepo;
        this.jobRepo = jobRepo;
        this.jobService = jobService;
        this.assetService = assetService;
        this.licenseService = licenseService;
        this.templateService = templateService;
        this.mapper = mapper;
    }

    // ── 资产 CRUD ────────────────────────────────────────────────────────────

    public AiAvatar create(String userId, AiAvatarRequests.CreateAvatar in) {
        if (in.name() == null || in.name().isBlank()) {
            throw BusinessException.badRequest("AIAVATAR_NAME_REQUIRED", "AiAvatar名称必填");
        }
        AiAvatar a = AiAvatar.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(userId)
                .name(in.name())
                .mode(in.mode() == null ? AiAvatarCreationMode.AI_ORIGINAL : in.mode())
                .status(AiAvatarStatus.DRAFT)
                .persona(in.persona())
                .styleCategory(in.styleCategory())
                .tags(in.tags() == null ? List.of() : in.tags())
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        return avatarRepo.save(a);
    }

    public List<AiAvatarDto> listForUser(String userId) {
        return avatarRepo.findByOwnerUserIdOrderByUpdatedAtDesc(userId)
                .stream().map(this::toCardDto).toList();
    }

    public AiAvatar requireOwned(String avatarId, String userId) {
        return avatarRepo.findByIdAndOwnerUserId(avatarId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_AVATAR_NOT_FOUND", "AiAvatar不存在"));
    }

    public AiAvatar update(String avatarId, String userId, AiAvatarRequests.UpdateAvatar in) {
        AiAvatar a = requireOwned(avatarId, userId);
        if (in.name() != null && !in.name().isBlank()) a.setName(in.name());
        if (in.persona() != null) a.setPersona(in.persona());
        if (in.styleCategory() != null) a.setStyleCategory(in.styleCategory());
        if (in.tags() != null) a.setTags(in.tags());
        a.setUpdatedAt(OffsetDateTime.now());
        return avatarRepo.save(a);
    }

    public void archive(String avatarId, String userId) {
        AiAvatar a = requireOwned(avatarId, userId);
        transitionInternal(a, AiAvatarStatus.ARCHIVED);
        a.setArchivedAt(OffsetDateTime.now());
        avatarRepo.save(a);
    }

    /** 另存为新AiAvatar（任务书 §7 资产详情）。复制定稿版本的资产引用，状态回到 finalized_2d。 */
    public AiAvatar fork(String avatarId, String userId, String newName) {
        AiAvatar src = requireOwned(avatarId, userId);
        AiAvatar copy = AiAvatar.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(userId)
                .name(newName != null && !newName.isBlank() ? newName : src.getName() + " 副本")
                .mode(src.getMode())
                .status(AiAvatarStatus.DRAFT)
                .persona(src.getPersona())
                .personaStructuredJson(src.getPersonaStructuredJson())
                .styleCategory(src.getStyleCategory())
                .tags(new ArrayList<>(src.getTags() == null ? List.of() : src.getTags()))
                .forkedFromAvatarId(src.getId())
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        avatarRepo.save(copy);
        log.info("[aiavatar] fork avatar {} -> {}", src.getId(), copy.getId());
        return copy;
    }

    // ── 状态机 ───────────────────────────────────────────────────────────────

    public AiAvatar transition(String avatarId, String userId, AiAvatarStatus target) {
        AiAvatar a = requireOwned(avatarId, userId);
        transitionInternal(a, target);
        a.setUpdatedAt(OffsetDateTime.now());
        return avatarRepo.save(a);
    }

    private void transitionInternal(AiAvatar a, AiAvatarStatus target) {
        if (!a.getStatus().canTransitionTo(target)) {
            throw BusinessException.badRequest("AIAVATAR_ILLEGAL_TRANSITION",
                    "非法状态跃迁：" + a.getStatus().label() + " → " + target.label());
        }
        a.setStatus(target);
    }

    // ── 素材 / 授权 ────────────────────────────────────────────────────────────

    public AiAvatarSourceMaterial addText(String avatarId, String userId, AiAvatarRequests.AddSourceText in) {
        requireOwned(avatarId, userId);
        AiAvatarSourceMaterial m = AiAvatarSourceMaterial.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .kind(in.kind() == null ? "text" : in.kind())
                .text(in.text())
                .createdAt(OffsetDateTime.now())
                .build();
        return sourceRepo.save(m);
    }

    /** 真人照片上传 + 记录素材 + 触发合规检测任务。 */
    public AiAvatarSourceMaterial addSourcePhoto(String avatarId, String userId,
                                           org.springframework.web.multipart.MultipartFile file,
                                           boolean runFaceCheck) {
        AiAvatar a = requireOwned(avatarId, userId);
        AiAvatarAsset asset = assetService.uploadSourcePhoto(userId, avatarId, file);
        AiAvatarSourceMaterial m = AiAvatarSourceMaterial.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .kind("photo")
                .assetId(asset.getId())
                .createdAt(OffsetDateTime.now())
                .build();
        sourceRepo.save(m);

        if (runFaceCheck) {
            ObjectNode input = mapper.createObjectNode();
            input.put("assetId", asset.getId());
            input.put("sourceMaterialId", m.getId());
            jobService.createAndDispatch(userId, avatarId, AiAvatarCapability.FACE_DETECT,
                    "人脸合规检测", input, 1, null);
        }
        a.setUpdatedAt(OffsetDateTime.now());
        avatarRepo.save(a);
        return m;
    }

    public AiAvatarLicenseGrant signLicense(String avatarId, String userId, AiAvatarRequests.SignLicense in) {
        requireOwned(avatarId, userId);
        return licenseService.sign(userId, avatarId, in);
    }

    // ── 7 步生成动作（都转 AiAvatarJobService 异步）─────────────────────────────────────

    /** Step 1 打样：真人=faceClone，AI=txt2img；一次 3~5 版 → 状态 sampling。 */
    public AiAvatarJob startSampling(String avatarId, String userId, AiAvatarRequests.SubmitJob req) {
        AiAvatar a = requireOwned(avatarId, userId);
        AiAvatarRequests.SubmitJob body = req == null
                ? new AiAvatarRequests.SubmitJob(null, null, null, null, null, null, null, null, null)
                : req;
        AiAvatarCapability cap = a.getMode() == AiAvatarCreationMode.REAL_CLONE ? AiAvatarCapability.FACE_CLONE : AiAvatarCapability.TXT2IMG;
        ObjectNode input = baseInput(body);
        input.put("kind", "sampling");
        int variants = body.variants() == null ? 3 : Math.max(1, Math.min(5, body.variants()));
        input.put("variants", variants);
        input.put("_advanceStatusTo", AiAvatarStatus.SAMPLING.wire());
        attachPersona(input, a);

        String batch = batchId();
        String nluPrompt = input.hasNonNull("prompt") ? input.get("prompt").asText() : null;
        if (a.getMode() == AiAvatarCreationMode.AI_ORIGINAL && nluPrompt != null && !nluPrompt.isBlank()) {
            ObjectNode nluInput = mapper.createObjectNode();
            nluInput.put("kind", "nlu");
            nluInput.put("prompt", nluPrompt);
            if (a.getStyleCategory() != null) nluInput.put("styleCategory", a.getStyleCategory());
            jobService.createAndDispatch(userId, avatarId, AiAvatarCapability.NLU, "人设解析", nluInput, 1, batch);
        }
        return jobService.createAndDispatch(userId, avatarId, cap, "打样", input,
                variants, batch);
    }

    /** Step 2 草稿迭代：自然语言指令 img2img → 状态 draft_iterating。 */
    public AiAvatarJob startDraftIterate(String avatarId, String userId, AiAvatarRequests.SubmitJob req) {
        AiAvatar a = requireOwned(avatarId, userId);
        ensureNotFrozen(a);
        ObjectNode input = baseInput(req);
        input.put("kind", "draft");
        input.put("_advanceStatusTo", AiAvatarStatus.DRAFT_ITERATING.wire());
        int variants = req.variants() == null ? 2 : Math.max(1, Math.min(4, req.variants()));
        input.put("variants", variants);
        return jobService.createAndDispatch(userId, avatarId, AiAvatarCapability.IMG2IMG, "草稿迭代", input, variants, null);
    }

    /** Step 3 精调-外观编辑（妆容 / 发型 / 肤质 / 服饰 / 局部重绘）→ 状态 refining。 */
    public AiAvatarJob startAppearanceRefine(String avatarId, String userId, AiAvatarCapability cap, AiAvatarRequests.SubmitJob req) {
        AiAvatar a = requireOwned(avatarId, userId);
        ensureNotFrozen(a);
        if (cap != AiAvatarCapability.MAKEUP && cap != AiAvatarCapability.HAIR && cap != AiAvatarCapability.RESTORE
                && cap != AiAvatarCapability.INPAINT && cap != AiAvatarCapability.IMG2IMG) {
            throw BusinessException.badRequest("AIAVATAR_BAD_CAPABILITY", "精调能力不支持：" + cap.wire());
        }
        ObjectNode input = baseInput(req);
        input.put("kind", "refine");
        input.put("_advanceStatusTo", AiAvatarStatus.REFINING.wire());
        AiAvatarJob job = jobService.createAndDispatch(userId, avatarId, cap, "精调-" + cap.label(), input, 1, null);
        // 记录 refine edit（关联 job）
        AiAvatarRefineEdit edit = AiAvatarRefineEdit.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .kind(AiAvatarRefineKind.APPEARANCE)
                .paramsJson(req.params() == null ? null : req.params().toString())
                .beforeAssetId(req.baseAssetId())
                .jobId(job.getId())
                .note(req.note())
                .createdAt(OffsetDateTime.now())
                .build();
        refineRepo.save(edit);
        return job;
    }

    /** Step 3 精调-局部框选重绘（SAM mask + inpaint）。 */
    public AiAvatarJob startRegionInpaint(String avatarId, String userId, AiAvatarRequests.SubmitJob req) {
        AiAvatar a = requireOwned(avatarId, userId);
        ensureNotFrozen(a);
        ObjectNode input = baseInput(req);
        input.put("kind", "refine");
        input.put("_advanceStatusTo", AiAvatarStatus.REFINING.wire());
        return jobService.createAndDispatch(userId, avatarId, AiAvatarCapability.INPAINT, "局部重绘", input, 1, null);
    }

    /**
     * Step 3 精调-几何微调（真实形变在前端 canvas 完成）：前端把形变后图片作为 asset 上传，
     * 这里记录 RefineEdit + 滑块参数，并立即生成新版本（同步，不走异步 Provider）。
     */
    public AiAvatarVersion recordGeometryRefine(String avatarId, String userId, AiAvatarRequests.GeometryRefine in) {
        AiAvatar a = requireOwned(avatarId, userId);
        ensureNotFrozen(a);
        if (in.afterAssetId() == null) {
            throw BusinessException.badRequest("AIAVATAR_GEOMETRY_ASSET_REQUIRED", "缺少形变结果图");
        }
        AiAvatarAsset after = assetService.requireOwned(in.afterAssetId(), userId);

        if (a.getStatus().canTransitionTo(AiAvatarStatus.REFINING)) {
            a.setStatus(AiAvatarStatus.REFINING);
        }
        int nextNo = versionRepo.findTopByAvatarIdOrderByVersionNoDesc(avatarId)
                .map(v -> v.getVersionNo() + 1).orElse(1);
        AiAvatarVersion ver = AiAvatarVersion.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .versionNo(nextNo)
                .label("几何微调")
                .note(in.note() == null ? "瘦脸/眼睛/鼻梁/脸型/嘴型" : in.note())
                .author(userId)
                .sourceStatus(a.getStatus())
                .paramsJson(in.params() == null ? null : in.params().toString())
                .previewAssetId(after.getId())
                .assetIds(List.of(after.getId()))
                .createdAt(OffsetDateTime.now())
                .build();
        versionRepo.save(ver);
        after.setVersionId(ver.getId());
        assetRepo.save(after);

        refineRepo.save(AiAvatarRefineEdit.builder()
                .id(UUID.randomUUID().toString())
                .avatarId(avatarId)
                .ownerUserId(userId)
                .versionId(ver.getId())
                .kind(AiAvatarRefineKind.GEOMETRY)
                .paramsJson(in.params() == null ? null : in.params().toString())
                .beforeAssetId(in.beforeAssetId())
                .afterAssetId(after.getId())
                .note(in.note())
                .createdAt(OffsetDateTime.now())
                .build());

        a.setCurrentVersionId(ver.getId());
        a.setUpdatedAt(OffsetDateTime.now());
        avatarRepo.save(a);
        return ver;
    }

    /** Step 4 模板美化&标准出图：选模板 + 标准构图，批量出固定规格图集 → refining/pending_finalize。 */
    public AiAvatarJob startTemplateBeautify(String avatarId, String userId, AiAvatarRequests.SubmitJob req) {
        AiAvatar a = requireOwned(avatarId, userId);
        ensureNotFrozen(a);
        ObjectNode input = baseInput(req);
        input.put("kind", "beautify");
        applyStoryboardStandardShots(input);
        // 无分镜入参时回退到旧的标准 4 图集 + 表情图。
        if (!input.has("standardShots")) {
            var arr = input.putArray("standardShots");
            for (AiAvatarStandardShot s : AiAvatarStandardShot.values()) arr.add(s.wire());
        }
        if (req.templateId() != null) {
            AiAvatarTemplate t = templateService.requireById(req.templateId());
            input.put("templateId", t.getId());
            if (t.getParamsJson() != null) {
                try { input.set("templateParams", mapper.readTree(t.getParamsJson())); } catch (Exception ignore) {}
            }
            templateService.bumpUsage(t.getId());
        }
        input.put("_advanceStatusTo", AiAvatarStatus.PENDING_FINALIZE.wire());
        int shots = input.get("standardShots").size();
        return jobService.createAndDispatch(userId, avatarId, AiAvatarCapability.RESTORE, "模板美化出图", input, shots, batchId());
    }

    /** Step 5 定稿确认：锁定版本，置 finalized_2d，冻结草稿链路。 */
    public AiAvatar finalize(String avatarId, String userId, AiAvatarRequests.Finalize in) {
        AiAvatar a = requireOwned(avatarId, userId);
        // 真人路径需有效授权
        if (a.getMode() == AiAvatarCreationMode.REAL_CLONE && !licenseService.hasActiveLicense(avatarId)) {
            throw BusinessException.badRequest("AIAVATAR_LICENSE_REQUIRED", "真人复刻定稿前需先签署有效肖像授权");
        }
        String versionId = in.versionId() != null ? in.versionId() : a.getCurrentVersionId();
        if (versionId == null) {
            throw BusinessException.badRequest("AIAVATAR_NO_VERSION", "尚无可定稿的版本");
        }
        AiAvatarVersion ver = versionRepo.findByIdAndOwnerUserId(versionId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_VERSION_NOT_FOUND", "版本不存在"));
        ver.setPreferred(true);
        versionRepo.save(ver);

        transitionInternal(a, AiAvatarStatus.FINALIZED_2D);
        a.setFinalizedVersionId(versionId);
        a.setCurrentVersionId(versionId);
        a.setUpdatedAt(OffsetDateTime.now());
        return avatarRepo.save(a);
    }

    /** Step 6 衍生：3D（img23d）/ 视频（img2video）。需已定稿。 */
    public List<AiAvatarJob> derive(String avatarId, String userId, AiAvatarRequests.Derive in) {
        AiAvatar a = requireOwned(avatarId, userId);
        if (!a.getStatus().isFinalizedOrLater()) {
            throw BusinessException.badRequest("AIAVATAR_NOT_FINALIZED", "请先定稿再进行衍生");
        }
        if (in.capabilities() == null || in.capabilities().isEmpty()) {
            throw BusinessException.badRequest("AIAVATAR_DERIVE_EMPTY", "未指定衍生类型");
        }
        transitionInternal(a, AiAvatarStatus.DERIVING);
        a.setUpdatedAt(OffsetDateTime.now());
        avatarRepo.save(a);

        String batch = batchId();
        List<AiAvatarJob> jobs = new ArrayList<>();
        for (AiAvatarCapability cap : in.capabilities()) {
            if (cap != AiAvatarCapability.IMG23D && cap != AiAvatarCapability.IMG2VIDEO) continue;
            ObjectNode input = mapper.createObjectNode();
            input.put("kind", "derive");
            input.put("capability", cap.wire());
            if (in.baseAssetId() != null) input.put("baseAssetId", in.baseAssetId());
            if (in.videoDurationSec() != null) input.put("videoDurationSec", in.videoDurationSec());
            if (in.params() != null) input.set("params", in.params());
            // 衍生完成保持 deriving；用户可继续/归档
            jobs.add(jobService.createAndDispatch(userId, avatarId, cap,
                    cap == AiAvatarCapability.IMG23D ? "衍生 3D" : "衍生视频", input, 1, batch));
        }
        return jobs;
    }

    /** Step 7 入库归档。 */
    public AiAvatar archiveFinal(String avatarId, String userId) {
        AiAvatar a = requireOwned(avatarId, userId);
        transitionInternal(a, AiAvatarStatus.ARCHIVED);
        a.setArchivedAt(OffsetDateTime.now());
        a.setUpdatedAt(OffsetDateTime.now());
        return avatarRepo.save(a);
    }

    // ── 版本管理 ───────────────────────────────────────────────────────────────

    public List<AiAvatarVersionDto> listVersions(String avatarId, String userId) {
        requireOwned(avatarId, userId);
        return versionRepo.findByAvatarIdOrderByVersionNoAsc(avatarId)
                .stream().map(this::toVersionDto).toList();
    }

    public AiAvatarVersion markVersion(String avatarId, String userId, String versionId,
                                       Boolean preferred, Boolean discarded) {
        requireOwned(avatarId, userId);
        AiAvatarVersion v = versionRepo.findByIdAndOwnerUserId(versionId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_VERSION_NOT_FOUND", "版本不存在"));
        if (preferred != null) v.setPreferred(preferred);
        if (discarded != null) v.setDiscarded(discarded);
        return versionRepo.save(v);
    }

    /** 回退到某版本（设为当前版本）。 */
    public AiAvatar revertToVersion(String avatarId, String userId, String versionId) {
        AiAvatar a = requireOwned(avatarId, userId);
        AiAvatarVersion v = versionRepo.findByIdAndOwnerUserId(versionId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_VERSION_NOT_FOUND", "版本不存在"));
        a.setCurrentVersionId(v.getId());
        a.setUpdatedAt(OffsetDateTime.now());
        return avatarRepo.save(a);
    }

    // ── 详情聚合 ───────────────────────────────────────────────────────────────

    public AiAvatarDetailDto detail(String avatarId, String userId) {
        AiAvatar a = requireOwned(avatarId, userId);
        List<AiAvatarVersionDto> versions = versionRepo.findByAvatarIdOrderByVersionNoAsc(avatarId)
                .stream().map(this::toVersionDto).toList();
        List<AiAvatarAssetDto> assets = assetRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId)
                .stream().map(assetService::toDto).toList();
        List<AiAvatarSourceMaterialDto> sources = sourceRepo.findByAvatarIdOrderByCreatedAtAsc(avatarId)
                .stream().map(m -> AiAvatarSourceMaterialDto.from(m, mapper, sourcePreviewUrl(m))).toList();
        List<AiAvatarLicenseGrantDto> licenses = licenseService.listForAvatar(avatarId);
        List<AiAvatarRefineEditDto> refines = refineRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId)
                .stream().map(e -> AiAvatarRefineEditDto.from(e, mapper)).toList();
        List<AiAvatarJobDto> jobs = jobService.listForAvatar(avatarId, userId);
        List<String> allowedNext = a.getStatus().allowedNext().stream().map(AiAvatarStatus::wire).toList();
        return new AiAvatarDetailDto(toCardDto(a), versions, assets, sources, licenses, refines, jobs, allowedNext);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void ensureNotFrozen(AiAvatar a) {
        if (a.getStatus().isFinalizedOrLater()) {
            throw BusinessException.badRequest("AIAVATAR_FROZEN", "已定稿，草稿链路已冻结；如需继续编辑请「另存为新AiAvatar」");
        }
    }

    private ObjectNode baseInput(AiAvatarRequests.SubmitJob req) {
        ObjectNode input = mapper.createObjectNode();
        if (req == null) return input;
        if (req.prompt() != null) input.put("prompt", req.prompt());
        if (req.baseAssetId() != null) input.put("baseAssetId", req.baseAssetId());
        if (req.referenceAssetId() != null) input.put("referenceAssetId", req.referenceAssetId());
        if (req.maskAssetId() != null) input.put("maskAssetId", req.maskAssetId());
        if (req.variants() != null) input.put("variants", req.variants());
        if (req.params() != null) input.set("params", req.params());
        // 解析 baseAssetId → baseImageUrl 供 Provider 拉取
        if (req.baseAssetId() != null) {
            assetRepo.findById(req.baseAssetId()).ifPresent(as -> input.put("baseImageUrl", as.getFileUrl()));
        }
        return input;
    }

    private void applyStoryboardStandardShots(ObjectNode input) {
        JsonNode storyboard = input.at("/params/storyboard");
        if (storyboard == null || storyboard.isMissingNode() || !storyboard.path("shots").isArray()) {
            return;
        }
        input.set("storyboard", storyboard);
        JsonNode negativePrompt = storyboard.path("negativePrompt");
        if (negativePrompt.isTextual()) {
            input.put("negativePrompt", negativePrompt.asText());
        }
        var arr = input.putArray("standardShots");
        for (JsonNode shot : storyboard.path("shots")) {
            String wire = shot.path("standardShot").asText(AiAvatarStandardShot.FRONT_BUST.wire());
            arr.add(AiAvatarStandardShot.fromWire(wire).wire());
        }
        if (arr.size() == 0) {
            input.remove("standardShots");
        }
    }

    private void attachPersona(ObjectNode input, AiAvatar a) {
        if (a.getPersona() != null && !input.has("prompt")) {
            input.put("prompt", a.getPersona());
        }
        if (a.getStyleCategory() != null) input.put("styleCategory", a.getStyleCategory());
    }

    private String batchId() {
        return "dhbatch-" + UUID.randomUUID().toString().substring(0, 12);
    }

    private String assetUrl(String assetId) {
        if (assetId == null) return null;
        return assetRepo.findById(assetId).map(AiAvatarAsset::getFileUrl).orElse(null);
    }

    private String sourcePreviewUrl(AiAvatarSourceMaterial m) {
        if (m.getAssetId() == null) return null;
        return assetRepo.findById(m.getAssetId()).map(AiAvatarAsset::getThumbnailUrl).orElse(null);
    }

    public AiAvatarDto toCardDto(AiAvatar a) {
        return AiAvatarDto.from(a, mapper, assetUrl(a.getCoverAssetId()));
    }

    public AiAvatarVersionDto toVersionDto(AiAvatarVersion v) {
        return AiAvatarVersionDto.from(v, mapper, assetUrl(v.getPreviewAssetId()));
    }
}
