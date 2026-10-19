package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;

/**
 * Where a confirmable plan lives when it is not a native planning run's {@code output.plan}: e.g. a plan block the dialogue
 * loop stored on an assistant message (planRunId = the parent dialogue run). Implemented by the dialogue side; the
 * execution service still re-checks owner, project, stage whitelist and fingerprint on whatever a source returns.
 */
public interface StudioPlanSource {
    /** The plan for this owner/project/run whose server fingerprint equals {@code fingerprint}; empty when unknown here. */
    Optional<PlanRecord> find(String userId,String projectId,String planRunId,String fingerprint);

    /**
     * @param plan           normalized plan with skillKey / skillVersion / stage / server quotes (as fingerprinted)
     * @param skillSnapshot  the skill snapshot the plan was validated against ({@link StudioSkillRules#snapshot} shape)
     * @param contextNodeIds canvas node ids the plan may reference
     * @param revision       plan revision shown to the user (expectedRevision is checked against it)
     */
    record PlanRecord(String planRunId,JsonNode plan,JsonNode skillSnapshot,List<String> contextNodeIds,int revision,
                      String threadId,String messageId) {}
}
