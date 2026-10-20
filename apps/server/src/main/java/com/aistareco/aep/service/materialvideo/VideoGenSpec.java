package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 一次视频生成的输入规格：模式 / 清晰度 / 种子 / 首帧 / 尾帧 / 参考素材。
 *
 * <p>存在 {@code material_video_job.variant_config_json} 里（snake_case，与 {@code endpoint_id} 同一层）。
 * {@link #fromVariantConfigJson} 是 worker **唯一**的解析入口（§8.0.1 ④），{@link #writeTo} 是唯一的写出口，
 * 两边用同一组键名常量。
 *
 * <p>两种形态：
 * <ul>
 *   <li><b>老路径</b>（画布出视频、脚本视频、短剧）：{@code resolutionTier == null}，至多带一个
 *       {@code firstFrameKey}。未配置端点规格时保留原请求体；已配置端点由保存的模式和画幅规格组包。</li>
 *   <li><b>视频生成区 / Studio 完整规格</b>：{@code resolutionTier != null}，按端点的视频协议组包（{@link #isExplicit()}）。</li>
 * </ul>
 * 解析失败 / 空 JSON = {@link #EMPTY}：与此前「读不出首帧就当文生视频」的行为一致。
 *
 * <p>{@code optimizePrompt}：出片前要不要让厂商先改写提示词（聚算 H3 公开契约的 {@code optimizePrompt}）。
 * null = 不发这个字段，由厂商按默认处理（H3 默认改写）；false = 原文直接出片。只有视频生成区 / Studio 会写它。
 */
public record VideoGenSpec(String generationMode, String resolutionTier, Long seed,
                           String firstFrameKey, String lastFrameKey, List<Reference> references,
                           Boolean optimizePrompt) {

    public static final String KEY_GENERATION_MODE = "generation_mode";
    public static final String KEY_RESOLUTION_TIER = "resolution_tier";
    public static final String KEY_SEED = "seed";
    public static final String KEY_FIRST_FRAME = "first_frame_key";
    public static final String KEY_LAST_FRAME = "last_frame_key";
    public static final String KEY_REFERENCE_INPUTS = "reference_inputs";
    public static final String KEY_REFERENCE_MEDIA_TYPE = "media_type";
    public static final String KEY_REFERENCE_KEY = "key";
    public static final String KEY_OPTIMIZE_PROMPT = "optimize_prompt";

    private static final ObjectMapper OM = new ObjectMapper();

    /** 全能参考的一项素材；顺序有意义（同类素材按出现顺序编号：图1、图2…）。 */
    public record Reference(String mediaType, String key) {
        public Reference {
            mediaType = blankToNull(mediaType);
            key = blankToNull(key);
        }
    }

    public static final VideoGenSpec EMPTY = new VideoGenSpec(null, null, null, null, null, List.of());

    /** 不指定提示词改写（厂商默认）。 */
    public VideoGenSpec(String generationMode, String resolutionTier, Long seed,
                        String firstFrameKey, String lastFrameKey, List<Reference> references) {
        this(generationMode, resolutionTier, seed, firstFrameKey, lastFrameKey, references, null);
    }

    public VideoGenSpec {
        generationMode = blankToNull(generationMode);
        resolutionTier = blankToNull(resolutionTier);
        firstFrameKey = blankToNull(firstFrameKey);
        lastFrameKey = blankToNull(lastFrameKey);
        references = references == null ? List.of() : List.copyOf(references);
    }

    /** 只带首帧参考图的老路径规格（画布出视频）；key 为空即 {@link #EMPTY}。 */
    public static VideoGenSpec firstFrameOnly(String firstFrameKey) {
        return new VideoGenSpec(null, null, null, firstFrameKey, null, List.of());
    }

    /** worker 的唯一解析入口。空 / 不是 JSON 对象 / 解析失败 → {@link #EMPTY}。 */
    public static VideoGenSpec fromVariantConfigJson(String variantConfigJson) {
        if (variantConfigJson == null || variantConfigJson.isBlank()) return EMPTY;
        try {
            return fromVariantConfig(OM.readTree(variantConfigJson));
        } catch (Exception e) {
            return EMPTY;
        }
    }

    /** 同上，给已经是 JsonNode 的 variant_config 用（提交阶段的分区闸）。 */
    public static VideoGenSpec fromVariantConfig(JsonNode vc) {
        if (vc == null || !vc.isObject()) return EMPTY;
        List<Reference> refs = new ArrayList<>();
        JsonNode arr = vc.get(KEY_REFERENCE_INPUTS);
        if (arr != null && arr.isArray()) {
            for (JsonNode r : arr) {
                if (r == null || !r.isObject()) continue;
                refs.add(new Reference(text(r, KEY_REFERENCE_MEDIA_TYPE), text(r, KEY_REFERENCE_KEY)));
            }
        }
        JsonNode optimize = vc.get(KEY_OPTIMIZE_PROMPT);
        return new VideoGenSpec(text(vc, KEY_GENERATION_MODE), text(vc, KEY_RESOLUTION_TIER), longOrNull(vc.get(KEY_SEED)),
                text(vc, KEY_FIRST_FRAME), text(vc, KEY_LAST_FRAME), refs,
                optimize != null && optimize.isBoolean() ? optimize.booleanValue() : null);
    }

    /** 同一份规格，只改「出片前要不要让厂商改写提示词」。 */
    public VideoGenSpec withOptimizePrompt(Boolean value) {
        return new VideoGenSpec(generationMode, resolutionTier, seed, firstFrameKey, lastFrameKey, references, value);
    }

    /** 视频生成区与 Studio 写出的完整规格（有清晰度）。 */
    public boolean isExplicit() {
        return resolutionTier != null;
    }

    /**
     * 带了完整视频规格的参数（模式 / 清晰度 / 种子 / 尾帧 / 参考素材 / 提示词改写）。
     * 首帧参考图不算：老路径的画布出视频也会带它。
     */
    public boolean hasNativeOptions() {
        return generationMode != null || resolutionTier != null || seed != null
                || lastFrameKey != null || !references.isEmpty() || optimizePrompt != null;
    }

    /**
     * 参考素材的编号：同类按出现顺序数，图1、图2…、视频1、音频1…（提示词里就是这么指代它们的）。
     * 任务卡回显、提交前的报错、worker 传素材失败的报错都用这一套，报错里的「图2」就是卡片上的「图2」。
     */
    public static List<String> referenceLabels(List<Reference> references) {
        Map<String, Integer> seen = new HashMap<>();
        List<String> out = new ArrayList<>();
        for (Reference r : references) {
            String type = r.mediaType() == null ? "" : r.mediaType();
            int n = seen.merge(type, 1, Integer::sum);
            out.add(("video".equals(type) ? "视频" : "audio".equals(type) ? "音频" : "图") + n);
        }
        return out;
    }

    /** 写进 variant_config（与 {@link #fromVariantConfig} 同一组键名）；null 字段不写。 */
    public void writeTo(ObjectNode vc) {
        if (generationMode != null) vc.put(KEY_GENERATION_MODE, generationMode);
        if (resolutionTier != null) vc.put(KEY_RESOLUTION_TIER, resolutionTier);
        if (seed != null) vc.put(KEY_SEED, seed);
        if (firstFrameKey != null) vc.put(KEY_FIRST_FRAME, firstFrameKey);
        if (lastFrameKey != null) vc.put(KEY_LAST_FRAME, lastFrameKey);
        if (optimizePrompt != null) vc.put(KEY_OPTIMIZE_PROMPT, optimizePrompt);
        if (!references.isEmpty()) {
            ArrayNode arr = vc.putArray(KEY_REFERENCE_INPUTS);
            for (Reference r : references) {
                ObjectNode item = arr.addObject();
                item.put(KEY_REFERENCE_MEDIA_TYPE, r.mediaType());
                item.put(KEY_REFERENCE_KEY, r.key());
            }
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() || !v.isValueNode() ? null : v.asText();
    }

    private static Long longOrNull(JsonNode v) {
        if (v == null || v.isNull()) return null;
        if (v.isIntegralNumber()) return v.canConvertToLong() ? v.asLong() : null;
        if (v.isTextual()) {
            try {
                return Long.parseLong(v.asText().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
