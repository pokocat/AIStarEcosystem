package com.aistareco.aep.ipstudio.dto;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import java.util.List;
import java.util.Map;

/** AI 视频页的长视频（packages/types/src/ip-studio-workflow.ts，字段名 1:1；docs/studio-segmented-video.md）。 */
public final class StudioSegmentedDtos {
    private StudioSegmentedDtos() {}

    /** 一份素材：画布上的节点。slot：image（场景图）| character（出镜人物）| voice（声音）。 */
    public record SegmentedMaterial(String nodeId, String title, String slot) {}

    /**
     * @param hasScript text 是已经写好的脚本（编导写的，用户采用了），按它分段，不改台词
     * @param model     所选视频模型；null 用默认
     * @param budgetCap 用户看到的「最多」这个数（{@link SegmentedVideoPrice#cap()}）；服务端重新报价，对不上 409
     */
    public record SegmentedVideoRequest(String clientRequestId, String sceneId, String text, Boolean hasScript, Map<String, String> options, String language,
                                        Integer duration, String ratio, String model, String tier, Boolean optimize, List<SegmentedMaterial> materials,
                                        Long budgetCap, BillingSelection billing) {}

    /**
     * 按钮旁的价。estimated = 视频 + 分镜图 + 文字任务的上限；cap 再加上每张分镜图不合格时重出一次的余量。
     * textCost 是脚本、审核和提示词优化的冻结上限，实际按用量结算，通常只用掉一小部分。
     */
    public record SegmentedVideoPrice(List<Integer> segments, int boards, boolean boardReview, long videoCost, long boardCost, long textCost, long estimated, long cap) {}
}
