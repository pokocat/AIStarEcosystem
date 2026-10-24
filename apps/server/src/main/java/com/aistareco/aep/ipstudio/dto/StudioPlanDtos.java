package com.aistareco.aep.ipstudio.dto;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import java.util.List;

/**
 * Java mirror of the two-stage skill plan, native check result and plan execution wire types in
 * packages/types/src/ip-studio-workflow.ts (field names 1:1). The TS file is the contract; these records only mirror it.
 */
public final class StudioPlanDtos {
    private StudioPlanDtos() {}

    public record ProductionApproach(String id,String title,String summary,String rationale,List<String> preserve,
                                     List<String> change,List<String> tradeoffs,List<String> requiredCapabilities) {}
    public record StepStrategy(String approachId,String method,String reason) {}
    /** Exactly one of stepId / nodeId. */
    public record StepReferenceBinding(String stepId,String nodeId,String role,Integer order) {}
    public record ClipOrderItem(String stepId,String runId,Integer candidateIndex) {}
    public record EditTarget(String nodeId,String field,String snapshot) {}
    /** Flattened discriminated union StudioSkillStepSettings; {@code operation} selects which fields apply. */
    public record SkillStepSettings(String operation,
                                    String sourceNodeId,String mode,String maxSegmentSec,String videoModel,
                                    String size,Integer count,List<StepReferenceBinding> referenceBindings,
                                    VideoSettings video,Integer durationSec,String aspectRatio,
                                    String targetStepId,String targetRunId,Integer candidateIndex,List<String> checkIds,
                                    List<ClipOrderItem> clipOrder,String audioStrategy,
                                    String purpose,EditTarget editTarget) {}
    public record PlanBudget(Long estimated,Long autoFixCap,Long approvedCap) {}
    public record LegacyEditTarget(String nodeId,String field) {}
    public record PlanStep(String id,String operation,String title,String prompt,StepStrategy strategy,String execution,
                           Long quotedCost,SkillStepSettings settings,String content,LegacyEditTarget editTarget,
                           List<String> referenceNodeIds,List<String> unresolvedReferences,List<String> dependsOn,String resultNodeId) {}
    public record Plan(List<String> notes,String summary,List<PlanStep> steps,List<String> questions,String skillKey,Integer skillVersion,
                       String stage,Integer revision,String fingerprint,List<ProductionApproach> approaches,String recommendedApproachId,
                       String confirmedApproachId,PlanBudget budget) {}

    public record CheckEvidence(String kind,Double timeSec,String observation) {}
    public record CheckItem(String id,String status,List<CheckEvidence> evidence,String reason,String suggestion) {}
    public record CheckResult(String status,String targetRunId,String targetStorageKey,List<Double> sampledTimesSec,List<CheckItem> items) {}

    public record PlanExecutionStep(String id,String title,String operation,String stage,List<String> dependsOn,String status,
                                    List<String> runIds,int attempt,long quotedCost,Long maxCost,String acceptedRunId,
                                    Integer acceptedCandidateIndex,String nodeId,String reason) {}
    /**
     * A stage's approved cap and what its production steps spent / hold in flight. Dialogue turns are not part of it
     * (2026-10-23, docs/ip-studio-dialogue-no-continue.md: 对话费用不计入制作预算).
     */
    public record PlanExecutionBudget(String stage,long approvedCap,long autoFixCap,long spent,long inFlight,long remaining,Long shortfall) {}
    public record PlanExecution(String id,String projectId,String threadId,String skillKey,int skillVersion,String stage,String planRunId,
                                int planRevision,String planFingerprint,String status,List<PlanExecutionStep> steps,
                                List<PlanExecutionBudget> budgets,BillingSelection billing,String needsUserReason,
                                String startedAt,String deadlineAt,String updatedAt,String finishedAt) {}
    public record PlanExecutionCreateRequest(String clientRequestId,String stage,String planRunId,String planFingerprint,String approachId,
                                             Long budgetCap,Long autoFixCap,BillingSelection billing,String executionId,Integer expectedRevision,
                                             String approvalId,String confirmationMessageId) {}
    public record PlanExecutionControlRequest(String clientRequestId,String expectedStatus) {}
    public record PlanExecutionAcceptRequest(String clientRequestId,String runId,Integer candidateIndex) {}
}
