package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;

/**
 * Approval cards live on assistant messages ({@code {type:"approval"}} blocks). The plan executor validates a stage
 * confirmation through this interface, so a confirmation can only bind a card the server actually showed on this user's
 * thread, for the thread's current plan revision. The card itself is never an authorization.
 *
 * <p>Both lookups run inside the caller's transaction and take the thread row lock, so a new plan revision (which
 * supersedes pending cards under the same lock) cannot slip in between the check and {@link #markApproved}.
 *
 * <p>Errors: no such card on an owned thread → 404 {@code STUDIO_APPROVAL_NOT_FOUND} (the message does not exist, is not
 * this user's, or does not hold the card); the card exists but is approved, expired, superseded or not for the thread's
 * current plan → 409 {@code STUDIO_PLAN_STALE}.
 */
public interface StudioDialogueApprovals {
    /**
     * A validated card: a copy of the block, where it lives, the plan revision it quotes, and the thread's current plan.
     *
     * @param approvingMessageId the user message that approved in words (natural-language path), else null
     * @param approvingText      that message's text (the server re-checks it is an unambiguous approval), else null
     */
    record Card(ObjectNode block, String threadId, String cardMessageId, String approvingMessageId, String approvingText,
                String cardPlanRunId, int cardPlanRevision, String currentPlanFingerprint, int currentPlanRevision) {
        public String planFingerprint() { return block.path("planFingerprint").asText(); }
        public String stage() { return block.path("stage").asText(); }
    }

    /** What the user actually authorized; persisted on the card as its immutable snapshot. */
    record Approved(String executionId, String stage, long budgetCap, long autoFixCap, String approvedByMessageId,
                    int planRevision, Instant at) {}

    /**
     * Button path: {@code messageId} is the assistant message holding the card that was clicked. The card must be
     * pending, unexpired and quote the thread's newest plan revision.
     */
    Card requireApproval(String userId, String projectId, String messageId, String approvalId);

    /**
     * Natural-language path (server side only, reached through the dialogue's {@code confirm_approval} tool, never from a
     * client request): {@code userMessageId} is the user's own approving message. The card is looked up by id on the same
     * thread, must have been shown before that message, and must be the only pending card (otherwise the request is
     * ambiguous and nothing is approved).
     */
    Card requireApprovalByMessage(String userId, String projectId, String userMessageId, String approvalId);

    /**
     * In the same transaction as the lookup: mark the card approved with the authorization snapshot, bind the thread to
     * the execution and stage, and publish the card update after commit.
     */
    void markApproved(String userId, String projectId, Card card, Approved approved);
}
