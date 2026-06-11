package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarProductOnboard;

/**
 * celebrity 端商品报备状态 DTO（= TS StarProductFiling）。
 * web-celebrity 创作者把公共商品池商品报备给明星后的回执 / 状态视图。
 */
public record StarProductFilingDto(
        String id,
        String productId,
        String starId,
        String starName,
        int step,
        String stepLabel,
        String submittedAt
) {
    private static final String[] STEP_LABELS = {
            "已提交", "平台初审", "明星审核", "样品寄送", "样品确认", "已入库", "已驳回",
    };

    public static StarProductFilingDto from(StarProductOnboard p, String starName) {
        int step = Math.max(0, Math.min(p.getStep(), STEP_LABELS.length - 1));
        return new StarProductFilingDto(
                p.getId(),
                p.getProductId(),
                p.getStarId(),
                starName,
                p.getStep(),
                STEP_LABELS[step],
                p.getSubmittedAt() != null ? p.getSubmittedAt().toString() : null
        );
    }
}
