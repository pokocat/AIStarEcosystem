package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 视频生成区的计价（docs/video-studio-plan.md §3，v0.199 二版：**我们自己定、后台可配**，不照搬厂商价格）。
 *
 * <p>每一格（模式 × 清晰度）的每秒价 = 后台配置那一格 ?? 后台给这个模型配的每秒价
 * （候选 {@code creditCostOverride} 且端点按秒计费）?? null。null = 未定价：下发给用户的 pricing 里就是 null，
 * 前端不报价、不许提交，服务端提交 → 503 {@code VIDEO_STUDIO_PRICE_NOT_CONFIGURED}。**不回落任何写死的价**（§8.0）。
 *
 * <p>生成总价 = (每秒价 + max(0, 参考图张数 − freeRefImages) × extraRefImagePerSecond) × 秒数，
 * 只有全能参考算图片张数；{@code Math.multiplyExact}，溢出 → 400 {@code VIDEO_PRICE_OVERFLOW}。
 * {@code GET /models} 下发的 {@link VideoStudioDtos.VideoStudioPricing} 与提交时冻结的金额出自同一组数。
 */
public final class VideoStudioPricing {

    private VideoStudioPricing() {}

    /** 一格每秒价的合法范围（含两端）。 */
    public static final long CELL_MIN = 1;
    public static final long CELL_MAX = 100_000;
    /** 加价、优化单价的上限（下限 0 = 不加 / 不收费）。 */
    public static final long AMOUNT_MAX = 100_000;
    /** 全能参考前几张不加价，最多就是参考图上限。 */
    public static final int FREE_REF_IMAGES_MAX = JusuanH3Contract.REFERENCE_IMAGE_MAX_COUNT;

    /** 首次启动写入的配置：全 null / 0 —— 生成按模型单价、不加价、智能优化不收费，运营再按需改。 */
    public static VideoStudioPricingConfig defaults() {
        return new VideoStudioPricingConfig(fullGrid(Map.of()), 0, 0L, 0L);
    }

    /** 四种模式 × 两档清晰度补齐（缺的格子 = null），顺序固定（与合同的展示顺序一致）。 */
    static Map<String, Map<String, Long>> fullGrid(Map<String, Map<String, Long>> cells) {
        Map<String, Map<String, Long>> out = new LinkedHashMap<>();
        for (String mode : JusuanH3Contract.MODES) {
            Map<String, Long> byTier = cells == null ? null : cells.get(mode);
            Map<String, Long> row = new LinkedHashMap<>();
            for (String tier : JusuanH3Contract.TIERS) row.put(tier, byTier == null ? null : byTier.get(tier));
            out.put(mode, row);
        }
        return out;
    }

    /**
     * 下发给用户的计价参数：每一格 = 配置 ?? 模型每秒价 ?? null。
     *
     * @param modelRatePerSecond 后台给这个模型配的每秒价（候选 override 且端点按秒计费）；没有为 null
     */
    public static VideoStudioDtos.VideoStudioPricing effective(VideoStudioPricingConfig config, Long modelRatePerSecond) {
        Map<String, Map<String, Long>> grid = fullGrid(config.perSecond());
        for (Map<String, Long> row : grid.values()) {
            row.replaceAll((tier, cell) -> cell != null ? cell : modelRatePerSecond);
        }
        return new VideoStudioDtos.VideoStudioPricing(grid, config.freeRefImages(),
                config.extraRefImagePerSecond(), config.promptOptimizationPerCall());
    }

    /**
     * 一条生成任务的总价。
     *
     * @param referenceImages 全能参考里的图片张数；其它模式传 0
     * @throws BusinessException 503 {@code VIDEO_STUDIO_PRICE_NOT_CONFIGURED}：这一格没定价；
     *                           400 {@code VIDEO_PRICE_OVERFLOW}：乘出来超过 long
     */
    public static long total(VideoStudioDtos.VideoStudioPricing pricing, String mode, String tier, int seconds,
                             int referenceImages) {
        Map<String, Long> row = pricing.perSecond() == null ? null : pricing.perSecond().get(mode);
        Long perSecond = row == null ? null : row.get(tier);
        if (perSecond == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_STUDIO_PRICE_NOT_CONFIGURED",
                    "这个模式和清晰度还没有定价，暂时不能生成。请联系运营在后台「明星带货 → 引擎定价 → 视频生成」里设置");
        }
        try {
            long extraImages = JusuanH3Contract.MODE_UNIVERSAL_REFERENCE.equals(mode)
                    ? Math.max(0, referenceImages - pricing.freeRefImages()) : 0;
            long unit = Math.addExact(perSecond, Math.multiplyExact(extraImages, pricing.extraRefImagePerSecond()));
            return Math.multiplyExact(unit, (long) seconds);
        } catch (ArithmeticException e) {
            throw BusinessException.badRequest("VIDEO_PRICE_OVERFLOW", "视频积分报价超出可用范围");
        }
    }

    /**
     * 后台保存时的严格校验，返回补齐后的配置（整份替换）。
     * 不认识的模式 / 清晰度、格子不在 1..100000、免费张数不在 0..9、加价或优化单价不在 0..100000、
     * 缺了标量 → 400 {@code VIDEO_STUDIO_PRICING_INVALID}。
     */
    public static VideoStudioPricingConfig validate(VideoStudioPricingConfig input) {
        if (input == null || input.perSecond() == null) throw invalid("缺少每秒价表 perSecond");
        for (Map.Entry<String, Map<String, Long>> row : input.perSecond().entrySet()) {
            if (!JusuanH3Contract.isMode(row.getKey())) throw invalid("不认识的生成模式：" + row.getKey());
            if (row.getValue() == null) continue;
            for (Map.Entry<String, Long> cell : row.getValue().entrySet()) {
                if (!JusuanH3Contract.TIERS.contains(cell.getKey())) throw invalid("不认识的清晰度：" + cell.getKey());
                Long v = cell.getValue();
                if (v != null && (v < CELL_MIN || v > CELL_MAX)) {
                    throw invalid(row.getKey() + " · " + cell.getKey() + " 的每秒价要在 " + CELL_MIN + " 到 " + CELL_MAX
                            + " 之间，空着表示按模型单价");
                }
            }
        }
        Integer free = input.freeRefImages();
        if (free == null || free < 0 || free > FREE_REF_IMAGES_MAX) {
            throw invalid("全能参考免费张数要在 0 到 " + FREE_REF_IMAGES_MAX + " 之间");
        }
        requireAmount(input.extraRefImagePerSecond(), "全能参考每张加价");
        requireAmount(input.promptOptimizationPerCall(), "智能优化单价");
        return new VideoStudioPricingConfig(fullGrid(input.perSecond()), free,
                input.extraRefImagePerSecond(), input.promptOptimizationPerCall());
    }

    private static void requireAmount(Long v, String what) {
        if (v == null || v < 0 || v > AMOUNT_MAX) throw invalid(what + "要在 0 到 " + AMOUNT_MAX + " 之间");
    }

    private static BusinessException invalid(String message) {
        return BusinessException.badRequest("VIDEO_STUDIO_PRICING_INVALID", message);
    }
}
