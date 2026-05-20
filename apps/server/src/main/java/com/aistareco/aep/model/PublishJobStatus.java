package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * sau 分发任务的状态机。
 *
 *   QUEUED         -> 已创建，未扣费
 *   UPLOADING      -> 已扣费；sau-service 拉视频 + 注入 cookie 中
 *   TRANSCODING    -> 平台后台转码中 (sau 透传)
 *   PUBLISHING     -> 平台审核 / 发布中
 *   AWAITING_USER  -> 平台弹出人机交互（短信验证码等），等用户在前端输入
 *   LIVE           -> 已发布上线 (终态)
 *   FAILED         -> 任意失败 (终态；本期不退款)
 *   CANCELLED      -> 用户主动取消 (终态)
 *
 * 主线单调推进：QUEUED -> UPLOADING -> TRANSCODING -> PUBLISHING -> LIVE。
 * 旁支：任意非终态可以 -> FAILED / CANCELLED；UPLOADING/TRANSCODING/PUBLISHING
 * 可以临时跳到 AWAITING_USER 并在用户提交后回到 UPLOADING/TRANSCODING/PUBLISHING。
 * AWAITING_USER 不在主线 ordinal 链上 —— 它是一个"暂停"标记。
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
    // ↑ 主线状态按 ordinal 升序，canTransitionTo 依赖。
    // ↓ 副状态/终态放在 LIVE 之后；ordinal 不参与单调推进判定。
    AWAITING_USER("awaiting_user"),
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

    /** Status A -> B 是否合法的单调推进。
     *
     *  AWAITING_USER 双向：
     *    UPLOADING/TRANSCODING/PUBLISHING -> AWAITING_USER (平台弹 SMS 弹窗)
     *    AWAITING_USER -> UPLOADING/TRANSCODING/PUBLISHING/LIVE (用户提交后恢复)
     *    AWAITING_USER -> FAILED / CANCELLED (用户超时 / 主动取消)
     *
     *  主线（QUEUED..LIVE）按 ordinal 升序。
     */
    public boolean canTransitionTo(PublishJobStatus next) {
        if (this.isTerminal()) return false;
        if (next == null) return false;
        if (next == FAILED || next == CANCELLED) return true;
        if (this == AWAITING_USER) {
            return next == UPLOADING || next == TRANSCODING || next == PUBLISHING || next == LIVE;
        }
        if (next == AWAITING_USER) {
            return this == UPLOADING || this == TRANSCODING || this == PUBLISHING;
        }
        // 主线推进：next 必须在 [QUEUED..LIVE] 区间内且 ordinal 更大
        if (next.ordinal() > LIVE.ordinal()) return false;
        return next.ordinal() > this.ordinal();
    }
}
