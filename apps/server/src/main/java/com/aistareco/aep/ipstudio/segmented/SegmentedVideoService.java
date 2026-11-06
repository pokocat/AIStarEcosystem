package com.aistareco.aep.ipstudio.segmented;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.PlanExecution;
import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.*;
import com.aistareco.aep.ipstudio.execution.StudioPlanExecutionService;
import com.aistareco.aep.ipstudio.execution.StudioPlanQuoter;
import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.ipstudio.service.StudioVisualContext;
import com.aistareco.aep.model.AiImageRequestSpec;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * AI 视频页的长视频：比模型单段上限长的视频一键做到成片（docs/studio-segmented-video.md）。
 *
 * <p>流程照导演台：分段脚本 → 审脚本 → 分镜图 → 审分镜图 → 全能参考出片 → 合成。这里只生成计划和报价，
 * 跑计划、暂停恢复、重启接续、结算都是现成的连续制作（{@code StudioPlanExecutor}），各步的提示词在执行到那一步时才编
 * （脚本写完才有内容，见 {@code StudioSegmentedRun}）。
 */
@Service
public class SegmentedVideoService {
    /** 一条视频最长多少秒（AI 视频页的时长滑杆）。 */
    public static final int MAX_TOTAL_SECONDS = 60;
    private static final String SKILL = "video-generation";
    /** 分镜图查这两项（出视频方法的检查清单，时长和顺序查不了图）。 */
    private static final List<String> BOARD_CHECKS = List.of("subject-consistency", "scene-and-action");
    private static final String REFERENCE_MODE = "reference", FRAME_MODE = "frame";

    private final StudioVideoService videos;
    private final AiAppSceneModelPolicyService scenePolicies;
    private final DapPricingService pricing;
    private final StudioPlanQuoter quoter;
    private final StudioPlanExecutionService executions;
    private final IpProjectService projects;
    private final StudioSkillRules skills;
    private final StudioFixtureProvider fixtures;
    private final StudioSceneCatalog catalog;
    private final ObjectMapper mapper;

    public SegmentedVideoService(StudioVideoService videos, AiAppSceneModelPolicyService scenePolicies, DapPricingService pricing, StudioPlanQuoter quoter,
                                 StudioPlanExecutionService executions, IpProjectService projects, StudioSkillRules skills, StudioFixtureProvider fixtures, StudioSceneCatalog catalog, ObjectMapper mapper) {
        this.videos = videos; this.scenePolicies = scenePolicies; this.pricing = pricing; this.quoter = quoter;
        this.executions = executions; this.projects = projects; this.skills = skills; this.fixtures = fixtures; this.catalog = catalog; this.mapper = mapper;
    }

    /** 页面上的价：只按段数、张数算，不碰素材文件。 */
    public SegmentedVideoPrice price(String userId, String model, String tier, int duration, String ratio, int images, boolean character, boolean voice, boolean optimize) {
        List<SegmentedMaterial> materials = new ArrayList<>();
        for (int i = 0; i < Math.min(images, 12); i++) materials.add(new SegmentedMaterial("m" + i, "素材", "image"));
        if (character) materials.add(new SegmentedMaterial("character", "出镜人物", "character"));
        if (voice) materials.add(new SegmentedMaterial("voice", "声音", "voice"));
        return summarize(userId, build(userId, model, tier, duration, ratio, optimize, materials));
    }

    @Transactional
    public PlanExecution start(String userId, String projectId, SegmentedVideoRequest req) {
        if (req == null || req.clientRequestId() == null || !req.clientRequestId().matches("[A-Za-z0-9_-]{1,64}")) throw invalid("请求编号无效");
        if (req.sceneId() == null || req.sceneId().isBlank()) throw invalid("请选择场景");
        if (req.text() != null && req.text().length() > 16000) throw invalid("要求最多 16000 字");
        int duration = req.duration() == null ? 0 : req.duration();
        String ratio = req.ratio() == null ? "9:16" : req.ratio();
        List<SegmentedMaterial> materials = req.materials() == null ? List.of() : req.materials();
        var project = projects.required(userId, projectId);
        JsonNode doc = projects.readDoc(project);
        for (SegmentedMaterial m : materials) {
            if (!Set.of("image", "character", "voice").contains(String.valueOf(m.slot()))) throw invalid("素材类型不对");
            JsonNode node = m.nodeId() == null ? null : IpDocs.node(doc, m.nodeId());
            String key = node == null ? null : IpDocs.primaryStorageKey(node);
            if (key == null) throw invalid("「" + m.title() + "」不在这张画布上了，请重新放一次");
            projects.requireOwnedAssetKey(userId, key);
        }
        boolean optimize = !Boolean.FALSE.equals(req.optimize());
        Built built = build(userId, req.model(), req.tier(), duration, ratio, optimize, materials);
        SegmentedVideoPrice price = summarize(userId, built);
        if (req.budgetCap() == null || req.budgetCap() < price.cap())
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_PRICE_CHANGED", "价格有变化，这条最多要 " + price.cap() + " 积分。请看一眼新价格再点一次",
                    Map.of("cap", price.cap()));
        // 脚本步骤的输入：素材按写脚本时的编号（场景图在前，出镜人物在后）。
        List<String> imageTitles = materials.stream().filter(m -> "image".equals(m.slot())).map(SegmentedMaterial::title).toList();
        String characterTitle = materials.stream().filter(m -> "character".equals(m.slot())).map(SegmentedMaterial::title).findFirst().orElse(null);
        String voiceTitle = materials.stream().filter(m -> "voice".equals(m.slot())).map(SegmentedMaterial::title).findFirst().orElse(null);
        var compose = new StudioSceneCatalog.ComposeRequest("video-script", req.sceneId(), req.text() == null ? "" : req.text(), null, null, imageTitles, characterTitle, voiceTitle, null,
                duration, ratio, req.language() == null || req.language().isBlank() ? "中文" : req.language(), null, req.options(), null, null, built.visual(), null);
        // 场景要求的素材和文字这里就查：写脚本那一步才发现缺东西，用户已经走开了。
        catalog.segmentedScript(compose, List.of(), false, false, false, null);
        ObjectNode state = mapper.createObjectNode().put("mode", built.mode()).put("hasScript", Boolean.TRUE.equals(req.hasScript())).put("visual", built.visual())
                .put("ratio", ratio).put("refCount", imageTitles.size() + (characterTitle == null ? 0 : 1)).put("audioRefs", built.audioRefs());
        state.set("compose", mapper.valueToTree(compose));
        state.set("segments", mapper.valueToTree(built.segments()));
        state.set("materials", mapper.valueToTree(materials));
        ArrayList<String> context = new ArrayList<>();
        materials.forEach(m -> context.add(m.nodeId()));
        // 同一个请求编号再交一次（确认原任务）按请求内容比，不按报价比：价格变了也要返回原来那次。
        ObjectNode identity = mapper.valueToTree(req);
        identity.remove("budgetCap");
        return executions.startSegmented(userId, projectId, req.clientRequestId(), built.plan(), state, context, built.rules(), price.cap(), price.cap() - price.estimated(),
                req.billing(), identity);
    }

    // ── 计划 ───────────────────────────────────────────────────────────────

    /** @param visual 写脚本的模型能看图 */
    private record Built(ObjectNode plan, List<SegmentedPlan.Segment> segments, StudioSkillRules.Rules rules, String mode, boolean visual, boolean review, int audioRefs) {}

    private Built build(String userId, String requested, String tier, int duration, String ratio, boolean optimize, List<SegmentedMaterial> materials) {
        if (fixtures.enabled()) throw invalid("测试响应不支持长视频，请关闭测试响应");
        if (duration < 1 || duration > MAX_TOTAL_SECONDS) throw invalid("视频时长要在 " + MAX_TOTAL_SECONDS + " 秒以内");
        VideoStudioModel model = model(requested);
        var contract = model.contract();
        VideoStudioModeSpec reference = contract.modes().stream().filter(m -> m.references() != null && !m.needsFirstFrame() && !m.needsLastFrame()).findFirst().orElse(null);
        VideoStudioModeSpec first = contract.modes().stream().filter(m -> m.needsFirstFrame() && !m.needsLastFrame() && m.references() == null).findFirst().orElse(null);
        if (reference == null && first == null) throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_VIDEO_MODE_UNAVAILABLE", "「" + model.name() + "」用不了分镜图，做不了长视频。请换一个视频模型");
        String mode = reference != null ? REFERENCE_MODE : FRAME_MODE;
        String usedTier = contract.tiers().stream().filter(t -> t.canvases().stream().anyMatch(c -> ratio.equals(c.aspectRatio())))
                .map(t -> t.tier()).filter(t -> tier == null || tier.equals(t)).findFirst()
                .orElseThrow(() -> invalid("「" + model.name() + "」不支持 " + ratio + " 这个画面比例或所选清晰度"));
        List<SegmentedPlan.Segment> segments;
        try {
            segments = SegmentedPlan.segments(duration, contract.minSeconds(), contract.maxSeconds(), FRAME_MODE.equals(mode));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_VIDEO_MODEL_UNAVAILABLE", "所选视频模型还没有可用的时长规格，请换一个模型");
        }
        if (segments.size() > SegmentedPlan.MAX_SEGMENTS)
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_SEGMENTS_TOO_MANY", "「" + model.name() + "」单段最长 " + contract.maxSeconds() + " 秒，" + duration + " 秒要分 " + segments.size() + " 段，太多了。请缩短时长或换单段更长的模型");

        var image = scenePolicies.resolve("studio", "image", scenePolicies.directorImageDefault().orElse(null), pricing.ipImage()).resolved().endpoint();
        var imageSpec = AiImageRequestSpec.read(image.getImageRequestSpecJson());
        String size = boardSize(imageSpec, ratio, image.publicModelName());
        int imageMax = imageSpec == null ? 6 : imageSpec.maxReferenceImages();
        var textEndpoint = scenePolicies.resolve("studio", "script", null, pricing.ipIdentity()).resolved().endpoint();
        boolean vision = StudioVisualContext.supportsVision(textEndpoint);
        var rules = skills.requireActive(SKILL);

        List<SegmentedMaterial> pictures = new ArrayList<>();
        materials.stream().filter(m -> "image".equals(m.slot())).forEach(pictures::add);
        materials.stream().filter(m -> "character".equals(m.slot())).forEach(pictures::add);
        SegmentedMaterial voice = materials.stream().filter(m -> "voice".equals(m.slot())).findFirst().orElse(null);
        int audioRefs = reference != null && voice != null && reference.references().audio() != null && reference.references().audio().maxCount() > 0 ? 1 : 0;

        ObjectNode plan = mapper.createObjectNode().put("skillKey", rules.key()).put("skillVersion", rules.version()).put("stage", "production")
                .put("summary", "按 " + segments.size() + " 段做到成片");
        ArrayNode steps = plan.putArray("steps");
        text(steps, "script", "写分镜脚本", "按要求写分段的分镜脚本", "script", List.of());
        text(steps, "review", "审核脚本", "开拍前审一遍分镜脚本", "review", List.of("script"));
        List<String> videoIds = new ArrayList<>();
        String firstGate = null;
        for (var seg : segments) {
            int k = seg.no();
            String board = "b" + k, check = "c" + k, second = "b" + k + "x", checkSecond = "c" + k + "x";
            List<String> boardDeps = new ArrayList<>(List.of("review"));
            if (k > 1) { boardDeps.add("b1"); if (vision) boardDeps.add("c1"); }
            board(steps, board, "第 " + k + " 段分镜图", k, 0, pictures, k > 1 ? "b1" : null, imageMax, size, ratio, image.getId(), boardDeps);
            if (vision) check(steps, check, board, boardDeps(board), k, 0);
            List<String> videoDeps = new ArrayList<>(List.of(board));
            if (vision) videoDeps.add(check);
            if (seg.boards() > 1) {
                List<String> deps = new ArrayList<>(List.of(board));
                if (vision) deps.add(check);
                board(steps, second, "第 " + k + " 段分镜图（后半）", k, 1, pictures, board, imageMax, size, ratio, image.getId(), deps);
                videoDeps.add(second);
                if (vision) { check(steps, checkSecond, second, boardDeps(second), k, 1); videoDeps.add(checkSecond); }
            }
            video(steps, seg, model, mode, reference, usedTier, ratio, optimize, pictures, voice, audioRefs, videoDeps);
            videoIds.add("v" + k);
        }
        if (segments.size() > 1) assemble(steps, videoIds);
        // 报价和实际提交走同一个编译器（StudioPlanSteps），占位 key 只影响张数不影响价格。
        quoter.quote(userId, plan);
        plan.put("fingerprint", StudioPlanValidator.fingerprint(plan));
        return new Built(plan, segments, rules, mode, vision, vision, audioRefs);
    }

    private static List<String> boardDeps(String board) { return List.of(board); }

    private ObjectNode step(ArrayNode steps, String id, String operation, String title, String prompt, List<String> deps) {
        ObjectNode step = steps.addObject().put("id", id).put("operation", operation).put("title", title).put("prompt", prompt).put("execution", "auto");
        ArrayNode dependsOn = step.putArray("dependsOn");
        deps.forEach(dependsOn::add);
        step.putObject("settings").put("operation", operation);
        return step;
    }

    private void text(ArrayNode steps, String id, String title, String prompt, String kind, List<String> deps) {
        ObjectNode settings = (ObjectNode) step(steps, id, "text", title, prompt, deps).path("settings");
        settings.putObject("editTarget").put("snapshot", "");
        settings.putObject("segmented").put("kind", kind);
    }

    private void board(ArrayNode steps, String id, String title, int segment, int part, List<SegmentedMaterial> pictures, String prior, int imageMax, String size, String ratio, String model, List<String> deps) {
        ObjectNode settings = (ObjectNode) step(steps, id, "image", title, "按分镜脚本出分镜图", deps).path("settings");
        settings.put("size", size).put("aspectRatio", ratio).put("count", 1).put("model", model);
        settings.putObject("segmented").put("kind", "board").put("segment", segment).put("part", part);
        ArrayNode bindings = settings.putArray("referenceBindings");
        List<SegmentedMaterial> used = limited(pictures, imageMax - (prior == null ? 0 : 1));
        int order = 0;
        for (SegmentedMaterial m : used) bindings.addObject().put("nodeId", m.nodeId()).put("role", "reference-image").put("order", ++order);
        if (prior != null && imageMax > 0) bindings.addObject().put("stepId", prior).put("role", "reference-image").put("order", ++order);
    }

    private void check(ArrayNode steps, String id, String target, List<String> deps, int segment, int part) {
        ObjectNode settings = (ObjectNode) step(steps, id, "check", "分镜图检查", "检查这张分镜图", deps).path("settings");
        settings.put("targetStepId", target);
        ArrayNode ids = settings.putArray("checkIds");
        BOARD_CHECKS.forEach(ids::add);
        settings.putObject("segmented").put("kind", "check").put("segment", segment).put("part", part);
    }

    private void video(ArrayNode steps, SegmentedPlan.Segment seg, VideoStudioModel model, String mode, VideoStudioModeSpec reference, String tier, String ratio, boolean optimize,
                       List<SegmentedMaterial> pictures, SegmentedMaterial voice, int audioRefs, List<String> deps) {
        int k = seg.no();
        ObjectNode settings = (ObjectNode) step(steps, "v" + k, "video", "第 " + k + " 段视频", "按分镜脚本出片", deps).path("settings");
        settings.put("durationSec", seg.seconds()).put("aspectRatio", ratio).put("count", 1);
        // 不能按 id 选的模型就是默认那个：不写，提交时走默认（同 AI 视频页的短片）。
        if (model.selectableById()) settings.put("model", model.endpointId());
        ObjectNode video = settings.putObject("video").put("resolutionTier", tier).put("optimize", optimize);
        settings.putObject("segmented").put("kind", "video").put("segment", k);
        ArrayNode bindings = settings.putArray("referenceBindings");
        int order = 0;
        if (FRAME_MODE.equals(mode)) {
            video.put("mode", firstFrameMode(model));
            bindings.addObject().put("stepId", "b" + k).put("role", "frame").put("order", 1);
            return;
        }
        video.put("mode", reference.mode());
        bindings.addObject().put("stepId", "b" + k).put("role", "reference-image").put("order", ++order);
        if (seg.boards() > 1) bindings.addObject().put("stepId", "b" + k + "x").put("role", "reference-image").put("order", ++order);
        int max = reference.references().image() == null ? order : reference.references().image().maxCount();
        for (SegmentedMaterial m : limited(pictures, max - order)) bindings.addObject().put("nodeId", m.nodeId()).put("role", "reference-image").put("order", ++order);
        if (audioRefs > 0) bindings.addObject().put("nodeId", voice.nodeId()).put("role", "reference-audio").put("order", ++order);
    }

    private static String firstFrameMode(VideoStudioModel model) {
        return model.contract().modes().stream().filter(m -> m.needsFirstFrame() && !m.needsLastFrame() && m.references() == null).findFirst().orElseThrow().mode();
    }

    private void assemble(ArrayNode steps, List<String> videoIds) {
        ObjectNode settings = (ObjectNode) step(steps, "film", "assemble", "合成成片", "按段序合成成片", videoIds).path("settings");
        ArrayNode order = settings.putArray("clipOrder");
        videoIds.forEach(id -> order.addObject().put("stepId", id));
    }

    /** 放不下时留出镜人物和排在前面的图（出镜人物排在最后，先去掉中间的）。 */
    private static List<SegmentedMaterial> limited(List<SegmentedMaterial> pictures, int max) {
        if (max <= 0) return List.of();
        if (pictures.size() <= max) return pictures;
        List<SegmentedMaterial> out = new ArrayList<>(pictures.subList(0, max));
        SegmentedMaterial person = pictures.stream().filter(m -> "character".equals(m.slot())).findFirst().orElse(null);
        if (person != null && !out.contains(person)) out.set(max - 1, person);
        return out;
    }

    private VideoStudioModel model(String requested) {
        var models = videos.models();
        var chosen = models.stream().filter(m -> requested == null ? m.isDefault() : requested.equals(m.endpointId())).findFirst()
                .orElse(requested == null && !models.isEmpty() ? models.get(0) : null);
        if (chosen == null || chosen.contract() == null) throw new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_VIDEO_MODEL_UNAVAILABLE", "所选视频模型暂不可用，请换一个模型");
        return chosen;
    }

    /** 分镜图尺寸：同一比例有几档取最大的（宫格要放四格，小图细节糊），只在这一个接入点里挑，同导演台。 */
    private static String boardSize(AiImageRequestSpec spec, String ratio, String name) {
        String fallback = switch (ratio) { case "16:9" -> "1365x768"; case "1:1" -> "1024x1024"; default -> "768x1365"; };
        if (spec == null) return fallback;
        return spec.outputs().stream().filter(o -> ratio.equals(o.aspectRatio())).map(AiImageRequestSpec.Output::canvasSize)
                .max(Comparator.comparingLong(SegmentedVideoService::pixels))
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_IMAGE_SIZE_UNSUPPORTED", "默认图片模型「" + name + "」出不了 " + ratio + " 的分镜图，请换一个画面比例"));
    }

    private static long pixels(String size) {
        String[] parts = size.split("x");
        return parts.length == 2 ? Long.parseLong(parts[0]) * Long.parseLong(parts[1]) : 0;
    }

    private SegmentedVideoPrice summarize(String userId, Built built) {
        long video = 0, board = 0, text = 0, redo = 0;
        int boards = 0;
        for (JsonNode step : built.plan().path("steps")) {
            long cost = step.path("quotedCost").asLong();
            switch (step.path("operation").asText()) {
                case "image" -> { board += cost; boards++; redo += cost; }
                case "check" -> { text += cost; redo += cost; }
                // 视频价只算视频：H3 先改写提示词的冻结上限归到文字那边，页面才不会把它算两遍。
                case "video" -> { long only = quoter.videoOnly(userId, step); video += only; text += cost - only; }
                default -> text += cost;
            }
        }
        List<Integer> segments = built.segments().stream().map(SegmentedPlan.Segment::seconds).toList();
        long estimated = built.plan().path("budget").path("estimated").asLong();
        return new SegmentedVideoPrice(segments, boards, built.review(), video, board, text, estimated, Math.multiplyExact(estimated, 3));
    }

    private static BusinessException invalid(String message) {
        return BusinessException.badRequest("STUDIO_INPUT_INVALID", message);
    }
}
