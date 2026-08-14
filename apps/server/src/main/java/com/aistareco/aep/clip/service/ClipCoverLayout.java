package com.aistareco.aep.clip.service;

/**
 * 封面版式的纯计算部分：字号自适应与对齐锚点换算。
 * 刻意不依赖 Graphics2D —— 度量以回调传入，这样单测能用「宽度与字号成正比」的假度量器
 * 直接验算法，不用起 headless 图形环境。
 */
public final class ClipCoverLayout {
    private ClipCoverLayout() {}

    /** 给定字号返回该行实测宽度（像素）。 */
    @FunctionalInterface
    public interface Measurer {
        float widthAt(int fontSize);
    }

    /**
     * 在 [minSize, baseSize] 里取「最宽的一行仍放得下 maxWidth」的最大字号。
     *
     * <p>用二分而不是等比预估后微调：字距/hinting 让宽度对字号并非严格线性，等比一步到位经常还差几像素，
     * 而「估完再往下试固定几次」会在试完之前用光次数、返回一个其实还是放不下的字号。
     * 二分只要宽度随字号单调不减就必然收敛，约 6 次度量，且返回值一定是验证过放得下的。
     *
     * <p>连 minSize 都放不下时停在 minSize：宁可让超长文案轻微出血，也不要把标语缩成看不清的小字
     * —— 真正的超长已经在 {@link ClipCoverPlan#truncate} 按字数截断过了。
     */
    public static int fitFontSize(int baseSize, int minSize, int maxWidth, Measurer measurer) {
        int floor = Math.max(1, Math.min(minSize, baseSize));
        if (maxWidth <= 0) return baseSize;
        if (measurer.widthAt(baseSize) <= maxWidth) return baseSize;

        int lo = floor, hi = baseSize, best = floor;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            if (measurer.widthAt(mid) <= maxWidth) { best = mid; lo = mid + 1; }
            else hi = mid - 1;
        }
        return best;
    }

    /** 按对齐方式把锚点换算成 drawString 的起始 x。 */
    public static int alignedX(ClipCoverTemplate.Align align, int anchorX, int textWidth) {
        return switch (align) {
            case LEFT -> anchorX;
            case CENTER -> anchorX - textWidth / 2;
            case RIGHT -> anchorX - textWidth;
        };
    }
}
