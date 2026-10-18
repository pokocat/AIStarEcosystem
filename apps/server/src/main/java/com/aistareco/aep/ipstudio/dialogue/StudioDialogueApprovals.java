package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Approval cards live on assistant messages ({@code {type:"approval"}} blocks). The plan executor calls this when a stage
 * is confirmed with {@code confirmationMessageId} = the assistant message holding the card, so a confirmation can only bind
 * a card the server actually showed on this user's thread. The card itself is never an authorization.
 */
public interface StudioDialogueApprovals {
    /**
     * Validate that {@code messageId} is an assistant message on a thread of this user and canvas and holds the approval
     * block {@code approvalId} that is neither superseded nor expired. Returns a copy of the block plus {@code threadId}
     * and {@code messageId}; the caller still checks its fingerprint, stage, quote and caps against its own state.
     * Throws 400 {@code STUDIO_APPROVAL_NOT_FOUND} or 409 {@code STUDIO_PLAN_STALE}.
     */
    JsonNode requireApproval(String userId, String projectId, String messageId, String approvalId);

    /** After the confirmation was accepted: mark the card approved and bind the thread to the execution and stage. */
    void markApproved(String userId, String projectId, String messageId, String approvalId, String executionId, String stage);
}
