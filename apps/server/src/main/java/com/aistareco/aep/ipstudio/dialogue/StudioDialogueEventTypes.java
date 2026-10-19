package com.aistareco.aep.ipstudio.dialogue;

import java.util.Set;

/** StudioDialogueEventType (packages/types/src/ip-studio-workflow.ts). */
public final class StudioDialogueEventTypes {
    private StudioDialogueEventTypes() {}
    public static final String MESSAGE_DELTA = "message.delta", TOOL_STARTED = "tool.started", TOOL_PROGRESS = "tool.progress",
            TOOL_FINISHED = "tool.finished", PLAN_PROPOSED = "plan.proposed", APPROVAL_REQUIRED = "approval.required",
            NODE_UPSERT = "node.upsert", CHECK_RESULT = "check.result", BUDGET_UPDATE = "budget.update", TURN_DONE = "turn.done";
    public static final Set<String> ALL = Set.of(MESSAGE_DELTA, TOOL_STARTED, TOOL_PROGRESS, TOOL_FINISHED, PLAN_PROPOSED,
            APPROVAL_REQUIRED, NODE_UPSERT, CHECK_RESULT, BUDGET_UPDATE, TURN_DONE);
}
