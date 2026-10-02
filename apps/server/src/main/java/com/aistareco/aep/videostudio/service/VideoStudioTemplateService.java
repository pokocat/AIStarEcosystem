package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplate;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplateCreateRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplateMaterial;
import com.aistareco.aep.videostudio.model.StudioTemplate;
import com.aistareco.aep.videostudio.repository.StudioTemplateRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 视频生成区的模板 / 做同款（docs/video-studio-plan.md §10）。
 *
 * <p>普通用户存的模板只有自己能看能用；运营（{@code aep_users.operatorRole} ∈ operator / super_admin，
 * **查库判定**，不信前端）可以发布全员可见的官方模板。删除 / 撤回都是软删。
 *
 * <p>配方（{@link TemplateRecipe}）只拷「怎么做」：模式、最终提示词、规格、种子、模型、素材 key。
 * **不拷运行痕迹**（任务状态、错误、积分、外部任务号 —— §8.0.1 ⑪ 的教训：只剥产物不剥凭据，
 * 别人打开就会去接作者那次运行）。素材不复制文件，直接引用原作的 key；成片 / 封面存 key，出 wire 现签。
 */
@Service
public class VideoStudioTemplateService {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioTemplateService.class);

    static final int LIST_LIMIT = 100;
    static final int TITLE_MAX_CHARS = 40;
    static final int DESCRIPTION_MAX_CHARS = 200;

    /** 复刻配方（存在 recipe_json 里，服务端内部格式）。 */
    public record TemplateRecipe(String mode, String prompt, String resolutionTier, String aspectRatio, int seconds,
                                 Long seed, String endpointId, String modelName, List<Material> materials) {
        /** role：first_frame / last_frame / reference。 */
        public record Material(String role, String mediaType, String key, String label) {}
    }

    private final StudioTemplateRepository repo;
    private final MaterialVideoJobRepository jobRepo;
    private final FileStorageService fileStorage;
    private final InAppOperatorGuard operators;
    private final ObjectMapper om;

    public VideoStudioTemplateService(StudioTemplateRepository repo,
                                      MaterialVideoJobRepository jobRepo,
                                      FileStorageService fileStorage,
                                      InAppOperatorGuard operators,
                                      ObjectMapper om) {
        this.repo = repo;
        this.jobRepo = jobRepo;
        this.fileStorage = fileStorage;
        this.operators = operators;
        this.om = om;
    }

    // ── 存模板 ────────────────────────────────────────────────────────────────

    @Transactional
    public VideoStudioTemplate create(String userId, VideoStudioTemplateCreateRequest req) {
        if (req == null) throw invalid("请选择要存成模板的作品");
        MaterialVideoJob job = req.jobId() == null ? null : jobRepo.findById(req.jobId())
                .filter(j -> userId.equals(j.getOwnerUserId()))
                .filter(j -> MaterialVideoJobService.APP_VIDEO_STUDIO.equals(j.getApp()))
                .orElse(null);
        if (job == null) throw invalid("只能把自己在这里生成的作品存成模板");
        if (!"succeeded".equals(job.getStatus())) throw invalid("只能把已经生成成功的作品存成模板");

        String title = VideoStudioService.stripBlank(req.title());
        int titleChars = title.codePointCount(0, title.length());
        if (titleChars < 1 || titleChars > TITLE_MAX_CHARS) {
            throw invalid("模板标题要 1 到 " + TITLE_MAX_CHARS + " 个字，现在是 " + titleChars + " 个字");
        }
        String description = VideoStudioService.stripBlank(req.description());
        int descChars = description.codePointCount(0, description.length());
        if (descChars > DESCRIPTION_MAX_CHARS) {
            throw invalid("模板说明最多 " + DESCRIPTION_MAX_CHARS + " 个字，现在是 " + descChars + " 个字");
        }

        boolean official = Boolean.TRUE.equals(req.official());
        if (official && !operators.isOperatorUserId(userId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "VIDEO_STUDIO_TEMPLATE_FORBIDDEN",
                    "只有运营账号能发布官方模板，可以先存成只有自己可见的模板");
        }

        Instant now = Instant.now();
        StudioTemplate t = StudioTemplate.builder()
                .id("vst_" + UUID.randomUUID().toString().replace("-", "").substring(0, 24))
                .ownerUserId(userId)
                .scope(official ? StudioTemplate.SCOPE_OFFICIAL : StudioTemplate.SCOPE_PRIVATE)
                .status(StudioTemplate.STATUS_ACTIVE)
                .title(title)
                .description(description.isEmpty() ? null : description)
                .sourceJobId(job.getId())
                .recipeJson(write(recipeOf(job)))
                .previewVideoKey(fileStorage.keyOfStoredUrl(job.getVideoUrl()))
                .previewThumbnailKey(fileStorage.keyOfStoredUrl(job.getThumbnailUrl()))
                .useCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(t);
        log.info("[video-studio] 存模板 user={} template={} scope={} job={}", userId, t.getId(), t.getScope(), job.getId());
        return toDto(t, userId);
    }

    /** 从一条成功的任务抄出复刻配方（只抄「怎么做」，不抄运行痕迹）。 */
    TemplateRecipe recipeOf(MaterialVideoJob job) {
        JsonNode vc = readTree(job.getVariantConfigJson());
        VideoGenSpec spec = VideoGenSpec.fromVariantConfig(vc);
        List<TemplateRecipe.Material> materials = new ArrayList<>();
        if (spec.firstFrameKey() != null) {
            materials.add(new TemplateRecipe.Material("first_frame", JusuanH3Contract.MEDIA_IMAGE, spec.firstFrameKey(), "首帧"));
        }
        if (spec.lastFrameKey() != null) {
            materials.add(new TemplateRecipe.Material("last_frame", JusuanH3Contract.MEDIA_IMAGE, spec.lastFrameKey(), "尾帧"));
        }
        List<String> labels = VideoGenSpec.referenceLabels(spec.references());
        for (int i = 0; i < spec.references().size(); i++) {
            VideoGenSpec.Reference r = spec.references().get(i);
            materials.add(new TemplateRecipe.Material("reference", r.mediaType(), r.key(), labels.get(i)));
        }
        String endpointId = vc == null ? null : textOrNull(vc.get("endpoint_id"));
        String modelName = job.getProviderUsed() != null && !job.getProviderUsed().isBlank()
                ? job.getProviderUsed() : job.getModelUsed();
        return new TemplateRecipe(spec.generationMode(), job.getPrompt(), spec.resolutionTier(), job.getAspectRatio(),
                job.getDurationSec(), spec.seed(), endpointId, modelName, materials);
    }

    // ── 查询 / 撤回 ───────────────────────────────────────────────────────────

    /** 在架的官方模板 + 自己的，新 → 旧，最多 {@value #LIST_LIMIT} 条。 */
    @Transactional(readOnly = true)
    public List<VideoStudioTemplate> list(String userId) {
        return repo.findVisible(userId, PageRequest.of(0, LIST_LIMIT)).stream()
                .map(t -> toDto(t, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public VideoStudioTemplate get(String userId, String id) {
        return findVisible(userId, id).map(t -> toDto(t, userId)).orElseThrow(VideoStudioTemplateService::notFound);
    }

    /** 本人的 → 下架；官方的 → 本人或任一运营可撤回；其它一律 404（不告诉别人它存在）。 */
    @Transactional
    public void withdraw(String userId, String id) {
        StudioTemplate t = (id == null ? Optional.<StudioTemplate>empty() : repo.findById(id))
                .filter(StudioTemplate::isActive)
                .orElseThrow(VideoStudioTemplateService::notFound);
        boolean mine = userId != null && userId.equals(t.getOwnerUserId());
        if (!mine && !(t.isOfficial() && operators.isOperatorUserId(userId))) throw notFound();
        t.setStatus(StudioTemplate.STATUS_WITHDRAWN);
        t.setUpdatedAt(Instant.now());
        repo.save(t);
        log.info("[video-studio] 模板下架 template={} scope={} by={} owner={}", t.getId(), t.getScope(), userId,
                t.getOwnerUserId());
    }

    // ── 给提交 / 优化用（做同款的归属闸）──────────────────────────────────────

    /** 当前用户可见的模板：在架，且是官方的或本人的。 */
    public Optional<StudioTemplate> findVisible(String userId, String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        return repo.findById(id)
                .filter(StudioTemplate::isActive)
                .filter(t -> t.isOfficial() || (userId != null && userId.equals(t.getOwnerUserId())));
    }

    /** 模板自带的素材：key → mediaType（做同款时这些 key 可以原样带回，类型必须一致）。 */
    public Map<String, String> materialTypes(StudioTemplate t) {
        Map<String, String> out = new LinkedHashMap<>();
        for (TemplateRecipe.Material m : recipe(t).materials()) {
            if (m.key() != null && m.mediaType() != null) out.put(m.key(), m.mediaType());
        }
        return out;
    }

    /** 做同款建出任务后 +1（单条 UPDATE 自增）。 */
    public void countUse(String templateId) {
        repo.incrementUseCount(templateId);
    }

    // ── 出 wire ──────────────────────────────────────────────────────────────

    VideoStudioTemplate toDto(StudioTemplate t, String userId) {
        TemplateRecipe r = recipe(t);
        List<VideoStudioTemplateMaterial> materials = r.materials().stream()
                .map(m -> new VideoStudioTemplateMaterial(m.role(), m.mediaType(), m.key(), m.label(),
                        fileStorage.signedUrl(m.key())))
                .toList();
        return new VideoStudioTemplate(
                t.getId(),
                t.getScope(),
                t.getTitle(),
                t.getDescription(),
                nz(r.mode()),
                nz(r.prompt()),
                nz(r.resolutionTier()),
                nz(r.aspectRatio()),
                r.seconds(),
                r.seed(),
                r.endpointId(),
                r.modelName(),
                materials,
                fileStorage.signedUrl(t.getPreviewVideoKey()),
                fileStorage.signedUrl(t.getPreviewThumbnailKey()),
                t.getUseCount(),
                userId != null && userId.equals(t.getOwnerUserId()),
                t.getCreatedAt() == null ? null : t.getCreatedAt().toString());
    }

    private TemplateRecipe recipe(StudioTemplate t) {
        try {
            TemplateRecipe r = om.readValue(t.getRecipeJson(), TemplateRecipe.class);
            return r.materials() == null
                    ? new TemplateRecipe(r.mode(), r.prompt(), r.resolutionTier(), r.aspectRatio(), r.seconds(), r.seed(),
                            r.endpointId(), r.modelName(), List.of())
                    : r;
        } catch (Exception e) {
            // 配方是服务端自己写的，读不出来说明库被手工改坏了：当成没有素材的空配方，别让整个列表挂掉。
            log.error("[video-studio] 模板配方读不出来 template={} err={}", t.getId(), e.toString());
            return new TemplateRecipe(null, null, null, null, 0, null, null, null, List.of());
        }
    }

    private String write(Object value) {
        try {
            return om.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("模板配方写不出来", e);
        }
    }

    private JsonNode readTree(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static String textOrNull(JsonNode n) {
        return n == null || n.isNull() || !n.isValueNode() || n.asText().isBlank() ? null : n.asText();
    }

    private static BusinessException invalid(String message) {
        return BusinessException.badRequest("VIDEO_STUDIO_TEMPLATE_INVALID", message);
    }

    private static BusinessException notFound() {
        return BusinessException.notFound("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", "没有找到这个模板，可能已经下架了");
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
