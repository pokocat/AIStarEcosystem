package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Authorization and budget gate between the dialogue tools and paid native child runs (implemented by the S2 plan
 * executor). Injected as {@code Optional}: without an implementation every paid child tool refuses with a clear message
 * and nothing is frozen.
 */
public interface StudioExecutionGate {
    /**
     * Check that {@code executionId} belongs to this user/project, is running, authorizes {@code request.operation()} in
     * {@code stage}, and that spent + inFlight + quote ≤ approvedCap. Return the request with the execution's immutable
     * {@code billing} selection, the approved per-step {@code maxCost} and the execution binding filled in. Throw
     * {@code STUDIO_PLAN_BUDGET_EXCEEDED} / {@code STUDIO_SKILL_OPERATION_NOT_ALLOWED} / {@code STUDIO_PLAN_STALE} without
     * freezing anything.
     */
    RunRequest authorizeChild(String userId, String projectId, String executionId, String stage, RunRequest request);

    /** Record the accepted child run on the execution (in-flight accounting). Called right after submit returned. */
    void childAccepted(String userId, String projectId, String executionId, String clientRequestId, String runId);

    /**
     * Fill server quotes into a validated skill plan ({@code steps[].quotedCost}, {@code budget.estimated},
     * {@code budget.autoFixCap}) from current endpoint contracts and prices. Must not change plan content otherwise.
     */
    void quotePlan(String userId, String projectId, ObjectNode plan);

    /**
     * A parent dialogue turn accepted while the thread is bound to an active execution belongs to the execution's
     * current stage (plan §提交前预算与付款绑定: 父对话run也计入所属阶段). Under the execution lock, check
     * {@code spent + inFlight + maxCost ≤ approvedCap} and register the run so its ceiling counts in flight until it
     * settles and its real credits count as spent afterwards (deduplicated by run id). Throws 402
     * {@code STUDIO_PLAN_BUDGET_EXCEEDED} with the shortfall and registers nothing when it does not fit.
     *
     * @return the stage the turn was attributed to, or null when the execution is no longer active (nothing registered)
     */
    default String attributeTurn(String userId, String projectId, String executionId, String runId, long maxCost) { return null; }

    /**
     * The user approved a pending card in words. The dialogue's {@code confirm_approval} tool hands the request here; it
     * runs through the same creation / stage-confirmation path as the card button, with the approving user message as
     * the confirmation source. Returns the execution projection.
     */
    default Object confirmFromDialogue(String userId, String projectId, NaturalApproval approval) {
        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "后台制作尚未开放");
    }

    /**
     * @param approvalId        the card the user approved
     * @param userMessageId     the user's approving message (bound as the confirmation source)
     * @param budgetCap         the stage cap the user named, or null for the card's cap (higher than the card only when the
     *                          user said that number)
     * @param autoFixCap        the redo sub-cap the user named, or null for the card's
     * @param clientRequestId   deterministic from message + card, so a repeated tool call is idempotent
     */
    record NaturalApproval(String approvalId, String userMessageId, Long budgetCap, Long autoFixCap, String clientRequestId) {}
}
