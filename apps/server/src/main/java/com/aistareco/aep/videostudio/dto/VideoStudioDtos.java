package com.aistareco.aep.videostudio.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * 视频生成区（web-celebrity「AI 创作 → 视频生成」，v0.199）wire DTO。
 *
 * <p>⚠️ 类上的 {@code @JsonInclude(ALWAYS)} 只管 record 自己的字段，**管不到 Map 里的值**：全局 non_null 会把
 * {@code perSecond} 里未定价格子的 null 吞掉（前端拿到 undefined）。所以那两个 Map 字段单独标了 content = ALWAYS，
 * {@code VideoStudioDtosContractTest} 钉着。字段名与
 * {@code packages/types/src/video-studio.ts} 1:1（CLAUDE.md §4.1），设计真源 docs/video-studio-plan.md。
 * {@code VideoStudioDtosContractTest} 直接读 TS 文件逐个 interface 比对字段名。
 *
 * <p>每个 record 都标了 {@code @JsonInclude(ALWAYS)}：全局配置是 {@code non_null}（null 字段直接不出现），
 * 而这份契约里的 {@code T | null} 字段约定的是「给 null」。不标的话服务端发出去的形状和前端 mock
 * （照契约写的）对不上，演示模式验收过了、线上照样坏（§8.0.1 ⑦）。
 *
 * <p>文件字段的 DB 真值一律是 storage key；这里的 {@code url} 都是出 wire 时现签的短期地址，不落库（§4.7）。
 * 取值（模式、素材类型、状态、模板范围）全部小写，与 TS 字面量类型一致。
 */
public final class VideoStudioDtos {

    private VideoStudioDtos() {}

    /** 一个受控画布：比例 + 像素（厂商固定的六种之一）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioCanvas(String aspectRatio, int width, int height) {}

    /** 一档清晰度及其可选画布。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioTier(String tier, List<VideoStudioCanvas> canvases) {}

    /** 某类素材的限制。{@code minDurationSec} / {@code maxDurationSec} 为 null = 不限。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioMediaLimit(String mediaType, int maxCount, long maxBytes, List<String> formats,
                                        Integer minDurationSec, Integer maxDurationSec) {}

    /** 全能参考模式的组合限制。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioReferenceRules(VideoStudioMediaLimit image, VideoStudioMediaLimit video,
                                            VideoStudioMediaLimit audio, int maxImagesWithVideo, int maxTotal,
                                            int minVisual, int maxAudioTotalSec) {}

    /** 某个模式要什么输入。{@code frameImage} / {@code references} 不适用时为 null。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioModeSpec(String mode, boolean needsFirstFrame, boolean needsLastFrame,
                                      VideoStudioMediaLimit frameImage, VideoStudioReferenceRules references) {}

    /** 一个模型的完整合同（服务端下发，前端不写死）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioContract(List<VideoStudioModeSpec> modes, List<VideoStudioTier> tiers,
                                      int minSeconds, int maxSeconds, int promptMaxChars, long seedMax) {}

    /**
     * 下发给用户的计价参数（已把「配置空格子 → 模型每秒价」这层回落算好）。
     * 生成总价 = (perSecond[模式][清晰度] + max(0, 参考图张数 − freeRefImages) × extraRefImagePerSecond) × 秒数；
     * {@code perSecond} 某一格为 null = 这个组合还没定价，不能提交。智能优化每次 promptOptimizationPerCall（0 = 不收费）。
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioPricing(@JsonInclude(value = JsonInclude.Include.ALWAYS, content = JsonInclude.Include.ALWAYS)
                                     Map<String, Map<String, Long>> perSecond,
                                     int freeRefImages, long extraRefImagePerSecond, long promptOptimizationPerCall) {}

    /**
     * 后台「引擎定价 → 视频生成」编辑的配置（GET / PUT /admin/celebrity/video-studio-pricing）。
     * 这里的 null 格子 = 「不单独定价，按后台给模型配的每秒价」。标量用包装类型：PUT 缺了就是 null，
     * 服务端明确 400，而不是悄悄当成 0。
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioPricingConfig(@JsonInclude(value = JsonInclude.Include.ALWAYS, content = JsonInclude.Include.ALWAYS)
                                           Map<String, Map<String, Long>> perSecond,
                                           Integer freeRefImages, Long extraRefImagePerSecond,
                                           Long promptOptimizationPerCall) {}

    /** 可选模型（GET /me/celebrity/video-studio/models 的一项）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioModel(String endpointId, String name, boolean isDefault, boolean selectableById,
                                   VideoStudioContract contract, VideoStudioPricing pricing) {}

    /** 上传一个素材的结果（POST /me/celebrity/video-studio/uploads）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioUpload(String key, String url, String mediaType, long bytes, String name,
                                    Double durationSec, Integer width, Integer height) {}

    /** 全能参考的一项素材。顺序有意义：同类素材按出现顺序编号（图1、图2…）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioReferenceInput(String mediaType, String key) {}

    /**
     * 提交一条生成任务（POST /me/celebrity/video-studio/jobs）。
     *
     * <p>**没有价格字段**：价格只由服务端按计价参数算，客户端传什么都不看。
     * 数值字段用包装类型，缺了就是 null，由服务端给出明确的 400，而不是悄悄当成 0。
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioJobRequest(String endpointId, String mode, String prompt, String resolutionTier,
                                        String aspectRatio, Integer seconds, Long seed, String firstFrameKey,
                                        String lastFrameKey, List<VideoStudioReferenceInput> references,
                                        String templateId, String optimizationId) {}

    /** 任务用到的一个输入素材（回显用）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioJobInput(String mediaType, String label, String url) {}

    /** 一条生成任务（GET /me/celebrity/video-studio/jobs[/{id}]）。时间字段是 ISO 8601（§4.8）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioJob(String id, String mode, String prompt, String resolutionTier, String aspectRatio,
                                 Integer width, Integer height, int seconds, Long seed, String modelName,
                                 String status, int progressPct, String stage, List<VideoStudioJobInput> inputs,
                                 String videoUrl, String thumbnailUrl, String errorMessage, long credits,
                                 String originalPrompt, String templateId,
                                 String createdAt, String completedAt) {}

    // ── 智能优化 ──────────────────────────────────────────────────────────────

    /** 发起一次智能优化（POST /me/celebrity/video-studio/prompt-optimizations）。与生成请求同一套字段，外加防重复的 clientRequestId。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioOptimizationRequest(String clientRequestId, String endpointId, String mode, String prompt,
                                                 String resolutionTier, String aspectRatio, Integer seconds,
                                                 String firstFrameKey, String lastFrameKey,
                                                 List<VideoStudioReferenceInput> references, String templateId) {}

    /** 一次智能优化（GET /me/celebrity/video-studio/prompt-optimizations/{id}）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioOptimization(String id, String status, String originalPrompt, String optimizedPrompt,
                                          String errorMessage, long credits, String createdAt, String completedAt) {}

    // ── 模板 / 做同款 ─────────────────────────────────────────────────────────

    /** 模板里的一个原素材。做同款时可以原样带回（配合 templateId），也可以换成自己上传的。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioTemplateMaterial(String role, String mediaType, String key, String label, String url) {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioTemplate(String id, String scope, String title, String description, String mode,
                                      String prompt, String resolutionTier, String aspectRatio, int seconds,
                                      Long seed, String endpointId, String modelName,
                                      List<VideoStudioTemplateMaterial> materials, String previewVideoUrl,
                                      String previewThumbnailUrl, long useCount, boolean mine, String createdAt) {}

    /** 把一条成功的生成记录存成模板（POST /me/celebrity/video-studio/templates）。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoStudioTemplateCreateRequest(String jobId, String title, String description, Boolean official) {}
}
