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
}
