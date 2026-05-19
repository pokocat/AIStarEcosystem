package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * sau 分发任务的状态机。
 *
 *   QUEUED      -> 已创建，未扣费
 *   UPLOADING   -> 已扣费；sau-service 拉视频 + 注入 cookie 中
 *   TRANSCODING -> 平台后台转码中 (sau 透传)
 *   PUBLISHING  -> 平台审核 / 发布中
 *   LIVE        -> 已发布上线 (终态)
 *   FAILED      -> 任意失败 (终态；本期不退款)
 *   CANCELLED   -> 用户主动取消 (终态)
 *
 * 单调推进：QUEUED -> UPLOADING -> ... -> LIVE，或任何中间态 -> FAILED / CANCELLED。
 * 终态不再变更。
 *
 * wire = lowercase，对齐 packages/types/src/publish-job.ts。
 */
public enum PublishJobStatus {
    QUEUED("queued"),
    UPLOADING("uploading"),
    TRANSCODING("transcoding"),
    PUBLISHING("publishing"),
    LIVE("live"),
    FAILED("failed"),
    CANCELLED("cancelled");

    private final String wire;

    PublishJobStatus(String wire) { this.wire = wire; }

    @JsonValue
    public String wire() { return wire; }

    @JsonCreator
    public static PublishJobStatus fromWire(String w) {
        if (w == null) return null;
        for (PublishJobStatus s : values()) if (s.wire.equals(w)) return s;
        try { return PublishJobStatus.valueOf(w.toUpperCase()); } catch (Exception e) { return null; }
    }

    public boolean isTerminal() {
        return this == LIVE || this == FAILED || this == CANCELLED;
    }

    /** Status A -> B 是否合法的单调推进。 */
    public boolean canTransitionTo(PublishJobStatus next) {
        if (this.isTerminal()) return false;
        if (next == null) return false;
        if (next == FAILED || next == CANCELLED) return true;
        // 正向推进：按 ordinal 升序
        return next.ordinal() > this.ordinal() && next.ordinal() <= LIVE.ordinal();
    }
}
