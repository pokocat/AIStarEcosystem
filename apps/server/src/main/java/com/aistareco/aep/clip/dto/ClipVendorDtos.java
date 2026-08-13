package com.aistareco.aep.clip.dto;

import java.util.List;

/**
 * 石榴 AI 供应商总览（运营后台只读视图）的 wire 契约。
 *
 * <p>TS 镜像在 {@code apps/admin/src/api/clip-vendor.ts}，字段名与可空性必须逐字一致
 * （AGENTS.md §4.1）。这不是 {@code packages/types/src/clip.ts} 的一部分 —— 用户端不消费，
 * 所以没放进 {@link ClipDtos}。
 */
public final class ClipVendorDtos {
    private ClipVendorDtos() {}

    /**
     * 额度快照。任一字段为 null = 上游没给这个字段，<b>不是 0</b>。
     *
     * <p>{@code error != null} 时其余字段一律 null：读失败与「额度是 0」是两件事，
     * 混在一起会让运营把「没读到」当成「用光了」（或反过来）。
     */
    public record QuotaDto(
            String error,
            Integer availableAvatar, Integer availableSpeaker,
            Long validPoint, String validToTime,
            boolean avatarSlotsExhausted, boolean speakerSlotsExhausted
    ) {
        public static QuotaDto failed(String error) {
            return new QuotaDto(error, null, null, null, null, false, false);
        }
    }

    /** 两边都有 —— 正常。 */
    public record MatchedRow(String engineRef, String vendorTitle, String localId, String ownerUserId,
                             String localName, String engineStatus) {}

    /** 石榴有、我方无 —— 孤儿，白占槽位，可安全清理。 */
    public record OrphanRow(String engineRef, String vendorTitle) {}

    /** 我方有、石榴无 —— 悬挂，上游被删了但本地没同步；用户点到会报错。 */
    public record DanglingRow(String localId, String ownerUserId, String localName,
                              String engineRef, String engineStatus, String updatedAt) {}

    /**
     * 不参与三类对账的本地行，单列出来只为解释「为什么本地行数对不上」。
     *
     * <p>{@code reason}：{@code training} = 还没拿到 engineRef（训练中/训练失败）；
     * {@code mock} = engineRef 不是上游 id 形态（mock 时代残留的 {@code mock-voice-xxx}）。
     * 这两类本来就没有对应的上游对象，算进「悬挂」会把它们误报成「上游已删」。
     */
    public record UnmatchableRow(String localId, String ownerUserId, String localName,
                                 String engineRef, String engineStatus, String reason) {}

    /**
     * 一侧（形象 / 音色）的对账结果。
     *
     * <p>{@code error != null} 时 {@code vendorCount} 为 null 且三类列表一律为空 ——
     * 表示「石榴侧没读到」，<b>不表示</b>「石榴侧是空的」。前端必须按读失败渲染，
     * 绝不能显示成「0 个孤儿、全部悬挂」。
     */
    public record ReconcileDto(
            String error,
            Integer vendorCount, int localCount,
            List<MatchedRow> matched, List<OrphanRow> orphan, List<DanglingRow> dangling,
            List<UnmatchableRow> unmatchable
    ) {
        public static ReconcileDto failed(String error, int localCount) {
            return new ReconcileDto(error, null, localCount, List.of(), List.of(), List.of(), List.of());
        }
    }

    /**
     * @param mock      当前走的是 mock 网关（本地/测试）还是真实石榴；页面必须显著标注，
     *                  否则运营会把 mock 的假额度当真账读。
     * @param checkedAt 本次拉取时间（ISO-8601）；这是实时查询，不是缓存快照。
     */
    public record VendorOverviewDto(
            boolean mock, String checkedAt,
            QuotaDto quota, ReconcileDto avatars, ReconcileDto voices
    ) {}
}
