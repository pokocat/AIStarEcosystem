package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.EnumSet;
import java.util.Set;

/**
 * AiAvatar 资产状态机（任务书 §3，严格 8 态）：
 * <pre>
 * draft → sampling → draft_iterating → refining → pending_finalize → finalized_2d → deriving → archived
 * </pre>
 *
 * 实现为显式状态机：非法跃迁由 {@link #canTransitionTo(AiAvatarStatus)} 拒绝。
 * 定稿（finalized_2d）后冻结草稿链路（不能再回 sampling / draft_iterating / refining）。
 */
public enum AiAvatarStatus {
    DRAFT,             // 草稿新建
    SAMPLING,          // 打样中
    DRAFT_ITERATING,   // 草稿迭代中
    REFINING,          // 精调中
    PENDING_FINALIZE,  // 待定稿
    FINALIZED_2D,      // 已定稿(2D)
    DERIVING,          // 衍生生成中
    ARCHIVED;          // 正式归档

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case DRAFT -> "草稿新建";
            case SAMPLING -> "打样中";
            case DRAFT_ITERATING -> "草稿迭代中";
            case REFINING -> "精调中";
            case PENDING_FINALIZE -> "待定稿";
            case FINALIZED_2D -> "已定稿";
            case DERIVING -> "衍生生成中";
            case ARCHIVED -> "正式归档";
        };
    }

    @JsonCreator
    public static AiAvatarStatus fromWire(String w) {
        if (w == null) return DRAFT;
        try {
            return AiAvatarStatus.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return DRAFT;
        }
    }

    /** 合法后继状态集合。空集 = 终态（archived）。 */
    public Set<AiAvatarStatus> allowedNext() {
        return switch (this) {
            // 打样可重复触发；草稿新建后可直接进入打样
            case DRAFT -> EnumSet.of(SAMPLING, ARCHIVED);
            // 打样完成 → 选稿进入草稿迭代；也允许重新打样
            case SAMPLING -> EnumSet.of(SAMPLING, DRAFT_ITERATING, REFINING, ARCHIVED);
            // 草稿迭代多轮 → 进入精调；也允许返回再打样
            case DRAFT_ITERATING -> EnumSet.of(DRAFT_ITERATING, SAMPLING, REFINING, ARCHIVED);
            // 精调 → 模板美化 / 待定稿；可返回草稿迭代
            case REFINING -> EnumSet.of(REFINING, DRAFT_ITERATING, PENDING_FINALIZE, ARCHIVED);
            // 待定稿 → 定稿；可退回精调
            case PENDING_FINALIZE -> EnumSet.of(REFINING, FINALIZED_2D, ARCHIVED);
            // 定稿后冻结草稿链路：只能进入衍生 或 归档
            case FINALIZED_2D -> EnumSet.of(DERIVING, ARCHIVED);
            // 衍生生成中 → 归档；衍生可重复回到定稿态再发起
            case DERIVING -> EnumSet.of(FINALIZED_2D, DERIVING, ARCHIVED);
            case ARCHIVED -> EnumSet.noneOf(AiAvatarStatus.class);
        };
    }

    public boolean canTransitionTo(AiAvatarStatus target) {
        return target == this || allowedNext().contains(target);
    }

    /** 是否已定稿（草稿链路冻结）。 */
    public boolean isFinalizedOrLater() {
        return this == FINALIZED_2D || this == DERIVING || this == ARCHIVED;
    }
}
