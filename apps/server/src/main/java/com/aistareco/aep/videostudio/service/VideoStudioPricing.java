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
     * 是否计算参考图按当前模式的素材规则决定，避免自定义模式复用旧名称时漏计。
 * {@code Math.multiplyExact}，溢出 → 400 {@code VIDEO_PRICE_OVERFLOW}。
 * {@code GET /models} 下发的 {@link VideoStudioDtos.VideoStudioPricing} 与提交时冻结的金额出自同一组数。
 */
public final class VideoStudioPricing {

    private VideoStudioPricing() {}

    /** 每秒价必须为正；金额上限由整数表示范围及最终报价的溢出检查决定。 */
    public static final long CELL_MIN = 1;

    /** 首次启动写入的配置：全 null / 0 —— 生成按模型单价、不加价、智能优化不收费，运营再按需改。 */
    public static VideoStudioPricingConfig defaults() {
        return new VideoStudioPricingConfig(fullGrid(Map.of()), 0, 0L, 0L);
    }

    /** Keep configured model tiers, and retain the legacy H3 grid for existing endpoints. */
    static Map<String, Map<String, Long>> fullGrid(Map<String, Map<String, Long>> cells) {
        Map<String, Map<String, Long>> out = new LinkedHashMap<>();
        for (String mode : JusuanH3Contract.MODES) {
            Map<String, Long> byTier = cells == null ? null : cells.get(mode);
            Map<String, Long> row = new LinkedHashMap<>();
            for (String tier : JusuanH3Contract.TIERS) row.put(tier, byTier == null ? null : byTier.get(tier));
            if (byTier != null) byTier.forEach(row::put);
            out.put(mode, row);
        }
        if (cells != null) cells.forEach((mode, row) -> {
            if (!out.containsKey(mode)) out.put(mode, row == null ? new LinkedHashMap<>() : new LinkedHashMap<>(row));
        });
        return out;
    }

    /**
     * 下发给用户的计价参数：每一格 = 配置 ?? 模型每秒价 ?? null。
     *
     * @param modelRatePerSecond 后台给这个模型配的每秒价（候选 override 且端点按秒计费）；没有为 null
     */
    public static VideoStudioDtos.VideoStudioPricing effective(VideoStudioPricingConfig config, Long modelRatePerSecond) {
        return effective(config, modelRatePerSecond, VideoStudioService.contract(
                JusuanH3Contract.MIN_SECONDS, JusuanH3Contract.MAX_SECONDS));
    }

    /** Project shared overrides onto only the combinations this configured endpoint exposes. */
    public static VideoStudioDtos.VideoStudioPricing effective(VideoStudioPricingConfig config, Long modelRatePerSecond,
                                                                VideoStudioDtos.VideoStudioContract contract) {
        Map<String, Map<String, Long>> grid = new LinkedHashMap<>();
        for (var mode : contract.modes()) {
            Map<String, Long> prices = new LinkedHashMap<>();
            for (var tier : contract.tiers()) {
                Map<String, Long> configured = config.perSecond().get(mode.mode());
                prices.put(tier.tier(), configured == null ? null : configured.get(tier.tier()));
            }
            grid.put(mode.mode(), prices);
        }
        for (Map<String, Long> row : grid.values()) {
            row.replaceAll((tier, cell) -> cell != null ? cell : modelRatePerSecond);
        }
        return new VideoStudioDtos.VideoStudioPricing(grid, config.freeRefImages(),
                config.extraRefImagePerSecond(), config.promptOptimizationPerCall());
    }

    /**
     * 一条生成任务的总价。
     *
     * @param referenceImages 当前模式实际提交的参考图片张数
     * @param hasReferenceRules 当前端点模式是否配置了多参考素材规则
     * @throws BusinessException 503 {@code VIDEO_STUDIO_PRICE_NOT_CONFIGURED}：这一格没定价；
     *                           400 {@code VIDEO_PRICE_OVERFLOW}：乘出来超过 long
     */
    public static long total(VideoStudioDtos.VideoStudioPricing pricing, String mode, String tier, int seconds,
                             int referenceImages, boolean hasReferenceRules) {
        Map<String, Long> row = pricing.perSecond() == null ? null : pricing.perSecond().get(mode);
        Long perSecond = row == null ? null : row.get(tier);
        if (perSecond == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_STUDIO_PRICE_NOT_CONFIGURED",
                    "这个模式和清晰度还没有定价，暂时不能生成。请联系运营在模型管理中设置视频售价");
        }
        try {
            long extraImages = hasReferenceRules ? Math.max(0, referenceImages - pricing.freeRefImages()) : 0;
            long unit = Math.addExact(perSecond, Math.multiplyExact(extraImages, pricing.extraRefImagePerSecond()));
            return Math.multiplyExact(unit, (long) seconds);
        } catch (ArithmeticException e) {
            throw BusinessException.badRequest("VIDEO_PRICE_OVERFLOW", "视频积分报价超出可用范围");
        }
    }

    /**
     * 后台保存时的严格校验，返回补齐后的配置（整份替换）。
     * 非法的模式 / 清晰度名称、格子小于 1、免费张数为负、加价或优化单价为负、
     * 缺了标量 → 400 {@code VIDEO_STUDIO_PRICING_INVALID}。
     */
    public static VideoStudioPricingConfig validate(VideoStudioPricingConfig input) {
        if (input == null || input.perSecond() == null) throw invalid("缺少每秒价表 perSecond");
        for (Map.Entry<String, Map<String, Long>> row : input.perSecond().entrySet()) {
            if (!validModeKey(row.getKey())) throw invalid("生成模式名称无效：" + row.getKey());
            if (row.getValue() == null) continue;
            for (Map.Entry<String, Long> cell : row.getValue().entrySet()) {
                if (!cell.getKey().matches("[A-Za-z0-9_.-]{1,32}")) throw invalid("清晰度名称无效：" + cell.getKey());
                Long v = cell.getValue();
                if (v != null && v < CELL_MIN) {
                    throw invalid(row.getKey() + " · " + cell.getKey() + " 的每秒价至少为 " + CELL_MIN
                            + "，空着表示按模型单价");
                }
            }
        }
        Integer free = input.freeRefImages();
        if (free == null || free < 0) {
            throw invalid("全能参考免费张数不能为负数");
        }
        requireAmount(input.extraRefImagePerSecond(), "全能参考每张加价");
        requireAmount(input.promptOptimizationPerCall(), "智能优化单价");
        return new VideoStudioPricingConfig(fullGrid(input.perSecond()), free,
                input.extraRefImagePerSecond(), input.promptOptimizationPerCall());
    }

    static boolean validModeKey(String mode) {
        return mode != null && mode.matches("[A-Za-z][A-Za-z0-9_-]{0,63}");
    }

    private static void requireAmount(Long v, String what) {
        if (v == null || v < 0) throw invalid(what + "不能为负数");
    }

    private static BusinessException invalid(String message) {
        return BusinessException.badRequest("VIDEO_STUDIO_PRICING_INVALID", message);
    }
}
