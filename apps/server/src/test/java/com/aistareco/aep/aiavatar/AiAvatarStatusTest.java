package com.aistareco.aep.aiavatar;

import com.aistareco.aep.aiavatar.model.AiAvatarStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 8 态状态机跃迁合法性（任务书 §3 + §8 单元）。
 */
class AiAvatarStatusTest {

    @Test
    void happyPathChainIsLegal() {
        // draft → sampling → draft_iterating → refining → pending_finalize → finalized_2d → deriving → archived
        assertTrue(AiAvatarStatus.DRAFT.canTransitionTo(AiAvatarStatus.SAMPLING));
        assertTrue(AiAvatarStatus.SAMPLING.canTransitionTo(AiAvatarStatus.DRAFT_ITERATING));
        assertTrue(AiAvatarStatus.DRAFT_ITERATING.canTransitionTo(AiAvatarStatus.REFINING));
        assertTrue(AiAvatarStatus.REFINING.canTransitionTo(AiAvatarStatus.PENDING_FINALIZE));
        assertTrue(AiAvatarStatus.PENDING_FINALIZE.canTransitionTo(AiAvatarStatus.FINALIZED_2D));
        assertTrue(AiAvatarStatus.FINALIZED_2D.canTransitionTo(AiAvatarStatus.DERIVING));
        assertTrue(AiAvatarStatus.DERIVING.canTransitionTo(AiAvatarStatus.ARCHIVED));
    }

    @Test
    void finalizedFreezesDraftChain() {
        // 定稿后不能回草稿链路
        assertFalse(AiAvatarStatus.FINALIZED_2D.canTransitionTo(AiAvatarStatus.SAMPLING));
        assertFalse(AiAvatarStatus.FINALIZED_2D.canTransitionTo(AiAvatarStatus.DRAFT_ITERATING));
        assertFalse(AiAvatarStatus.FINALIZED_2D.canTransitionTo(AiAvatarStatus.REFINING));
        assertTrue(AiAvatarStatus.FINALIZED_2D.isFinalizedOrLater());
        assertTrue(AiAvatarStatus.DERIVING.isFinalizedOrLater());
        assertTrue(AiAvatarStatus.ARCHIVED.isFinalizedOrLater());
        assertFalse(AiAvatarStatus.REFINING.isFinalizedOrLater());
    }

    @Test
    void archivedIsTerminal() {
        for (AiAvatarStatus s : AiAvatarStatus.values()) {
            if (s == AiAvatarStatus.ARCHIVED) continue;
            assertFalse(AiAvatarStatus.ARCHIVED.canTransitionTo(s),
                    "archived 不应能跃迁到 " + s);
        }
        assertTrue(AiAvatarStatus.ARCHIVED.allowedNext().isEmpty());
    }

    @Test
    void selfTransitionAlwaysAllowed() {
        for (AiAvatarStatus s : AiAvatarStatus.values()) {
            assertTrue(s.canTransitionTo(s), s + " 应允许保持自身");
        }
    }

    @Test
    void canSkipToArchiveFromAnyState() {
        // 任意非终态都可直接归档（用户放弃 / 软删）
        for (AiAvatarStatus s : AiAvatarStatus.values()) {
            if (s == AiAvatarStatus.ARCHIVED) continue;
            assertTrue(s.canTransitionTo(AiAvatarStatus.ARCHIVED), s + " 应可归档");
        }
    }

    @Test
    void illegalForwardJumpsRejected() {
        // 不能从 draft 直接跳 finalized
        assertFalse(AiAvatarStatus.DRAFT.canTransitionTo(AiAvatarStatus.FINALIZED_2D));
        assertFalse(AiAvatarStatus.DRAFT.canTransitionTo(AiAvatarStatus.DERIVING));
        // 不能从 sampling 直接到 deriving
        assertFalse(AiAvatarStatus.SAMPLING.canTransitionTo(AiAvatarStatus.DERIVING));
    }

    @Test
    void wireRoundTrip() {
        for (AiAvatarStatus s : AiAvatarStatus.values()) {
            assertEquals(s, AiAvatarStatus.fromWire(s.wire()));
        }
        assertEquals(AiAvatarStatus.DRAFT, AiAvatarStatus.fromWire("nonsense"));
    }
}
