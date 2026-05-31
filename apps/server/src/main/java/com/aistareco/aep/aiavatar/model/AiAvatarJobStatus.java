package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 异步任务状态（任务书 §5/§7 异步任务中心）。
 *
 * 生命周期：queued → running → (succeeded | failed | cancelled)。
 * failed 可由监控线程（AiAvatarJobWatchdog）或用户手动 retry → 回到 queued。
 */
public enum AiAvatarJobStatus {
    QUEUED,
    RUNNING,
    SUCCEEDED,
    FAILED,
    CANCELLED;

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case QUEUED -> "排队中";
            case RUNNING -> "生成中";
            case SUCCEEDED -> "已完成";
            case FAILED -> "失败";
            case CANCELLED -> "已取消";
        };
    }

    public boolean isTerminal() {
        return this == SUCCEEDED || this == CANCELLED;
    }

    @JsonCreator
    public static AiAvatarJobStatus fromWire(String w) {
        if (w == null) return QUEUED;
        try {
            return AiAvatarJobStatus.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return QUEUED;
        }
    }
}
