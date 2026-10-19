package com.aistareco.aep.ipstudio.dto;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/**
 * Wire mirror of the dialogue thread / message / event contract in packages/types/src/ip-studio-workflow.ts
 * (StudioDialogueThread, StudioDialogueMessage, StudioDialogueState, StudioPostMessage*, StudioDialogueControlRequest,
 * StudioBranchRequest, StudioDialogueEvent and its typed data). Field names are 1:1 with the TS interfaces; all times
 * are ISO-8601 strings. Blocks are typed in TS ({@code StudioMessageBlock}) and carried here as the persisted JSON.
 */
public final class StudioDialogueDtos {
    private StudioDialogueDtos() {}

    /** {@code skillKey / skillVersion}: the skill the thread is bound to (explicit choice or S3 intent routing), null until a turn picks one. */
    public record DialogueThread(String id, String projectId, String parentThreadId, String branchFromMessageId, String title,
                         long lastSeq, String activeTurnId, String activeExecutionId, String createdAt, String updatedAt,
                         String skillKey, Integer skillVersion) {}

    public record Message(String id, String threadId, long seq, String turnId, String runId, String role, String text,
                          JsonNode blocks, List<String> pinnedNodeIds, List<String> attachmentNodeIds, String clientMessageId,
                          JsonNode billing, Boolean settling, String status, String createdAt, String legacyNodeId,
                          /** Follow-ups offered under an assistant message (execution summaries keep them across reloads). */
                          List<String> suggestions) {}

    /** {@code execution} is the executor's StudioPlanExecution projection when a plan execution is bound. */
    public record State(DialogueThread thread, List<Message> messages, String nextCursor, long latestSeq, Object execution) {}

    /** {@code model}: text endpoint for this turn when the scene allows choosing one; ignored for a fixed scene. Never payment authority. */
    public record PostMessageRequest(String clientMessageId, String text, List<String> pinnedNodeIds, List<String> attachmentNodeIds,
                                     Integer expectedPlanRevision, String skillKey, BillingSelection billing, Long maxCost, String model) {}

    /** queueState: accepted (started a turn) | queued (steering for the active turn) | applied. */
    public record PostMessageResult(String messageId, String turnId, String runId, String queueState) {}

    public record ControlRequest(String controlId, String action, String executionId) {}

    public record BranchRequest(String clientRequestId, String fromMessageId) {}

    public record Event(String eventId, long seq, String threadId, String turnId, String runId, String executionId,
                        String createdAt, String type, JsonNode data) {}

    // ── Typed event data (StudioMessageDeltaData, StudioToolEventData, …) ──────────────────────────────────────────
    public record MessageDeltaData(String messageId, String partId, String delta) {}
    public record ToolResultSummary(String summary, List<String> nodeIds, List<String> storageKeys) {}
    public record ToolEventData(String toolCallId, String toolName, String messageId, String title, String safeInputSummary, String childRunId,
                                String status, String progress, ToolResultSummary result, Long creditsActual, Boolean settling,
                                Long durationMs, String errorCode, String errorMessage) {}
    public record PlanProposedData(String messageId, JsonNode block) {}
    public record ApprovalRequiredData(String messageId, JsonNode block, Long shortfall) {}
    public record Connection(String fromNodeId, String toNodeId) {}
    public record Proposal(String field, String content) {}
    public record NodeUpsertData(String nodeId, String op, JsonNode node, Connection connection, String executionId, String stepId,
                                 String runId, String expectedDocVersion, Proposal proposal) {}
    public record TokenBilling(long inputTokens, long outputTokens, long credits, java.math.BigDecimal inputCreditsPerK,
                               java.math.BigDecimal outputCreditsPerK) {}
    public record TurnDoneData(String reason, String messageId, TokenBilling billing, Boolean settling, List<String> suggestions) {}
}
